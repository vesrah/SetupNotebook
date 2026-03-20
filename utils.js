/**
 * Shared utilities for Lotus/Elise setup tools
 */

// ============================================================================
// Unit Conversion Constants
// ============================================================================

/** Millimeters per statute mile (exact: 1609.344 meters × 1000) */
const MM_PER_MILE = 1609344;

/** Inches to millimeters (exact by definition: 1 inch = 25.4 mm) */
const IN_TO_MM = 25.4;

/** Inches to meters */
const IN_TO_M = 0.0254;

/** Pounds-force to Newtons */
const LB_TO_N = 4.44822;

/** Pounds-mass to kilograms */
const LB_TO_KG = 0.453592;

/** Pascals per psi (1 lbf/in² = 6894.757… Pa by definition) */
const PA_PER_PSI = 6894.757293168;

/**
 * @param {number} pa - Pressure in pascals
 * @returns {number} Pressure in psi
 */
function paToPsi(pa) {
  return pa / PA_PER_PSI;
}

// ============================================================================
// Physics Constants
// ============================================================================

/** Gravitational acceleration in m/s² */
const G = 9.81;

/** Gravitational acceleration in in/s² (for wheel frequency calculations using lb/in spring rates) */
const G_IN = 386.088;

/** Penske coilover 10 TPI = 2.54mm per turn at spring perch */
const MM_PER_TURN_AT_SPRING = 2.54;

// ============================================================================
// DOM Helpers
// ============================================================================

/**
 * Shorthand for document.getElementById
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Get numeric value from an input element
 * @param {string} id - Element ID
 * @param {number} def - Default value if element missing or value invalid
 * @returns {number}
 */
function num(id, def = 0) {
  const el = $(id);
  if (!el) return def;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : def;
}

/**
 * Convert snake_case to kebab-case
 * @param {string} str - String in snake_case
 * @returns {string} String in kebab-case
 */
function toKebab(str) {
  return str.replace(/_/g, '-');
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Create a debounced version of a function that delays execution until
 * after the specified milliseconds have elapsed since the last call
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds (default 300)
 * @returns {Function} Debounced function
 */
function debounce(fn, ms = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ============================================================================
// Tire Size Parsing
// ============================================================================

/**
 * Parse a tire size string and return the tire diameter in millimeters.
 * Supports multiple formats:
 *   - Revolutions per mile: "875r", "875 rev", "875 rev/mi"
 *   - Direct diameter in mm: "587mm"
 *   - Direct diameter in inches: "23.1in" or "23.1"
 *   - Slick/race format: "27/65-18" (diameter/width-rim, first number is diameter in inches)
 *   - Street format: "205/50/15" or "205/50R15" (section width/aspect ratio/rim diameter)
 * 
 * @param {string} sizeStr - Tire size string
 * @returns {number|null} Diameter in mm, or null if unparseable
 */
function parseTireDiameter(sizeStr) {
  if (!sizeStr) return null;
  const s = sizeStr.trim();
  
  // Revolutions per mile: circumference = MM_PER_MILE / rev, diameter = circumference / π
  const revMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:r|rev|rev\/mi|rpm)$/i);
  if (revMatch) {
    const circumference = MM_PER_MILE / parseFloat(revMatch[1]);
    return circumference / Math.PI;
  }
  
  // Direct mm diameter
  const mmMatch = s.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mmMatch) return parseFloat(mmMatch[1]);
  
  // Direct inches diameter
  const inMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:in|")?$/i);
  if (inMatch) return parseFloat(inMatch[1]) * IN_TO_MM;
  
  // Street format: section width (mm) / aspect ratio (%) / rim diameter (inches)
  // e.g., "205/50/15", "205/50R15", "205/50-15"
  // Section width is typically 135-355mm, aspect ratio 25-80, rim 13-22
  // Check this BEFORE slick format since street widths (195, 205, etc) would be
  // misinterpreted as diameter in inches by slick format
  const streetMatch = s.match(/^(\d+)[\/](\d+)[\/R-]?(\d+)$/i);
  if (streetMatch) {
    const section = parseFloat(streetMatch[1]);
    const aspect = parseFloat(streetMatch[2]);
    const rim = parseFloat(streetMatch[3]);
    // Sanity check: street tire section widths are > 100mm
    if (section >= 100) {
      const sidewall = section * (aspect / 100);
      return (rim * IN_TO_MM) + (sidewall * 2);
    }
  }
  
  // Slick/race format: first number is overall diameter in inches
  // e.g., "27/65-18" (27" diameter, 65 width, 18" rim)
  const slickMatch = s.match(/^(\d+(?:\.\d+)?)[\/x-](\d+(?:\.\d+)?)[\/x-](\d+(?:\.\d+)?)$/);
  if (slickMatch) {
    return parseFloat(slickMatch[1]) * IN_TO_MM;
  }
  
  return null;
}

/**
 * Parse a tire size string and return the tire circumference in millimeters
 * @param {string} sizeStr - Tire size string (see parseTireDiameter for formats)
 * @returns {number|null} Circumference in mm (rounded), or null if unparseable
 */
function parseTireCircumference(sizeStr) {
  const diameter = parseTireDiameter(sizeStr);
  return diameter ? Math.round(diameter * Math.PI) : null;
}

/**
 * Get tire diameter from a tire data object.
 * Prefers revolutions_per_mile if available, falls back to parsing size string.
 * @param {Object} tireData - Tire data with optional revolutions_per_mile and size properties
 * @returns {number|null} Diameter in mm, or null if unavailable
 */
function getTireDiameter(tireData) {
  if (!tireData) return null;
  if (tireData.revolutions_per_mile) {
    const circumference = MM_PER_MILE / tireData.revolutions_per_mile;
    return circumference / Math.PI;
  }
  if (tireData.size) {
    return parseTireDiameter(tireData.size);
  }
  return null;
}

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Download data as a JSON file
 * @param {Object} data - Data to serialize and download
 * @param {string} filename - Download filename (default: 'data.json')
 */
function downloadJson(data, filename = 'data.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Brake hydraulics (lotus-brake-bias and similar)
// ============================================================================

/**
 * Pedal force → circuit pressures from balance bar and dual master cylinders.
 * @param {object} p - brake params: pedal_ratio, booster_ratio, balance_bar_split, mc_front_d_in, mc_rear_d_in
 * @param {number} pedal_force_lb
 * @returns {{ P_F: number, P_R: number, A_MC_F: number, A_MC_R: number }} Pa and MC piston areas (m²)
 */
function circuitPressuresPa(p, pedal_force_lb) {
  const pedal_force_N = pedal_force_lb * LB_TO_N;
  const F_total_MC = pedal_force_N * p.pedal_ratio * p.booster_ratio;
  const F_MC_F = F_total_MC * p.balance_bar_split;
  const F_MC_R = F_total_MC * (1 - p.balance_bar_split);
  const mc_front_d_m = p.mc_front_d_in * IN_TO_M;
  const mc_rear_d_m = p.mc_rear_d_in * IN_TO_M;
  const A_MC_F = Math.PI * (mc_front_d_m / 2) ** 2;
  const A_MC_R = Math.PI * (mc_rear_d_m / 2) ** 2;
  return {
    P_F: F_MC_F / A_MC_F,
    P_R: F_MC_R / A_MC_R,
    A_MC_F,
    A_MC_R
  };
}

/**
 * @param {object} p - pist*_front_d_mm, pist*_rear_d_mm
 * @returns {{ A_F_per_caliper: number, A_R_per_caliper: number }} m² per caliper
 */
function caliperPistonAreas(p) {
  const pist1_front_d_m = p.pist1_front_d_mm / 1000;
  const pist2_front_d_m = p.pist2_front_d_mm / 1000;
  const pist1_rear_d_m = p.pist1_rear_d_mm / 1000;
  const pist2_rear_d_m = p.pist2_rear_d_mm / 1000;
  return {
    A_F_per_caliper: Math.PI * (pist1_front_d_m / 2) ** 2 + Math.PI * (pist2_front_d_m / 2) ** 2,
    A_R_per_caliper: Math.PI * (pist1_rear_d_m / 2) ** 2 + Math.PI * (pist2_rear_d_m / 2) ** 2
  };
}

/**
 * Longitudinal brake forces (N) at tires for given circuit pressures (Pa).
 * @param {object} p - full brake/vehicle params used by lotus-brake-bias compute()
 * @param {number} P_F - front circuit Pa
 * @param {number} P_R - rear circuit Pa
 * @returns {{ front_N: number, rear_N: number }}
 */
function brakeWheelForcesFromPressures(p, P_F, P_R) {
  const mu_pad_front = p.front_mu * (1 - 0.03 * (P_F / 1e6));
  const mu_pad_rear = p.rear_mu * (1 - 0.03 * (P_R / 1e6));
  const { A_F_per_caliper, A_R_per_caliper } = caliperPistonAreas(p);

  const rotor_front_r_m = (p.rotor_front_d_mm / 2) / 1000;
  const rotor_rear_r_m = (p.rotor_rear_d_mm / 2) / 1000;
  const pad_front_r_out = rotor_front_r_m;
  const pad_front_r_in = rotor_front_r_m - (p.pad_front_height_mm / 1000);
  const pad_rear_r_out = rotor_rear_r_m;
  const pad_rear_r_in = rotor_rear_r_m - (p.pad_rear_height_mm / 1000);

  const r_eff_F = (2/3) * (pad_front_r_out**3 - pad_front_r_in**3) / (pad_front_r_out**2 - pad_front_r_in**2);
  const r_eff_R = (2/3) * (pad_rear_r_out**3 - pad_rear_r_in**3) / (pad_rear_r_out**2 - pad_rear_r_in**2);

  const T_F_per_caliper = 2 * mu_pad_front * P_F * A_F_per_caliper * r_eff_F;
  const T_R_per_caliper = 2 * mu_pad_rear * P_R * A_R_per_caliper * r_eff_R;
  const T_F_total = 2 * T_F_per_caliper;
  const T_R_total = 2 * T_R_per_caliper;

  const rim_front_d_m = p.tire_front_rim_d_in * IN_TO_M;
  const sidewall_front_h_m = (p.tire_front_aspect_ratio / 100) * (p.tire_front_section_width_mm / 1000);
  const r_tire_front_static = (rim_front_d_m + 2 * sidewall_front_h_m) / 2;
  const rim_rear_d_m = p.tire_rear_rim_d_in * IN_TO_M;
  const sidewall_rear_h_m = (p.tire_rear_aspect_ratio / 100) * (p.tire_rear_section_width_mm / 1000);
  const r_tire_rear_static = (rim_rear_d_m + 2 * sidewall_rear_h_m) / 2;

  const FzF_static = p.beta * p.m * p.g;
  const FzR_static = (1 - p.beta) * p.m * p.g;
  const r_tire_front_loaded = Math.max(r_tire_front_static - (FzF_static / p.k_tire_front), 0.1);
  const r_tire_rear_loaded = Math.max(r_tire_rear_static - (FzR_static / p.k_tire_rear), 0.1);

  return {
    front_N: T_F_total / r_tire_front_loaded,
    rear_N: T_R_total / r_tire_rear_loaded
  };
}

/**
 * Hydraulic gain (psi per lb pedal) for each circuit at current balance / MC geometry.
 * @param {object} p - same params as circuitPressuresPa
 * @returns {{ front: number, rear: number }}
 */
function hydraulicPsiPerLb(p) {
  const { P_F, P_R } = circuitPressuresPa(p, 1);
  return { front: paToPsi(P_F), rear: paToPsi(P_R) };
}

// ============================================================================
// Chart Utilities
// ============================================================================

/**
 * Round a value up to a "nice" number for chart axis maximum.
 * Selects from predefined steps for clean axis labels.
 * @param {number} value - Raw maximum value
 * @returns {number} Rounded nice maximum
 */
function niceMax(value) {
  const steps = [
    10, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100,
    120, 140, 150, 160, 170, 180, 200, 250, 300, 400, 500,
    600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 4000, 5000,
    6000, 7000, 8000, 9000, 10000, 12000, 15000, 20000
  ];
  for (const step of steps) {
    if (value <= step) return step;
  }
  return Math.ceil(value / 5000) * 5000;
}

/**
 * Create an array of n values linearly spaced from a to b (inclusive).
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} n - Number of points
 * @returns {number[]}
 */
function linspace(a, b, n) {
  if (n <= 0) return [];
  if (n === 1) return [a];
  return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
}

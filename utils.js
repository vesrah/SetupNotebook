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

// ============================================================================
// Physics Constants
// ============================================================================

/** Gravitational acceleration in m/s² */
const G = 9.81;

/** Gravitational acceleration in in/s² (for wheel frequency calculations using lb/in spring rates) */
const G_IN = 386.088;

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

/**
 * Get tire circumference from a tire data object
 * @param {Object} tireData - Tire data with optional revolutions_per_mile and size properties
 * @returns {number|null} Circumference in mm (rounded), or null if unavailable
 */
function getTireCircumference(tireData) {
  const diameter = getTireDiameter(tireData);
  return diameter ? Math.round(diameter * Math.PI) : null;
}

/**
 * Get revolutions per mile from a tire data object.
 * Returns stored value if available, otherwise calculates from size.
 * @param {Object} tireData - Tire data with optional revolutions_per_mile and size properties
 * @returns {number|null} Revolutions per mile, or null if unavailable
 */
function getRevPerMile(tireData) {
  if (!tireData) return null;
  if (tireData.revolutions_per_mile) {
    return tireData.revolutions_per_mile;
  }
  const diameter = parseTireDiameter(tireData.size);
  if (diameter) {
    return MM_PER_MILE / (diameter * Math.PI);
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

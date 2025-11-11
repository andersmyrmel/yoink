/**
 * YAML Helper Functions
 * Utilities for safely generating YAML output without undefined/null/NaN values
 */

/**
 * Safely converts a value to a string for YAML output.
 * Prevents undefined, null, and NaN from appearing in the YAML.
 *
 * @param value - Value to convert
 * @param fallback - Fallback value if the input is invalid (default: 'auto')
 * @returns Safe string value suitable for YAML
 *
 * @example
 * safeValue(undefined) // Returns 'auto'
 * safeValue(null, '0px') // Returns '0px'
 * safeValue(NaN) // Returns 'auto'
 * safeValue(42) // Returns '42'
 * safeValue('16px') // Returns '16px'
 */
export function safeValue(value: any, fallback: string = 'auto'): string {
  // Handle undefined and null
  if (value === undefined || value === null || value === 'undefined' || value === 'null') {
    return fallback;
  }

  // Handle NaN
  if (typeof value === 'number' && isNaN(value)) {
    return fallback;
  }

  // Handle empty strings
  if (typeof value === 'string' && value.trim() === '') {
    return fallback;
  }

  return String(value);
}

/**
 * Safely converts a numeric value to a string with units.
 * Handles undefined, null, NaN, and adds px unit if needed.
 *
 * @param value - Numeric value or string with unit
 * @param unit - Unit to append if value is just a number (default: 'px')
 * @param fallback - Fallback value if input is invalid (default: 'auto')
 * @returns Safe string with unit
 *
 * @example
 * safeNumber(16) // Returns '16px'
 * safeNumber('16px') // Returns '16px'
 * safeNumber(undefined) // Returns 'auto'
 * safeNumber(NaN, 'px', '0px') // Returns '0px'
 */
export function safeNumber(value: any, unit: string = 'px', fallback: string = 'auto'): string {
  if (value === undefined || value === null || value === 'undefined' || value === 'null') {
    return fallback;
  }

  if (typeof value === 'number') {
    if (isNaN(value)) return fallback;
    return `${value}${unit}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
      return fallback;
    }
    return trimmed;
  }

  return fallback;
}

/**
 * Safely escapes a string for YAML output.
 * Handles quotes and special characters, prevents injection issues.
 *
 * @param value - String to escape
 * @param fallback - Fallback if value is invalid (default: '')
 * @returns Escaped string safe for YAML
 *
 * @example
 * safeString('Hello "World"') // Returns 'Hello \"World\"'
 * safeString(undefined) // Returns ''
 */
export function safeString(value: any, fallback: string = ''): string {
  if (value === undefined || value === null || value === 'undefined' || value === 'null') {
    return fallback;
  }

  const str = String(value);

  // Escape quotes
  return str.replace(/"/g, '\\"');
}

/**
 * Safely outputs an object property for YAML.
 * Only outputs the line if the value is valid (not undefined/null/NaN).
 *
 * @param key - YAML key name
 * @param value - Value to output
 * @param indent - Indentation string (e.g., '  ', '    ')
 * @param fallback - Optional fallback value
 * @returns YAML line string, or empty string if value is invalid and no fallback
 *
 * @example
 * safeYamlLine('height', '100px', '  ') // Returns '  height: 100px\n'
 * safeYamlLine('height', undefined, '  ') // Returns ''
 * safeYamlLine('height', undefined, '  ', 'auto') // Returns '  height: auto\n'
 */
export function safeYamlLine(key: string, value: any, indent: string = '', fallback?: string): string {
  const safeVal = safeValue(value, fallback || '');

  // If no fallback and value is invalid, return empty
  if (!fallback && (value === undefined || value === null || value === 'undefined' || value === 'null' ||
      (typeof value === 'number' && isNaN(value)))) {
    return '';
  }

  return `${indent}${key}: ${safeVal}\n`;
}

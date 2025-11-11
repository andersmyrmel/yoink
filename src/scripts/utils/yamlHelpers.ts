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

/**
 * Checks if a style value is meaningless noise that should be filtered from YAML output.
 *
 * Filters out default/zero/transparent values that don't provide useful design information:
 * - Transparent backgrounds: rgba(0, 0, 0, 0), transparent
 * - Zero dimensions: 0px, 0
 * - Zero borders: 0px none, 0px solid
 * - No shadows: none (for box-shadow)
 * - Zero border-radius: 0px
 * - Zero padding/margin: 0px
 *
 * @param key - The CSS property name (e.g., 'background', 'padding')
 * @param value - The CSS value to check
 * @returns True if the value is meaningless noise and should be filtered out
 *
 * @example
 * isMeaninglessValue('background', 'rgba(0, 0, 0, 0)') // true
 * isMeaninglessValue('background', 'rgb(255, 0, 0)') // false
 * isMeaninglessValue('border', '0px none rgb(0, 0, 0)') // true
 * isMeaninglessValue('border', '1px solid rgb(0, 0, 0)') // false
 */
export function isMeaninglessValue(key: string, value: any): boolean {
  if (!value || value === undefined || value === null) return true;

  const strValue = String(value).trim().toLowerCase();

  // Empty values
  if (strValue === '' || strValue === 'undefined' || strValue === 'null') return true;

  // Property-specific filters
  switch (key) {
    case 'background':
    case 'backgroundColor':
      // Transparent backgrounds are noise
      return strValue === 'rgba(0, 0, 0, 0)' ||
             strValue === 'transparent' ||
             strValue === 'rgba(0,0,0,0)';

    case 'border':
      // Zero or no borders are noise
      return strValue.startsWith('0px none') ||
             strValue.startsWith('0px solid') ||
             strValue === 'none' ||
             strValue === '0px';

    case 'borderRadius':
    case 'border-radius':
      // Zero border-radius is noise
      return strValue === '0px' || strValue === '0';

    case 'boxShadow':
    case 'box-shadow':
      // No shadow is noise
      return strValue === 'none';

    case 'padding':
    case 'margin':
      // Zero padding/margin is noise
      return strValue === '0px' || strValue === '0';

    case 'width':
    case 'height':
    case 'minWidth':
    case 'min-width':
      // Zero dimensions are noise
      return strValue === '0px' || strValue === '0';

    default:
      return false;
  }
}

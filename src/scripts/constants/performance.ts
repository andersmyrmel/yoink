/**
 * Performance constants for extraction operations
 *
 * These constants control how many elements are scanned and how deep
 * the extraction goes. Adjust these values to balance between completeness
 * and performance.
 */

/**
 * Element scan limits for different extraction operations
 */
export const ELEMENT_SCAN_LIMITS = {
  /** For simple, quick scans (fonts, border-radius) */
  SMALL: 100,

  /** For comprehensive scans (colors, typography, shadows) */
  MEDIUM: 500,

  /** For extensive scans (animations, layout, z-index) */
  LARGE: 1000,
} as const;

/**
 * DOM tree extraction limits
 */
export const DOM_TREE_LIMITS = {
  /** Maximum depth to traverse in the DOM tree */
  MAX_DEPTH: 12,

  /** Maximum children to extract per node */
  MAX_CHILDREN: 15,

  /** Maximum classes to include per element */
  MAX_CLASSES: 5,
} as const;

/**
 * Text extraction limits
 */
export const TEXT_LIMITS = {
  /** Minimum text length to include */
  MIN_LENGTH: 2,

  /** Maximum text length for buttons/links */
  MAX_LENGTH: 100,

  /** Maximum text length for display purposes */
  DISPLAY_LENGTH: 80,
} as const;

/**
 * Result limits for extracted patterns
 */
export const RESULT_LIMITS = {
  /** Maximum number of component variants to return */
  MAX_VARIANTS: 10,

  /** Maximum number of patterns to return */
  MAX_PATTERNS: 20,

  /** Maximum number of color entries */
  MAX_COLORS: 20,

  /** Maximum number of fonts */
  MAX_FONTS: 10,

  /** Maximum number of border radius values */
  MAX_BORDER_RADIUS: 10,

  /** Maximum number of gradients */
  MAX_GRADIENTS: 10,

  /** Maximum number of scrollbar styles */
  MAX_SCROLLBARS: 5,
} as const;

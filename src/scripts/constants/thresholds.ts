/**
 * Threshold constants for visual similarity detection and filtering
 */

/**
 * Color similarity thresholds (0-1 scale, where 0 = identical, 1 = completely different)
 * Based on Euclidean distance in RGB color space
 */
export const COLOR_SIMILARITY = {
  /** Strict threshold for filled buttons and primary backgrounds */
  STRICT: 0.12,

  /** Moderate threshold for general backgrounds */
  MODERATE: 0.15,

  /** Loose threshold for ghost/outline buttons and subtle differences */
  LOOSE: 0.20,
} as const;

/**
 * Visual similarity thresholds for component deduplication
 */
export const COMPONENT_SIMILARITY = {
  /** Border radius difference tolerance in pixels */
  BORDER_RADIUS: {
    STRICT: 6,
    LOOSE: 10,
  },

  /** Padding difference tolerance in pixels */
  PADDING: 12,

  /** Font size difference tolerance in pixels */
  FONT_SIZE: {
    MINOR: 4,
    MAJOR: 6,
  },
} as const;

/**
 * Shadow filtering thresholds
 */
export const SHADOW_THRESHOLDS = {
  /** Maximum shadow blur value to consider valid (in pixels) */
  MAX_BLUR: 100,

  /** Maximum shadow spread value to consider valid (in pixels) */
  MAX_SPREAD: 50,
} as const;

/**
 * Border radius filtering thresholds
 */
export const BORDER_RADIUS_THRESHOLDS = {
  /** Minimum border radius to consider (in pixels) */
  MIN: 0,

  /** Maximum border radius to consider (in pixels) */
  MAX: 100,
} as const;

/**
 * Typography thresholds
 */
export const TYPOGRAPHY_THRESHOLDS = {
  /** Minimum font size for heading detection */
  HEADING_MIN_SIZE: 18,

  /** Font weight threshold for bold text */
  BOLD_WEIGHT: 600,

  /** Font size threshold for very large headings */
  VERY_LARGE_HEADING: 24,

  /** Font size threshold for extra large headings */
  EXTRA_LARGE_HEADING: 32,

  /** Maximum text length for headings */
  HEADING_MAX_LENGTH: 80,

  /** Font size threshold for caption text */
  CAPTION_MAX_SIZE: 13,
} as const;

/**
 * Spacing analysis thresholds
 */
export const SPACING_THRESHOLDS = {
  /** Minimum spacing value to track (in pixels) */
  MIN_VALUE: 4,

  /** Maximum spacing value to track (in pixels) */
  MAX_VALUE: 200,
} as const;

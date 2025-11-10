import { StateStyles } from '../types/extraction';

/**
 * Creates a unique signature for an element based on key style properties.
 *
 * This function generates a consistent string identifier for elements by analyzing
 * their computed styles. It rounds padding values to the nearest 16px to group
 * elements with minor padding differences together, making it useful for identifying
 * component variants that are visually similar.
 *
 * @param element - The HTML element to create a signature for
 * @returns A string signature representing the element's visual style, formatted as:
 *          `{backgroundColor}-{color}-{borderRadius}-{paddingLeft}px-{paddingTop}px-{fontSize}-{fontWeight}`
 *
 * @example
 * ```typescript
 * const button = document.querySelector('.btn');
 * const signature = createStyleSignature(button);
 * // Returns: "rgb(0, 123, 255)-rgb(255, 255, 255)-4px-16px-16px-14px-500"
 * ```
 *
 * @internal Used by component extraction functions to group similar elements
 */
export function createStyleSignature(element: HTMLElement): string {
  const styles = getComputedStyle(element);

  // Round padding to nearest 16px to group variants with minor padding differences
  const paddingLeft = Math.round(parseInt(styles.paddingLeft) / 16) * 16;
  const paddingTop = Math.round(parseInt(styles.paddingTop) / 16) * 16;

  return `${styles.backgroundColor}-${styles.color}-${styles.borderRadius}-${paddingLeft}px-${paddingTop}px-${styles.fontSize}-${styles.fontWeight}`;
}

/**
 * Extracts interactive state styles (hover, focus, active, disabled) from an element.
 *
 * This function attempts to extract pseudo-class styles by:
 * 1. Querying CSS rules that match the element and checking for pseudo-class selectors
 * 2. Falling back to detecting utility class patterns (e.g., Tailwind's `hover:`, `focus:` prefixes)
 * 3. Checking for disabled attribute on the element
 *
 * It handles cross-origin stylesheet errors gracefully and provides a comprehensive
 * view of how a component appears in different interaction states.
 *
 * @param element - The HTML element to extract state styles from
 * @returns StateStyles object containing hover, focus, active, and disabled states,
 *          or undefined if no state styles are found
 *
 * @example
 * ```typescript
 * const button = document.querySelector('.btn');
 * const states = extractStateStyles(button);
 * // Returns: {
 * //   hover: {
 * //     backgroundColor: 'rgb(0, 105, 217)',
 * //     boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
 * //   },
 * //   focus: {
 * //     outline: '2px solid rgb(0, 123, 255)',
 * //     boxShadow: '0 0 0 4px rgba(0,123,255,0.25)'
 * //   },
 * //   active: {
 * //     transform: 'scale(0.98)'
 * //   }
 * // }
 * ```
 *
 * @remarks
 * - The function attempts to read actual CSS rules first for accurate state information
 * - If CSS rules are inaccessible (e.g., cross-origin), it falls back to class name detection
 * - Utility classes are detected for frameworks like Tailwind CSS
 * - The disabled state includes an `isDisabled` boolean if the element has a disabled attribute
 */
export function extractStateStyles(element: HTMLElement): StateStyles | undefined {
  const states: StateStyles = {};

  // Try to get state styles from CSS rules matching this element
  try {
    const matchingRules = getMatchingCSSRules(element);

    matchingRules.forEach(rule => {
      const selectorText = rule.selectorText;

      // Check for :hover pseudo-class
      if (selectorText.includes(':hover')) {
        if (!states.hover) states.hover = {};
        const style = rule.style;
        if (style.backgroundColor) states.hover.backgroundColor = style.backgroundColor;
        if (style.color) states.hover.color = style.color;
        if (style.opacity) states.hover.opacity = style.opacity;
        if (style.transform) states.hover.transform = style.transform;
        if (style.boxShadow) states.hover.boxShadow = style.boxShadow;
        if (style.borderColor) states.hover.borderColor = style.borderColor;
      }

      // Check for :focus pseudo-class
      if (selectorText.includes(':focus')) {
        if (!states.focus) states.focus = {};
        const style = rule.style;
        if (style.outline) states.focus.outline = style.outline;
        if (style.boxShadow) states.focus.boxShadow = style.boxShadow;
        if (style.borderColor) states.focus.borderColor = style.borderColor;
      }

      // Check for :active pseudo-class
      if (selectorText.includes(':active')) {
        if (!states.active) states.active = {};
        const style = rule.style;
        if (style.backgroundColor) states.active.backgroundColor = style.backgroundColor;
        if (style.transform) states.active.transform = style.transform;
        if (style.boxShadow) states.active.boxShadow = style.boxShadow;
      }

      // Check for :disabled pseudo-class
      if (selectorText.includes(':disabled')) {
        if (!states.disabled) states.disabled = {};
        const style = rule.style;
        if (style.opacity) states.disabled.opacity = style.opacity;
        if (style.cursor) states.disabled.cursor = style.cursor;
        if (style.backgroundColor) states.disabled.backgroundColor = style.backgroundColor;
      }
    });
  } catch (_e) {
    // Fallback: check for Tailwind-style utility classes
    const classes = Array.from(element.classList);

    // Extract hover states
    const hoverClasses = classes.filter(c => c.includes('hover:'));
    if (hoverClasses.length > 0) {
      states.hover = { utilityClasses: hoverClasses };
    }

    // Extract focus states
    const focusClasses = classes.filter(c => c.includes('focus:'));
    if (focusClasses.length > 0) {
      states.focus = { utilityClasses: focusClasses };
    }

    // Extract disabled states
    const disabledClasses = classes.filter(c => c.includes('disabled:'));
    if (disabledClasses.length > 0) {
      states.disabled = { utilityClasses: disabledClasses };
    }
  }

  // Check if element is actually disabled
  if (element.hasAttribute('disabled')) {
    if (!states.disabled) states.disabled = {};
    states.disabled.isDisabled = true;
  }

  return Object.keys(states).length > 0 ? states : undefined;
}

/**
 * Gets all CSS rules that match a given element.
 *
 * This function iterates through all stylesheets in the document and returns
 * CSS rules whose selectors match the provided element. It handles various
 * edge cases gracefully:
 * - Cross-origin stylesheet access errors
 * - Invalid CSS selectors
 * - Missing or null cssRules
 *
 * The function is essential for extracting pseudo-class styles (hover, focus, etc.)
 * that cannot be read from getComputedStyle().
 *
 * @param element - The HTML element to find matching CSS rules for
 * @returns Array of CSSStyleRule objects that apply to the element
 *
 * @example
 * ```typescript
 * const button = document.querySelector('.btn-primary');
 * const rules = getMatchingCSSRules(button);
 * rules.forEach(rule => {
 *   console.log(rule.selectorText); // e.g., ".btn-primary", ".btn-primary:hover"
 *   console.log(rule.style.cssText); // e.g., "background: blue; color: white;"
 * });
 * ```
 *
 * @remarks
 * - Cross-origin stylesheets (e.g., from CDNs) cannot be accessed and are silently skipped
 * - Invalid selectors that throw when matching are also skipped
 * - This function only returns CSSStyleRule instances, not other rule types
 * - The returned rules include both base styles and pseudo-class styles
 */
export function getMatchingCSSRules(element: HTMLElement): CSSStyleRule[] {
  const matchingRules: CSSStyleRule[] = [];

  try {
    const sheets = Array.from(document.styleSheets);

    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);

        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            try {
              if (element.matches(rule.selectorText)) {
                matchingRules.push(rule);
              }
            } catch (_e) {
              // Invalid selector, skip
            }
          }
        }
      } catch (_e) {
        // Cross-origin stylesheet, skip
      }
    }
  } catch (_e) {
    // Error accessing stylesheets
  }

  return matchingRules;
}

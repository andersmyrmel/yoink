import { StateStyles, ComponentStyles } from '../types/extraction';
import { normalizeColor } from './styleHelpers';

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
 * Normalizes colors in a ComponentStyles object to RGB format.
 * Converts oklab, oklch, hsl, and other exotic color formats to standard rgb/rgba.
 *
 * @param styles - Component styles object with potentially exotic color formats
 * @returns New ComponentStyles object with all colors normalized to RGB
 *
 * @example
 * ```typescript
 * const styles = {
 *   background: 'oklab(0.5 0.1 -0.2)',
 *   color: 'hsl(220, 100%, 50%)',
 *   border: '1px solid oklch(0.6 0.2 30)'
 * };
 * const normalized = normalizeComponentStyles(styles);
 * // Returns: {
 * //   background: 'rgb(100, 130, 160)',
 * //   color: 'rgb(0, 102, 255)',
 * //   border: '1px solid rgb(150, 180, 120)'
 * // }
 * ```
 */
export function normalizeComponentStyles(styles: ComponentStyles): ComponentStyles {
  const normalized = { ...styles };

  // Normalize color properties
  if (normalized.background) {
    normalized.background = normalizeColor(normalized.background);
  }
  if (normalized.color) {
    normalized.color = normalizeColor(normalized.color);
  }

  // Normalize colors in border shorthand (e.g., "1px solid oklch(...)")
  if (normalized.border && (normalized.border.includes('oklab') || normalized.border.includes('oklch') || normalized.border.includes('hsl'))) {
    // Extract color from border shorthand and normalize it
    const borderParts = normalized.border.split(' ');
    const normalizedParts = borderParts.map(part => {
      if (part.includes('oklab') || part.includes('oklch') || part.includes('hsl') || part.includes('rgb')) {
        return normalizeColor(part);
      }
      return part;
    });
    normalized.border = normalizedParts.join(' ');
  }

  // Normalize borderTop, borderBottom for dividers
  if (normalized.borderTop && (normalized.borderTop.includes('oklab') || normalized.borderTop.includes('oklch') || normalized.borderTop.includes('hsl'))) {
    const parts = normalized.borderTop.split(' ');
    normalized.borderTop = parts.map(p => p.includes('oklab') || p.includes('oklch') || p.includes('hsl') ? normalizeColor(p) : p).join(' ');
  }
  if (normalized.borderBottom && (normalized.borderBottom.includes('oklab') || normalized.borderBottom.includes('oklch') || normalized.borderBottom.includes('hsl'))) {
    const parts = normalized.borderBottom.split(' ');
    normalized.borderBottom = parts.map(p => p.includes('oklab') || p.includes('oklch') || p.includes('hsl') ? normalizeColor(p) : p).join(' ');
  }

  return normalized;
}

/**
 * Recursively normalizes all color values in any object structure.
 * Useful for normalizing entire component variant objects with nested styles.
 *
 * @param obj - Any object that may contain color values
 * @returns New object with all colors normalized to RGB
 */
export function normalizeAllColors(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check if this looks like a color value
    if (obj.includes('oklab') || obj.includes('oklch') || obj.includes('hsl') ||
        obj.startsWith('rgb') || obj.startsWith('#')) {
      return normalizeColor(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeAllColors(item));
  }

  if (typeof obj === 'object') {
    const normalized: any = {};
    for (const key in obj) {
      normalized[key] = normalizeAllColors(obj[key]);
    }
    return normalized;
  }

  return obj;
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

  // Strategy 1: Try to get state styles from CSS rules matching this element
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
        if (style.filter) states.hover.filter = style.filter;
      }

      // Check for :focus pseudo-class
      if (selectorText.includes(':focus')) {
        if (!states.focus) states.focus = {};
        const style = rule.style;
        if (style.outline) states.focus.outline = style.outline;
        if (style.boxShadow) states.focus.boxShadow = style.boxShadow;
        if (style.borderColor) states.focus.borderColor = style.borderColor;
        if (style.backgroundColor) states.focus.backgroundColor = style.backgroundColor;
      }

      // Check for :active pseudo-class
      if (selectorText.includes(':active')) {
        if (!states.active) states.active = {};
        const style = rule.style;
        if (style.backgroundColor) states.active.backgroundColor = style.backgroundColor;
        if (style.transform) states.active.transform = style.transform;
        if (style.boxShadow) states.active.boxShadow = style.boxShadow;
        if (style.opacity) states.active.opacity = style.opacity;
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
    // CSS rules inaccessible - continue with other strategies
  }

  // Strategy 2: Check for Tailwind/utility framework classes
  const classes = Array.from(element.classList);

  // Extract hover states from utility classes
  const hoverClasses = classes.filter(c => c.includes('hover:'));
  if (hoverClasses.length > 0) {
    if (!states.hover) states.hover = {};
    states.hover.utilityClasses = hoverClasses;
  }

  // Extract focus states from utility classes
  const focusClasses = classes.filter(c => c.includes('focus:'));
  if (focusClasses.length > 0) {
    if (!states.focus) states.focus = {};
    states.focus.utilityClasses = focusClasses;
  }

  // Extract active states from utility classes
  const activeClasses = classes.filter(c => c.includes('active:'));
  if (activeClasses.length > 0) {
    if (!states.active) states.active = {};
    states.active.utilityClasses = activeClasses;
  }

  // Extract disabled states from utility classes
  const disabledClasses = classes.filter(c => c.includes('disabled:'));
  if (disabledClasses.length > 0) {
    if (!states.disabled) states.disabled = {};
    states.disabled.utilityClasses = disabledClasses;
  }

  // Strategy 3: Infer common state patterns from computed styles
  const computedStyle = getComputedStyle(element);

  // Check if element is disabled first
  const isDisabled = element.hasAttribute('disabled') ||
                     element.getAttribute('aria-disabled') === 'true' ||
                     element.classList.contains('disabled');

  // If element has transition properties, it likely has hover states
  if (computedStyle.transition && computedStyle.transition !== 'all 0s ease 0s' && computedStyle.transition !== 'none') {
    if (!states.hover) states.hover = {};
    states.hover.hasTransition = true;

    // Parse transition shorthand to extract duration and easing
    const transitionStr = computedStyle.transition;

    // Try to extract duration (e.g., "0.2s", "200ms")
    const durationMatch = transitionStr.match(/(\d+\.?\d*)(s|ms)(?!\w)/);
    // Try to extract easing (e.g., "ease-in-out", "cubic-bezier(...)")
    const easingMatch = transitionStr.match(/(ease-in-out|ease-in|ease-out|ease|linear|cubic-bezier\([^)]+\))/);

    if (durationMatch && easingMatch) {
      // Parse duration and easing separately for clarity
      states.hover.transitionDuration = durationMatch[0];
      states.hover.transitionEasing = easingMatch[0];
      // Also keep full transition for reference
      states.hover.transition = transitionStr;
    } else if (durationMatch) {
      // Has duration but no explicit easing - default to 'ease'
      states.hover.transitionDuration = durationMatch[0];
      states.hover.transitionEasing = 'ease';
      states.hover.transition = transitionStr;
    } else if (easingMatch) {
      // Has easing but no duration - use browser default 0s (probably a mistake in CSS)
      states.hover.transitionDuration = '0s';
      states.hover.transitionEasing = easingMatch[0];
      states.hover.transition = transitionStr;
    } else {
      // Can't parse - transition might just be "all" without timing
      // This happens when getComputedStyle doesn't return the full shorthand
      states.hover.transition = transitionStr;
    }
  }

  // If element is interactive (cursor: pointer) and NOT disabled, it likely has hover state
  if (computedStyle.cursor === 'pointer' && !states.hover && !isDisabled) {
    states.hover = { inferredInteractive: true };
  }

  // Strategy 4: Check data attributes that might indicate state styling
  const dataAttrs = Array.from(element.attributes).filter(attr => attr.name.startsWith('data-'));
  const stateDataAttrs = dataAttrs.filter(attr =>
    attr.name.includes('hover') ||
    attr.name.includes('focus') ||
    attr.name.includes('active') ||
    attr.name.includes('disabled')
  );

  if (stateDataAttrs.length > 0) {
    stateDataAttrs.forEach(attr => {
      const stateName = attr.name.includes('hover') ? 'hover' :
                       attr.name.includes('focus') ? 'focus' :
                       attr.name.includes('active') ? 'active' : 'disabled';

      if (!states[stateName as keyof StateStyles]) {
        (states[stateName as keyof StateStyles] as any) = {};
      }
      (states[stateName as keyof StateStyles] as any).dataAttribute = attr.value;
    });
  }

  // Check if element is actually disabled
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
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

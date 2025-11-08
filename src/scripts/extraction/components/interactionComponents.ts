import {
  getCleanHTML,
  calculateColorDistance,
  parsePaddingValue,
  getButtonTextFontSize
} from '../../utils/styleHelpers';
import {
  ButtonComponent,
  ComponentStyles,
  StateStyles,
  ProgressComponent
} from '../../types/extraction';

/**
 * Generic component interface for non-button interactive components
 */
interface Component {
  html: string;
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
  stateStyles?: StateStyles;
}

/**
 * Checks if two buttons are visually similar enough to be merged.
 *
 * Uses weighted scoring for colors (most important) and structure (less important)
 * with more forgiving tolerances to reduce variant fragmentation. This function is
 * variant-aware, meaning buttons with the same semantic variant (ghost, outline, etc.)
 * are merged more easily.
 *
 * Comparison factors:
 * - Variant type (must match exactly)
 * - Background colors (with special handling for ghost/outline buttons)
 * - Text colors (more forgiving for ghost/outline variants)
 * - Border radius (variant-specific tolerances)
 * - Padding (allows for size variant differences)
 * - Font size (allows for small/medium/large variants)
 *
 * @param btn1 - First button component to compare
 * @param btn2 - Second button component to compare
 * @returns True if the buttons are visually similar enough to be merged into the same variant
 *
 * @example
 * ```typescript
 * const button1 = { variant: 'primary', styles: { background: 'blue', ... }, ... };
 * const button2 = { variant: 'primary', styles: { background: 'rgb(0, 0, 255)', ... }, ... };
 * if (areButtonsSimilar(button1, button2)) {
 *   // Merge these buttons as the same variant
 * }
 * ```
 */
function areButtonsSimilar(btn1: ButtonComponent, btn2: ButtonComponent): boolean {
  const styles1 = btn1.styles;
  const styles2 = btn2.styles;

  // 1. Compare variant type first (must match)
  if (btn1.variant !== btn2.variant) {
    return false;
  }

  const variantType = btn1.variant.toLowerCase();
  const isGhostOrOutline = variantType.includes('ghost') || variantType.includes('outline') || variantType.includes('link');
  const isSecondarySized = variantType.includes('secondary');

  // 2. Compare background colors
  const bg1 = styles1.background || 'transparent';
  const bg2 = styles2.background || 'transparent';

  // Special handling for ghost/outline buttons: transparent and white are similar
  const isTransparent1 = bg1 === 'rgba(0, 0, 0, 0)' || bg1 === 'transparent';
  const isTransparent2 = bg2 === 'rgba(0, 0, 0, 0)' || bg2 === 'transparent';
  const isWhite1 = bg1 === 'rgb(255, 255, 255)' || bg1 === '#ffffff';
  const isWhite2 = bg2 === 'rgb(255, 255, 255)' || bg2 === '#ffffff';

  if (isGhostOrOutline) {
    // For outline buttons, allow transparent vs white (both are "not filled")
    const bothMinimal = (isTransparent1 || isWhite1) && (isTransparent2 || isWhite2);
    if (!bothMinimal) {
      // One has color, one is minimal - check if similar
      const bgDistance = calculateColorDistance(bg1, bg2);
      if (bgDistance > 0.15) {
        return false;
      }
    }
  } else {
    // For filled buttons, enforce stricter color matching
    const bgDistance = calculateColorDistance(bg1, bg2);
    if (bgDistance > 0.12) {
      return false;
    }
  }

  // 3. Compare text colors (more forgiving for ghost/outline variants)
  const textDistance = calculateColorDistance(styles1.color || 'rgb(0,0,0)', styles2.color || 'rgb(0,0,0)');

  if (isGhostOrOutline) {
    // Ghost/outline buttons often have varying text shades (dark, medium, light gray)
    if (textDistance > 0.20) {
      return false;
    }
  } else {
    if (textDistance > 0.12) {
      return false;
    }
  }

  // 4. Compare border-radius (very forgiving for same variant type)
  const radius1 = parseFloat(styles1.borderRadius || '0') || 0;
  const radius2 = parseFloat(styles2.borderRadius || '0') || 0;
  const radiusDiff = Math.abs(radius1 - radius2);

  // Ghost/outline buttons often have 0px (flat) or 8px (rounded) - both are acceptable
  if (isGhostOrOutline || isSecondarySized) {
    if (radiusDiff > 10) {
      return false;
    }
  } else {
    if (radiusDiff > 6) {
      return false;
    }
  }

  // 5. Compare padding (size variants often differ here, be forgiving)
  const padding1 = parsePaddingValue(styles1.padding || '0px');
  const padding2 = parsePaddingValue(styles2.padding || '0px');
  const paddingDiff = Math.abs(padding1 - padding2);
  if (paddingDiff > 12) {
    return false;
  }

  // 6. Compare font size (size variants differ here, be very forgiving)
  const fontSize1 = parseFloat(styles1.fontSize || '14') || 14;
  const fontSize2 = parseFloat(styles2.fontSize || '14') || 14;
  const fontDiff = Math.abs(fontSize1 - fontSize2);

  // Small buttons (10-12px) vs Medium (14-16px) vs Large (18-20px) should merge
  if (fontDiff > 6) {
    return false;
  }

  // If fonts are significantly different (>4px), require closer padding match
  if (fontDiff > 4 && paddingDiff > 6) {
    return false;
  }

  // All checks passed - these buttons are similar!
  return true;
}

/**
 * Extracts button components with variants using visual similarity merging.
 *
 * This function scans the entire page for button-like elements (button tags, elements
 * with button roles, links styled as buttons, and submit/button inputs) and extracts
 * their visual styles. It then groups visually similar buttons together using the
 * areButtonsSimilar comparison function, counting how many instances of each variant
 * appear on the page.
 *
 * The function intelligently merges buttons that are the same semantic variant
 * (e.g., primary, secondary, ghost) even if they have minor styling differences
 * due to size variations or responsive design.
 *
 * Button selectors include:
 * - `<button>` elements
 * - Elements with `role="button"`
 * - Links with "btn" or "button" in their class names
 * - Input elements of type "submit" or "button"
 *
 * @returns Array of unique button variants sorted by frequency (most common first),
 *          limited to the top 5 most prevalent button styles
 *
 * @example
 * ```typescript
 * const buttons = extractButtons();
 * // Returns: [
 * //   { variant: 'primary', count: 15, styles: {...}, ... },
 * //   { variant: 'secondary', count: 8, styles: {...}, ... },
 * //   ...
 * // ]
 * ```
 */
export function extractButtons(): ButtonComponent[] {
  const buttons: ButtonComponent[] = [];

  const buttonSelectors = 'button, [role="button"], a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]';
  const elements = document.querySelectorAll(buttonSelectors);

  elements.forEach(btn => {
    const styles = getComputedStyle(btn);

    // Get font size from the actual text content, not the button wrapper
    const textFontSize = getButtonTextFontSize(btn as HTMLElement);

    const componentStyles: ComponentStyles = {
      background: styles.backgroundColor,
      color: styles.color,
      padding: styles.padding,
      borderRadius: styles.borderRadius,
      fontSize: textFontSize,
      fontWeight: styles.fontWeight,
      border: styles.border,
      boxShadow: styles.boxShadow,
      display: styles.display,
      height: styles.height
    };

    const newButton: ButtonComponent = {
      html: getCleanHTML(btn as HTMLElement),
      classes: (btn as HTMLElement).className || '',
      styles: componentStyles,
      variant: inferVariant(btn as HTMLElement),
      count: 1,
      stateStyles: extractStateStyles(btn as HTMLElement)
    };

    // Check if this button is similar to any existing button
    let foundSimilar = false;
    for (const existingButton of buttons) {
      if (areButtonsSimilar(newButton, existingButton)) {
        existingButton.count++;
        foundSimilar = true;
        break;
      }
    }

    // If no similar button found, add this as a new variant
    if (!foundSimilar) {
      buttons.push(newButton);
    }
  });

  return buttons.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Extracts accordion and collapsible components from the page.
 *
 * Scans for accordion patterns including custom accordion implementations,
 * collapsible sections, and native HTML `<details>` elements. Groups similar
 * accordions together based on their visual styling.
 *
 * This function is useful for identifying expandable/collapsible UI patterns
 * commonly used for FAQs, navigation menus, and content organization.
 *
 * Accordion selectors include:
 * - Elements with "accordion" in their class name
 * - Elements with "collapse" in their class name
 * - Native `<details>` elements
 *
 * @returns Array of unique accordion variants sorted by frequency (most common first),
 *          limited to the top 3 most prevalent accordion styles
 *
 * @example
 * ```typescript
 * const accordions = extractAccordions();
 * // Returns: [
 * //   { variant: 'accordion', count: 5, styles: {...}, ... },
 * //   ...
 * // ]
 * ```
 */
export function extractAccordions(): Component[] {
  const accordions: Component[] = [];
  const seen = new Map<string, Component>();

  const accordionSelectors = '[class*="accordion"], [class*="collapse"], details';
  const elements = document.querySelectorAll(accordionSelectors);

  elements.forEach(accordion => {
    const styles = getComputedStyle(accordion);
    const el = accordion as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding
      };

      const variant: Component = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'accordion',
        count: 1
      };

      accordions.push(variant);
      seen.set(signature, variant);
    }
  });

  return accordions.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts progress indicators and loading spinners from the page.
 *
 * Identifies both progress bar components (linear progress indicators) and
 * spinner/loader components (circular or animated loading indicators). This
 * function is useful for cataloging loading states and progress feedback patterns.
 *
 * Progress selectors include:
 * - Elements with `role="progressbar"`
 * - Native `<progress>` elements
 * - Elements with "progress", "spinner", or "loader" in their class names
 *
 * The function distinguishes between progress bars and spinners based on
 * class names, categorizing them appropriately.
 *
 * @returns Array of unique progress/spinner variants sorted by frequency (most common first),
 *          limited to the top 3 most prevalent progress indicator styles
 *
 * @example
 * ```typescript
 * const progressIndicators = extractProgress();
 * // Returns: [
 * //   { variant: 'progress-bar', count: 3, styles: {...}, ... },
 * //   { variant: 'spinner', count: 2, styles: {...}, ... },
 * //   ...
 * // ]
 * ```
 */
export function extractProgress(): ProgressComponent[] {
  const progress: ProgressComponent[] = [];
  const seen = new Map<string, ProgressComponent>();

  const progressSelectors = '[role="progressbar"], progress, [class*="progress"], [class*="spinner"], [class*="loader"]';
  const elements = document.querySelectorAll(progressSelectors);

  elements.forEach(prog => {
    const styles = getComputedStyle(prog);
    const el = prog as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        color: styles.color,
        height: styles.height,
        width: styles.width,
        borderRadius: styles.borderRadius
      };

      const isSpinner = el.className.toLowerCase().includes('spinner') ||
                       el.className.toLowerCase().includes('loader');

      const variant: ProgressComponent = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: isSpinner ? 'spinner' : 'progress-bar',
        count: 1
      };

      progress.push(variant);
      seen.set(signature, variant);
    }
  });

  return progress.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Converts a color string (rgb, rgba, hex, oklch, oklab, hsl, etc.) to RGB components.
 *
 * Uses browser's color computation for formats like oklch/oklab that require complex conversion.
 *
 * @param color - Color string in any CSS format
 * @returns RGB components or null if parsing fails
 */
function parseColorToRGB(color: string): { r: number; g: number; b: number } | null {
  // Handle rgb/rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3])
    };
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }
  }

  // Handle transparent
  if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return { r: 0, g: 0, b: 0 };
  }

  // Handle OKLCH manually
  if (color.includes('oklch')) {
    const result = parseOKLCH(color);
    if (result) {
      return result;
    }
  }

  // Handle OKLAB manually
  if (color.includes('oklab')) {
    const result = parseOKLAB(color);
    if (result) {
      return result;
    }
  }

  // Handle hsl and other CSS color formats - try browser conversion
  if (color.includes('hsl') || color.includes('lab')) {
    try {
      // Try Method 1: Use canvas fillStyle (most reliable for color conversion)
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = color;
          const computedStyle = ctx.fillStyle;

          // Check if it was actually converted
          if (computedStyle !== color && computedStyle.startsWith('#')) {
            // Canvas returns hex, parse it
            return parseColorToRGB(computedStyle);
          }
        }
      } catch (e) {
        // Canvas method failed, continue to DOM method
      }

      // Try Method 2: Use DOM element with color property
      const tempDiv = document.createElement('div');
      tempDiv.style.display = 'none';
      tempDiv.style.color = color;
      document.body.appendChild(tempDiv);

      const computed = getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);

      // Check if browser actually converted the color (prevent infinite recursion)
      if (computed === color) {
        return null;
      }

      // Recursively parse the computed rgb value
      return parseColorToRGB(computed);
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Convert OKLAB to Linear RGB.
 *
 * @param L - Lightness component
 * @param a - Green-red component
 * @param b - Blue-yellow component
 * @returns Linear RGB components
 */
function oklabToLinearRGB(L: number, a: number, b: number): { r: number; g: number; b: number } {
  // OKLAB to LMS
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;

  // LMS to Linear RGB
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  return { r, g: g, b: b2 };
}

/**
 * Convert Linear RGB to sRGB (gamma correction).
 *
 * @param linear - Linear RGB component value
 * @returns sRGB component value
 */
function linearRGBToSRGB(linear: number): number {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  } else {
    return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  }
}

/**
 * Parse OKLCH color format: oklch(L C H) or oklch(L C H / alpha).
 *
 * @param color - OKLCH color string
 * @returns RGB components or null if parsing fails
 */
function parseOKLCH(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return null;

  const L = parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const H = parseFloat(match[3]);

  // OKLCH to OKLAB
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLAB to Linear RGB
  const linearRGB = oklabToLinearRGB(L, a, b);

  // Linear RGB to sRGB
  const r = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.r) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.g) * 255)));
  const b2 = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.b) * 255)));

  return { r, g, b: b2 };
}

/**
 * Parse OKLAB color format: oklab(L a b) or oklab(L a b / alpha).
 *
 * @param color - OKLAB color string
 * @returns RGB components or null if parsing fails
 */
function parseOKLAB(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(/oklab\(([\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
  if (!match) return null;

  const L = parseFloat(match[1]);
  const a = parseFloat(match[2]);
  const b = parseFloat(match[3]);

  // OKLAB to Linear RGB
  const linearRGB = oklabToLinearRGB(L, a, b);

  // Linear RGB to sRGB
  const r = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.r) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.g) * 255)));
  const b2 = Math.round(Math.max(0, Math.min(255, linearRGBToSRGB(linearRGB.b) * 255)));

  return { r, g, b: b2 };
}

/**
 * Creates a unique signature for an element based on key styles.
 *
 * Rounds padding to nearest 16px to group similar variants together.
 *
 * @param element - HTML element to create signature for
 * @returns Unique style signature string
 */
function createStyleSignature(element: HTMLElement): string {
  const styles = getComputedStyle(element);

  // Round padding to nearest 16px to group variants with minor padding differences
  const paddingLeft = Math.round(parseInt(styles.paddingLeft) / 16) * 16;
  const paddingTop = Math.round(parseInt(styles.paddingTop) / 16) * 16;

  return `${styles.backgroundColor}-${styles.color}-${styles.borderRadius}-${paddingLeft}px-${paddingTop}px-${styles.fontSize}-${styles.fontWeight}`;
}

/**
 * Extracts interactive state styles (hover, focus, active, disabled) from CSS and element.
 *
 * @param element - HTML element to extract state styles from
 * @returns State styles object or undefined if no state styles found
 */
function extractStateStyles(element: HTMLElement): StateStyles | undefined {
  const states: Record<string, Record<string, string | boolean>> = {};

  // Try to get state styles from CSS rules matching this element
  try {
    const matchingRules = getMatchingCSSRules(element);

    matchingRules.forEach((rule: CSSStyleRule) => {
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
  } catch (e) {
    // Fallback: check for Tailwind-style utility classes
    const classes = Array.from(element.classList);

    // Extract hover states
    const hoverClasses = classes.filter(c => c.includes('hover:'));
    if (hoverClasses.length > 0) {
      states.hover = { utilityClasses: hoverClasses.join(' ') };
    }

    // Extract focus states
    const focusClasses = classes.filter(c => c.includes('focus:'));
    if (focusClasses.length > 0) {
      states.focus = { utilityClasses: focusClasses.join(' ') };
    }

    // Extract disabled states
    const disabledClasses = classes.filter(c => c.includes('disabled:'));
    if (disabledClasses.length > 0) {
      states.disabled = { utilityClasses: disabledClasses.join(' ') };
    }
  }

  // Check if element is actually disabled
  if (element.hasAttribute('disabled')) {
    if (!states.disabled) states.disabled = {};
    states.disabled.isDisabled = true;
  }

  return Object.keys(states).length > 0 ? (states as StateStyles) : undefined;
}

/**
 * Infers button variant from classes and styles with improved heuristics.
 *
 * Analyzes class names, computed styles, and text content to determine the
 * semantic variant of a button (primary, secondary, danger, etc.) and its
 * size variant (small, medium, large).
 *
 * Variant detection priority:
 * 1. Explicit variant class names (primary, secondary, ghost, etc.)
 * 2. Visual characteristics (background color, border, transparency)
 * 3. Text content hints (delete, confirm, etc.)
 *
 * @param button - Button element to analyze
 * @returns Inferred variant string (e.g., 'primary', 'outline-small', 'danger-large')
 */
function inferVariant(button: HTMLElement): string {
  const classes = button.className.toLowerCase();
  const styles = getComputedStyle(button);
  const text = button.textContent?.toLowerCase() || '';

  // Priority 1: Check explicit variant classes
  if (classes.includes('primary')) return 'primary';
  if (classes.includes('secondary')) return 'secondary';
  if (classes.includes('tertiary')) return 'tertiary';
  if (classes.includes('ghost') || classes.includes('outline')) return 'outline';

  // Semantic variants
  if (classes.includes('danger') || classes.includes('destructive') || classes.includes('error')) return 'danger';
  if (classes.includes('success')) return 'success';
  if (classes.includes('warning') || classes.includes('caution')) return 'warning';
  if (classes.includes('info')) return 'info';

  // Link-style buttons
  if (classes.includes('link') || classes.includes('text-button')) return 'link';

  // Size variants (track separately from style variants)
  const sizeVariant = inferSizeVariant(button, styles);

  // Priority 2: Analyze visual characteristics
  const bg = styles.backgroundColor;
  const border = styles.border;
  const borderWidth = parseFloat(styles.borderWidth) || 0;
  const textDecoration = styles.textDecoration;

  // Ghost/outline variants (transparent/minimal background)
  const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
  if (isTransparent) {
    // Check if has border = outline button
    if (borderWidth > 0 && border !== 'none') {
      return sizeVariant ? `outline-${sizeVariant}` : 'outline';
    }

    // Check text color to differentiate link vs ghost
    const textColor = styles.color;
    const textRgb = parseColorToRGB(textColor);

    if (textRgb) {
      const isBlueText = textRgb.b > 150 && textRgb.b > textRgb.r + 30 && textRgb.b > textRgb.g + 30;
      const isPrimaryColorText = textRgb.b > textRgb.r + 50 || textRgb.r > 200; // Blue or red links

      // Blue/colored text with transparent bg = link button
      if (isBlueText || isPrimaryColorText || textDecoration.includes('underline')) {
        return 'link';
      }
    }

    // Otherwise it's a ghost button
    return 'ghost';
  }

  // Priority 3: Analyze background color brightness/saturation for variant type
  const rgb = parseColorToRGB(bg);
  if (rgb) {
    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    const isReddish = rgb.r > rgb.g + 30 && rgb.r > rgb.b + 30;
    const isGreenish = rgb.g > rgb.r + 30 && rgb.g > rgb.b + 30;
    const isYellowish = rgb.r > 180 && rgb.g > 180 && rgb.b < 100;
    const isBlueish = rgb.b > rgb.r + 30 && rgb.b > rgb.g + 30;

    // Detect semantic colors
    if (isReddish && rgb.r > 180) return sizeVariant ? `danger-${sizeVariant}` : 'danger';
    if (isGreenish && rgb.g > 180) return sizeVariant ? `success-${sizeVariant}` : 'success';
    if (isYellowish) return sizeVariant ? `warning-${sizeVariant}` : 'warning';
    if (isBlueish && rgb.b > 180) return sizeVariant ? `info-${sizeVariant}` : 'info';

    // High saturation and brightness = primary
    const saturation = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
    if (saturation > 50 && brightness > 100) {
      return sizeVariant ? `primary-${sizeVariant}` : 'primary';
    }

    // Low saturation = secondary/muted
    if (saturation < 30 || brightness < 100) {
      return sizeVariant ? `secondary-${sizeVariant}` : 'secondary';
    }
  }

  // Priority 4: Check text content for hints
  if (text.includes('delete') || text.includes('remove') || text.includes('cancel')) {
    return 'danger';
  }
  if (text.includes('confirm') || text.includes('submit') || text.includes('save')) {
    return 'primary';
  }

  return sizeVariant ? `default-${sizeVariant}` : 'default';
}

/**
 * Infers button size variant from padding and font size.
 *
 * Categorizes buttons into small, medium, or large based on their padding
 * and font size values.
 *
 * @param _button - Button element (unused, kept for API consistency)
 * @param styles - Computed styles of the button
 * @returns Size variant string ('small', 'medium', 'large') or null for default
 */
function inferSizeVariant(_button: HTMLElement, styles: CSSStyleDeclaration): string | null {
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const fontSize = parseFloat(styles.fontSize) || 14;

  // Calculate average padding
  const avgPadding = (paddingTop + paddingLeft) / 2;

  // Size classification
  if (avgPadding <= 6 || fontSize <= 12) {
    return 'small';
  } else if (avgPadding >= 16 || fontSize >= 18) {
    return 'large';
  } else if (avgPadding >= 12 && avgPadding < 16) {
    return 'medium';
  }

  // Default medium range - don't add suffix
  return null;
}

/**
 * Helper function to get matching CSS rules for an element.
 * This is imported from styleHelpers but TypeScript needs the declaration.
 */
declare function getMatchingCSSRules(element: HTMLElement): CSSStyleRule[];

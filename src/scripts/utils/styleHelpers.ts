/**
 * Style Helper Functions
 * Collection of utility functions for style extraction and CSS manipulation
 */

/**
 * Converts OKLAB color space values to Linear RGB color space.
 * OKLAB is a perceptually uniform color space designed for image processing.
 * This function performs the transformation through the LMS intermediate color space.
 *
 * @param L - Lightness component (0-1 range)
 * @param a - Green-red axis component
 * @param b - Blue-yellow axis component
 * @returns Object containing linear RGB values (not gamma-corrected)
 * @example
 * const linearRGB = oklabToLinearRGB(0.5, 0.1, -0.2);
 * // Returns { r: 0.234, g: 0.567, b: 0.890 }
 */
export function oklabToLinearRGB(L: number, a: number, b: number): { r: number; g: number; b: number } {
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
 * Converts a linear RGB component value to sRGB (gamma-corrected) color space.
 * Applies the sRGB gamma correction curve which makes the colors suitable for display on screens.
 *
 * @param linear - Linear RGB component value (0-1 range)
 * @returns Gamma-corrected sRGB value (0-1 range)
 * @example
 * const srgb = linearRGBToSRGB(0.5);
 * // Returns ~0.735 (after gamma correction)
 */
export function linearRGBToSRGB(linear: number): number {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  } else {
    return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  }
}

/**
 * Parses an OKLCH color string and converts it to RGB values.
 * OKLCH uses cylindrical coordinates (Lightness, Chroma, Hue) which makes it intuitive for color selection.
 * Supports both alpha and non-alpha formats.
 *
 * @param color - Color string in OKLCH format (e.g., "oklch(0.5 0.2 180)" or "oklch(0.5 0.2 180 / 0.8)")
 * @returns Object with RGB components (0-255 range) or null if parsing fails
 * @example
 * const rgb = parseOKLCH("oklch(0.5 0.2 180)");
 * // Returns { r: 123, g: 145, b: 167 }
 */
export function parseOKLCH(color: string): { r: number; g: number; b: number } | null {
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
 * Parses an OKLAB color string and converts it to RGB values.
 * OKLAB is a perceptually uniform color space where equal distances represent equal visual differences.
 * Supports both alpha and non-alpha formats.
 *
 * @param color - Color string in OKLAB format (e.g., "oklab(0.5 0.1 -0.2)" or "oklab(0.5 0.1 -0.2 / 0.8)")
 * @returns Object with RGB components (0-255 range) or null if parsing fails
 * @example
 * const rgb = parseOKLAB("oklab(0.5 0.1 -0.2)");
 * // Returns { r: 100, g: 130, b: 160 }
 */
export function parseOKLAB(color: string): { r: number; g: number; b: number } | null {
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
 * Converts any CSS color string to RGB components.
 * Handles multiple color formats: rgb/rgba, hex, oklch, oklab, hsl, and named colors.
 * Uses browser's native color computation for complex formats as a fallback.
 *
 * @param color - CSS color string in any valid format
 * @returns Object with RGB components (0-255 range) or null if parsing fails
 * @example
 * parseColorToRGB("#ff5733"); // Returns { r: 255, g: 87, b: 51 }
 * parseColorToRGB("rgb(255, 87, 51)"); // Returns { r: 255, g: 87, b: 51 }
 * parseColorToRGB("oklch(0.6 0.2 30)"); // Returns { r: ..., g: ..., b: ... }
 * parseColorToRGB("transparent"); // Returns { r: 0, g: 0, b: 0 }
 */
export function parseColorToRGB(color: string): { r: number; g: number; b: number } | null {
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
 * Calculates the perceptual distance between two colors using Euclidean distance in RGB space.
 * Useful for determining if two colors are similar enough to be considered the same in theming.
 * The distance is normalized to a 0-1 scale where 0 means identical and 1 means maximally different.
 *
 * @param color1 - First color in any CSS color format
 * @param color2 - Second color in any CSS color format
 * @returns Normalized distance value (0-1 range). Returns 0 for identical colors, 1 for unparseable but different strings
 * @example
 * calculateColorDistance("#ff0000", "rgb(255, 0, 0)"); // Returns 0 (identical)
 * calculateColorDistance("#ff0000", "#00ff00"); // Returns ~0.52 (quite different)
 * calculateColorDistance("#ffffff", "#000000"); // Returns 1 (maximum difference)
 */
export function calculateColorDistance(color1: string, color2: string): number {
  const rgb1 = parseColorToRGB(color1);
  const rgb2 = parseColorToRGB(color2);

  if (!rgb1 || !rgb2) {
    // If we can't parse, consider them different
    return color1 === color2 ? 0 : 1;
  }

  // Calculate Euclidean distance in RGB space
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;

  const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

  // Normalize to 0-1 (max distance is sqrt(255^2 + 255^2 + 255^2) ≈ 441.67)
  return distance / 441.67;
}

/**
 * Extracts the theme variant (light or dark) from a CSS selector string.
 * Detects common patterns for dark mode selectors including classes and data attributes.
 *
 * @param selector - CSS selector string (e.g., ".dark .button", "[data-theme='dark'] button")
 * @returns Theme identifier - either "dark" or "light" (defaults to "light" if no dark theme indicators found)
 * @example
 * getThemeFromSelector(".dark .container"); // Returns "dark"
 * getThemeFromSelector("[data-theme='dark'] .button"); // Returns "dark"
 * getThemeFromSelector(".button"); // Returns "light"
 */
export function getThemeFromSelector(selector: string): string {
  const lower = selector.toLowerCase();

  if (lower.includes('.dark') ||
      lower.includes('[data-theme="dark"]') ||
      lower.includes('[data-theme=\'dark\']') ||
      lower.includes('[theme="dark"]') ||
      lower.includes('.theme-dark')) {
    return 'dark';
  }

  return 'light';
}

/**
 * Normalizes color strings to a consistent format for comparison.
 * Converts rgba colors with alpha=1 to rgb format, preserves hex colors unchanged.
 *
 * @param color - Color string in rgb, rgba, or hex format
 * @returns Normalized color string (removes unnecessary alpha channel, formats consistently)
 * @example
 * normalizeColor("rgba(255, 0, 0, 1)"); // Returns "rgb(255, 0, 0)"
 * normalizeColor("rgba(255, 0, 0, 0.5)"); // Returns "rgba(255, 0, 0, 0.5)"
 * normalizeColor("#ff0000"); // Returns "#ff0000"
 */
export function normalizeColor(color: string): string {
  if (color.startsWith('#')) return color;

  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const alpha = a !== undefined ? parseFloat(a) : 1;

    if (alpha === 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

/**
 * Generates a simplified HTML representation of an element for debugging and analysis.
 * Truncates deeply nested structures and long text content to keep output concise.
 * Ensures the output stays under 400 characters while preserving essential structure.
 *
 * @param element - HTML element to convert to clean string representation
 * @returns Simplified HTML string (max 400 chars) with truncated content where necessary
 * @example
 * const div = document.querySelector('.complex-element');
 * getCleanHTML(div);
 * // Returns: '<div class="complex-element">Some text content...</div>'
 */
export function getCleanHTML(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // Simplify deeply nested elements
  if (clone.children.length > 3) {
    const textContent = clone.textContent?.trim().substring(0, 40) || '';
    clone.innerHTML = textContent + (textContent.length >= 40 ? '...' : '');
  } else if (clone.children.length > 0) {
    // Keep simple children but limit their content
    Array.from(clone.children).forEach((child, idx) => {
      if (idx > 2) {
        child.remove();
      } else if (child.children.length > 0) {
        const text = child.textContent?.trim().substring(0, 30) || '';
        child.innerHTML = text;
      }
    });
  }

  let html = clone.outerHTML;

  // Ensure it's under 400 chars
  if (html.length > 400) {
    const openingTag = html.match(/^<[^>]+>/)?.[0] || '';
    const closingTag = html.match(/<\/[^>]+>$/)?.[0] || '';
    const tagName = element.tagName.toLowerCase();

    if (openingTag && closingTag) {
      const content = clone.textContent?.trim().substring(0, 30) || '';
      html = `${openingTag}${content}...${closingTag}`;
    } else {
      html = `<${tagName} class="${element.className.substring(0, 100)}">${clone.textContent?.substring(0, 30) || ''}...</${tagName}>`;
    }
  }

  return html;
}

/**
 * Retrieves all CSS rules from stylesheets that match an element and include pseudo-class selectors.
 * Specifically targets rules with :hover, :focus, :active, and :disabled states.
 * Ignores cross-origin stylesheets and invalid selectors.
 *
 * @param element - HTML element to find matching CSS rules for
 * @returns Array of CSSStyleRule objects that match the element and contain pseudo-class selectors
 * @example
 * const button = document.querySelector('button');
 * const rules = getMatchingCSSRules(button);
 * // Returns: [CSSStyleRule { selectorText: "button:hover", ... }, ...]
 */
export function getMatchingCSSRules(element: HTMLElement): CSSStyleRule[] {
  const rules: CSSStyleRule[] = [];

  try {
    const sheets = Array.from(document.styleSheets);

    sheets.forEach(sheet => {
      try {
        const cssRules = Array.from(sheet.cssRules || sheet.rules || []);

        cssRules.forEach(rule => {
          if (rule instanceof CSSStyleRule) {
            const selectorText = rule.selectorText;

            // Check if selector matches this element (ignoring pseudo-classes for matching)
            const baseSelector = selectorText.replace(/:(hover|focus|active|disabled|visited|checked)/g, '');

            try {
              if (element.matches(baseSelector)) {
                // Include rules with pseudo-classes
                if (selectorText.includes(':hover') ||
                    selectorText.includes(':focus') ||
                    selectorText.includes(':active') ||
                    selectorText.includes(':disabled')) {
                  rules.push(rule);
                }
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
        });
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    });
  } catch (e) {
    // Error accessing stylesheets
  }

  return rules;
}

/**
 * Extracts the first numeric value from a CSS padding string.
 * Useful for getting the top/uniform padding value from shorthand notation.
 *
 * @param padding - CSS padding value string (e.g., "10px", "10px 20px", "10px 20px 30px 40px")
 * @returns First padding value as a number (without unit), or 0 if parsing fails
 * @example
 * parsePaddingValue("10px 20px"); // Returns 10
 * parsePaddingValue("15px"); // Returns 15
 * parsePaddingValue("1em 2em 3em 4em"); // Returns 1
 */
export function parsePaddingValue(padding: string): number {
  const parts = padding.split(' ');
  const firstValue = parseFloat(parts[0]) || 0;
  return firstValue;
}

/**
 * Intelligently extracts the actual font size of text content within a button element.
 * Buttons often have different font sizes on wrapper vs. inner text elements.
 * Searches through child elements to find the actual text-bearing element and its font size.
 *
 * @param button - Button HTML element to analyze
 * @returns Font size string with unit (e.g., "16px") representing the actual text size
 * @example
 * const button = document.querySelector('button');
 * getButtonTextFontSize(button); // Returns "14px" (size of text content, not wrapper)
 */
export function getButtonTextFontSize(button: HTMLElement): string {
  // First try: find the first text-bearing child element
  const textElements = button.querySelectorAll('div, span, a');
  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i] as HTMLElement;
    const text = el.textContent?.trim() || '';

    // Skip empty elements and icons
    if (text.length > 0 && text.length < 100 && !el.className.includes('icon')) {
      const styles = getComputedStyle(el);
      const fontSize = parseFloat(styles.fontSize);

      // Return if we found a reasonable font size
      if (fontSize >= 10 && fontSize <= 32) {
        return `${fontSize}px`;
      }
    }
  }

  // Fallback: if button has direct text content, use button's font size
  const buttonText = button.textContent?.trim() || '';
  if (buttonText.length > 0) {
    const buttonStyles = getComputedStyle(button);
    return buttonStyles.fontSize;
  }

  // Last resort: return button's font size
  return getComputedStyle(button).fontSize;
}

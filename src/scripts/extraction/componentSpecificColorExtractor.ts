/**
 * Component-Specific Color Extractor
 *
 * Extracts colors used by specific component types (buttons, icons, navigation, etc.)
 * This is critical for CSS-in-JS sites where colors are applied via computed styles
 * rather than semantic class names.
 *
 * For each component type, we extract:
 * - Background colors
 * - Text colors
 * - Border colors
 * - Icon fill/stroke colors
 * - State colors (hover, focus, active)
 */

import { getCachedComputedStyle } from '../utils/domCache';
import { normalizeColor } from '../utils/styleHelpers';

/**
 * Color usage for a specific component variant
 */
export interface ComponentColorUsage {
  component: string;
  variant: string;
  count: number;
  colors: {
    background?: string;
    text?: string;
    border?: string;
    iconFill?: string;
    iconStroke?: string;
    hoverBackground?: string;
    hoverText?: string;
    hoverBorder?: string;
    focusBorder?: string;
    focusOutline?: string;
  };
  measurements?: {
    height?: number;
    minWidth?: number;
    padding?: string;
    borderRadius?: string;
    borderWidth?: string;
    fontSize?: string;
    fontWeight?: string;
  };
}

/**
 * Complete component-specific color extraction
 */
export interface ComponentSpecificColors {
  buttons: ComponentColorUsage[];
  navigation: ComponentColorUsage[];
  icons: ComponentColorUsage[];
  inputs: ComponentColorUsage[];
  cards: ComponentColorUsage[];
  allComponentColors: Map<string, number>; // All unique colors across components
}

/**
 * Identifies button elements using multiple strategies
 */
function identifyButtons(): Element[] {
  // Strategy 1: Semantic HTML
  const semanticButtons = Array.from(document.querySelectorAll('button'));

  // Strategy 2: ARIA roles
  const ariaButtons = Array.from(document.querySelectorAll('[role="button"]'));

  // Strategy 3: Data attributes
  const dataButtons = Array.from(document.querySelectorAll(
    '[data-testid*="button"], [data-test*="button"], [data-cy*="button"]'
  ));

  // Strategy 4: Input buttons
  const inputButtons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"]'));

  // Strategy 5: Links styled as buttons (must have button-like styling)
  const linkButtons = Array.from(document.querySelectorAll('a')).filter(link => {
    const styles = getCachedComputedStyle(link);
    const hasBg = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent';
    const hasBorder = parseFloat(styles.borderWidth) > 0;
    const hasPadding = parseFloat(styles.paddingLeft) >= 8 && parseFloat(styles.paddingRight) >= 8;
    const hasRadius = parseFloat(styles.borderRadius) >= 2;

    // Must have at least 2 button-like characteristics
    const buttonFeatures = [hasBg, hasBorder, hasPadding, hasRadius].filter(Boolean).length;
    return buttonFeatures >= 2;
  });

  // Combine and deduplicate
  const allButtons = new Set([
    ...semanticButtons,
    ...ariaButtons,
    ...dataButtons,
    ...inputButtons,
    ...linkButtons,
  ]);

  // Filter out navigation links and hidden elements
  return Array.from(allButtons).filter(btn => {
    // Skip if inside navigation (unless it has button role/tag)
    const isNav = btn.closest('nav, [role="navigation"]');
    if (isNav && btn.tagName !== 'BUTTON' && btn.getAttribute('role') !== 'button') {
      return false;
    }

    // Skip if hidden
    const styles = getCachedComputedStyle(btn);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }

    // Skip if too small (likely not a real button)
    const rect = btn.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 16) {
      return false;
    }

    return true;
  });
}

/**
 * Creates a visual signature for grouping similar components
 */
function createColorSignature(colors: ComponentColorUsage['colors']): string {
  const parts = [
    colors.background || 'none',
    colors.text || 'none',
    colors.border || 'none',
  ];
  return parts.join('|');
}

/**
 * Checks if a color is transparent
 */
function isColorTransparent(colorStr: string): boolean {
  if (!colorStr) return true;
  if (colorStr === 'transparent') return true;
  if (colorStr === 'rgba(0, 0, 0, 0)') return true;

  // Check rgba with 0 alpha
  const rgbaMatch = colorStr.match(/rgba?\([^)]+,\s*(\d*\.?\d+)\)/);
  if (rgbaMatch && parseFloat(rgbaMatch[1]) === 0) return true;

  return false;
}

/**
 * Infers button variant from visual characteristics
 */
function inferButtonVariant(element: Element): string {
  const styles = getCachedComputedStyle(element);
  const bg = styles.backgroundColor;
  const borderColor = styles.borderColor;
  const borderWidth = styles.borderWidth;

  // Check data attributes for variant hints
  const dataVariant = element.getAttribute('data-variant') ||
                     element.getAttribute('data-type') ||
                     element.getAttribute('data-kind');
  if (dataVariant) {
    const variant = dataVariant.toLowerCase();
    if (['primary', 'secondary', 'default', 'outline', 'ghost', 'danger', 'success'].includes(variant)) {
      return variant;
    }
  }

  // Check class names for variant hints (safely handle SVGAnimatedString)
  const className = String(element.className || '').toLowerCase();
  if (className.includes('primary')) return 'primary';
  if (className.includes('secondary')) return 'secondary';
  if (className.includes('danger') || className.includes('destructive')) return 'danger';
  if (className.includes('success')) return 'success';
  if (className.includes('outline')) return 'outline';
  if (className.includes('ghost') || className.includes('link')) return 'ghost';

  const bgIsTransparent = isColorTransparent(bg);
  const borderIsVisible = parseFloat(borderWidth) > 0 && !isColorTransparent(borderColor);

  // Ghost/outline buttons
  if (bgIsTransparent) {
    if (borderIsVisible) {
      return 'outline';
    }
    return 'ghost';
  }

  // Analyze background color for variant - support RGB, RGBA, and LCH
  let r = 0, g = 0, b = 0;

  // Try RGB/RGBA
  const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1]);
    g = parseInt(rgbMatch[2]);
    b = parseInt(rgbMatch[3]);
  } else {
    // Try LCH format: lch(L C H)
    const lchMatch = bg.match(/lch\([\d.]+\s+[\d.]+\s+([\d.]+)\)/);
    if (lchMatch) {
      const hue = parseFloat(lchMatch[1]);
      // Hue-based variant detection for LCH colors
      // Red: 0-60, Orange: 60-90, Yellow: 90-120, Green: 120-180
      // Cyan: 180-240, Blue: 240-270, Purple/Magenta: 270-330, Red: 330-360
      if (hue >= 0 && hue < 60) return 'danger';
      if (hue >= 120 && hue < 180) return 'success';
      if (hue >= 240 && hue < 330) return 'primary'; // Blue to purple range

      // Check lightness for grayscale detection
      const lightnessMatch = bg.match(/lch\(([\d.]+)/);
      if (lightnessMatch) {
        const lightness = parseFloat(lightnessMatch[1]);
        if (lightness > 80) return 'secondary';
        if (lightness < 30) return 'dark';
      }
      return 'default';
    }
  }

  // RGB-based variant detection
  if (rgbMatch) {
    const brightness = (r + g + b) / 3;
    const isReddish = r > g + 30 && r > b + 30;
    const isGreenish = g > r + 30 && g > b + 30;
    const isBlueish = b > r + 20 && b > g + 20;
    const isPurplish = (r > 80 && b > 80 && Math.abs(r - b) < 50 && g < r - 20) ||
                       (r > 100 && b > 100 && g < r - 30);

    if (isReddish && r > 150) return 'danger';
    if (isGreenish && g > 150) return 'success';
    if (isPurplish) return 'primary'; // Improved purple detection
    if (isBlueish) return 'primary';

    // Grayscale buttons
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    if (saturation < 30) {
      if (brightness > 180) return 'secondary';
      if (brightness < 80) return 'dark';
      return 'default';
    }
  }

  return 'default';
}

/**
 * Calculates color similarity (0 = identical, higher = more different)
 * Normalizes both colors to RGB before comparison for accurate distance calculation
 */
function colorDistance(color1: string | undefined, color2: string | undefined): number {
  if (!color1 || !color2) return color1 === color2 ? 0 : 100;
  if (color1 === color2) return 0;

  // Normalize both colors to RGB format for consistent comparison
  const normalized1 = normalizeColor(color1);
  const normalized2 = normalizeColor(color2);

  // Extract RGB components
  const extractRGB = (color: string): number[] => {
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }
    return [0, 0, 0];
  };

  const rgb1 = extractRGB(normalized1);
  const rgb2 = extractRGB(normalized2);

  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

/**
 * Checks if two button variants are similar enough to merge
 */
function areVariantsSimilar(v1: ComponentColorUsage, v2: ComponentColorUsage): boolean {
  // Must have same semantic variant
  if (v1.variant !== v2.variant) return false;

  // Calculate color distances (in RGB space after normalization)
  const bgDist = colorDistance(v1.colors.background, v2.colors.background);
  const textDist = colorDistance(v1.colors.text, v2.colors.text);
  const borderDist = colorDistance(v1.colors.border, v2.colors.border);

  // Thresholds for similarity in RGB space (0-255 scale)
  // Allow small variations to merge similar but not identical buttons
  const bgThreshold = 30;  // ~12% difference per channel
  const textThreshold = 50; // More lenient for text (minor shade differences acceptable)
  const borderThreshold = 30;

  return bgDist < bgThreshold && textDist < textThreshold && borderDist < borderThreshold;
}

/**
 * Merges two similar button variants
 */
function mergeVariants(v1: ComponentColorUsage, v2: ComponentColorUsage): ComponentColorUsage {
  // Use the variant with higher count as base
  const base = v1.count >= v2.count ? v1 : v2;
  const other = v1.count >= v2.count ? v2 : v1;

  return {
    ...base,
    count: v1.count + v2.count,
    // Merge hover states if either has them
    colors: {
      ...base.colors,
      hoverBackground: base.colors.hoverBackground || other.colors.hoverBackground,
      hoverText: base.colors.hoverText || other.colors.hoverText,
      hoverBorder: base.colors.hoverBorder || other.colors.hoverBorder,
      focusBorder: base.colors.focusBorder || other.colors.focusBorder,
      focusOutline: base.colors.focusOutline || other.colors.focusOutline,
    },
  };
}

/**
 * Extracts colors from button elements
 */
function extractButtonColors(buttons: Element[]): ComponentColorUsage[] {
  // First pass: Group buttons by exact signature and track all measurements
  const variantData = new Map<string, {
    usage: ComponentColorUsage;
    heights: number[];
    widths: number[];
  }>();

  for (const button of buttons) {
    const styles = getCachedComputedStyle(button);
    const rect = button.getBoundingClientRect();

    // Extract all color properties
    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' && !isColorTransparent(styles.borderColor)
        ? normalizeColor(styles.borderColor)
        : undefined,
    };

    // Extract icon colors if button contains SVG
    const svg = button.querySelector('svg');
    if (svg) {
      const svgStyles = getCachedComputedStyle(svg);
      if (svgStyles.fill && svgStyles.fill !== 'none') {
        colors.iconFill = normalizeColor(svgStyles.fill);
      }
      if (svgStyles.stroke && svgStyles.stroke !== 'none') {
        colors.iconStroke = normalizeColor(svgStyles.stroke);
      }
    }

    // Extract measurements - USE ACTUAL RENDERED VALUES
    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      minWidth: rect.width > 0 ? Math.round(rect.width) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
    };

    // Try to extract hover state from CSS rules
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText) {
              try {
                if (button.matches(rule.selectorText.replace(/:hover.*/, ''))) {
                  if (rule.selectorText.includes(':hover')) {
                    if (rule.style.backgroundColor) {
                      colors.hoverBackground = normalizeColor(rule.style.backgroundColor);
                    }
                    if (rule.style.color) {
                      colors.hoverText = normalizeColor(rule.style.color);
                    }
                    if (rule.style.borderColor) {
                      colors.hoverBorder = normalizeColor(rule.style.borderColor);
                    }
                  }
                  if (rule.selectorText.includes(':focus')) {
                    if (rule.style.borderColor) {
                      colors.focusBorder = normalizeColor(rule.style.borderColor);
                    }
                    if (rule.style.outline) {
                      colors.focusOutline = rule.style.outline;
                    }
                  }
                }
              } catch (e) {
                // Selector matching failed, skip
              }
            }
          }
        } catch (e) {
          // CORS error, skip this sheet
        }
      }
    } catch (e) {
      // Error accessing stylesheets
    }

    // Infer variant
    const variant = inferButtonVariant(button);

    // Create signature for grouping
    const signature = `${variant}|${createColorSignature(colors)}`;

    if (variantData.has(signature)) {
      const existing = variantData.get(signature)!;
      existing.usage.count++;
      if (measurements.height) existing.heights.push(measurements.height);
      if (measurements.minWidth) existing.widths.push(measurements.minWidth);
    } else {
      variantData.set(signature, {
        usage: {
          component: 'button',
          variant,
          count: 1,
          colors,
          measurements,
        },
        heights: measurements.height ? [measurements.height] : [],
        widths: measurements.minWidth ? [measurements.minWidth] : [],
      });
    }
  }

  // Calculate most common height/width for each variant
  for (const data of variantData.values()) {
    if (data.heights.length > 0) {
      // Find most common height
      const heightCounts = new Map<number, number>();
      data.heights.forEach(h => heightCounts.set(h, (heightCounts.get(h) || 0) + 1));
      const mostCommonHeight = Array.from(heightCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      data.usage.measurements!.height = mostCommonHeight;
    }
  }

  // Extract just the usages
  let variants = Array.from(variantData.values()).map(d => d.usage);

  // Apply fuzzy matching to merge similar variants
  const merged: ComponentColorUsage[] = [];
  const used = new Set<number>();

  for (let i = 0; i < variants.length; i++) {
    if (used.has(i)) continue;

    let current = variants[i];

    // Try to merge with other unused variants
    for (let j = i + 1; j < variants.length; j++) {
      if (used.has(j)) continue;

      if (areVariantsSimilar(current, variants[j])) {
        current = mergeVariants(current, variants[j]);
        used.add(j);
      }
    }

    merged.push(current);
    used.add(i);
  }

  // Return sorted by frequency, limited to top variants
  return merged
    .sort((a, b) => {
      // Sort by variant importance first (primary > default > outline > ghost > others)
      const variantOrder: Record<string, number> = {
        primary: 0,
        default: 1,
        outline: 2,
        ghost: 3,
        secondary: 4,
        danger: 5,
        success: 6,
      };
      const orderDiff = (variantOrder[a.variant] ?? 10) - (variantOrder[b.variant] ?? 10);
      if (orderDiff !== 0) return orderDiff;

      // Then by count
      return b.count - a.count;
    })
    .slice(0, 6); // Top 6 button variants
}

/**
 * Identifies navigation elements - EXCLUSIVELY from sidebar
 */
function identifyNavigation(): Element[] {
  // STRICT: Only sidebar navigation elements
  // Combine all sidebar selectors and only get interactive elements (a, button)
  const sidebarNavigation = Array.from(document.querySelectorAll(
    'aside a, aside button, ' +
    '[class*="sidebar"] a, [class*="sidebar"] button, ' +
    '[class*="sidenav"] a, [class*="sidenav"] button, ' +
    '[id*="sidebar"] a, [id*="sidebar"] button, ' +
    '[data-sidebar-section-type] a, [data-sidebar-section-type] button, ' +
    'nav[class*="side"] a, nav[class*="side"] button'
  ));

  // Deduplicate
  const seen = new Set<Element>();
  const deduplicated = sidebarNavigation.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });

  // Filter out hidden/tiny elements AND elements in header/footer
  return deduplicated.filter(item => {
    const styles = getCachedComputedStyle(item);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
    const rect = item.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return false;
    }

    // CRITICAL: Exclude nav links in header/footer (they pollute measurements)
    const inHeader = item.closest('header, [role="banner"]');
    const inFooter = item.closest('footer, [role="contentinfo"]');
    if (inHeader || inFooter) {
      return false;
    }

    // Must be in left 40% of viewport (sidebars are typically on the left)
    const isOnLeft = rect.left < window.innerWidth * 0.4;
    if (!isOnLeft) {
      return false;
    }

    return true;
  });
}

/**
 * Extracts colors from navigation elements
 */
function extractNavigationColors(navItems: Element[]): ComponentColorUsage[] {
  const variantData = new Map<string, {
    usage: ComponentColorUsage;
    heights: number[];
    paddings: string[];
    fontSizes: string[];
    fontWeights: string[];
  }>();

  for (const item of navItems) {
    const styles = getCachedComputedStyle(item);
    const rect = item.getBoundingClientRect();

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' && !isColorTransparent(styles.borderColor)
        ? normalizeColor(styles.borderColor)
        : undefined,
    };

    // Check for icon
    const svg = item.querySelector('svg');
    if (svg) {
      const svgStyles = getCachedComputedStyle(svg);
      if (svgStyles.fill && svgStyles.fill !== 'none') {
        colors.iconFill = normalizeColor(svgStyles.fill);
      }
    }

    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
    };

    const signature = createColorSignature(colors);

    if (variantData.has(signature)) {
      const existing = variantData.get(signature)!;
      existing.usage.count++;
      if (measurements.height) existing.heights.push(measurements.height);
      if (measurements.padding) existing.paddings.push(measurements.padding);
      if (measurements.fontSize) existing.fontSizes.push(measurements.fontSize);
      if (measurements.fontWeight) existing.fontWeights.push(measurements.fontWeight);
    } else {
      variantData.set(signature, {
        usage: {
          component: 'navigation',
          variant: 'nav-item',
          count: 1,
          colors,
          measurements,
        },
        heights: measurements.height ? [measurements.height] : [],
        paddings: measurements.padding ? [measurements.padding] : [],
        fontSizes: measurements.fontSize ? [measurements.fontSize] : [],
        fontWeights: measurements.fontWeight ? [measurements.fontWeight] : [],
      });
    }
  }

  // Calculate most common measurements for each variant
  for (const data of variantData.values()) {
    // Most common height
    if (data.heights.length > 0) {
      const heightCounts = new Map<number, number>();
      data.heights.forEach(h => heightCounts.set(h, (heightCounts.get(h) || 0) + 1));
      const mostCommon = Array.from(heightCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      data.usage.measurements!.height = mostCommon;
    }

    // Most common padding
    if (data.paddings.length > 0) {
      const paddingCounts = new Map<string, number>();
      data.paddings.forEach(p => paddingCounts.set(p, (paddingCounts.get(p) || 0) + 1));
      const mostCommon = Array.from(paddingCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      data.usage.measurements!.padding = mostCommon;
    }

    // Most common font size
    if (data.fontSizes.length > 0) {
      const fontSizeCounts = new Map<string, number>();
      data.fontSizes.forEach(fs => fontSizeCounts.set(fs, (fontSizeCounts.get(fs) || 0) + 1));
      const mostCommon = Array.from(fontSizeCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      data.usage.measurements!.fontSize = mostCommon;
    }

    // Most common font weight
    if (data.fontWeights.length > 0) {
      const fontWeightCounts = new Map<string, number>();
      data.fontWeights.forEach(fw => fontWeightCounts.set(fw, (fontWeightCounts.get(fw) || 0) + 1));
      const mostCommon = Array.from(fontWeightCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      data.usage.measurements!.fontWeight = mostCommon;
    }
  }

  return Array.from(variantData.values())
    .map(d => d.usage)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Identifies icon elements
 */
function identifyIcons(): Element[] {
  // Strategy 1: SVG elements
  const svgs = Array.from(document.querySelectorAll('svg'));

  // Strategy 2: Icon fonts
  const iconFonts = Array.from(document.querySelectorAll(
    '[class*="icon"], [class*="Icon"], i, [data-icon]'
  ));

  // Strategy 3: ARIA
  const ariaIcons = Array.from(document.querySelectorAll('[role="img"]'));

  const allIcons = new Set([...svgs, ...iconFonts, ...ariaIcons]);

  return Array.from(allIcons).filter(icon => {
    const styles = getCachedComputedStyle(icon);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
    const rect = icon.getBoundingClientRect();
    // Icons are typically small
    if (rect.width < 8 || rect.height < 8 || rect.width > 100 || rect.height > 100) {
      return false;
    }
    return true;
  });
}

/**
 * Extracts colors from icon elements
 */
function extractIconColors(icons: Element[]): ComponentColorUsage[] {
  const iconVariants = new Map<string, ComponentColorUsage>();

  for (const icon of icons) {
    const styles = getCachedComputedStyle(icon);

    const colors: ComponentColorUsage['colors'] = {};

    if (icon.tagName.toLowerCase() === 'svg') {
      // SVG icon
      if (styles.fill && styles.fill !== 'none') {
        colors.iconFill = normalizeColor(styles.fill);
      }
      if (styles.stroke && styles.stroke !== 'none') {
        colors.iconStroke = normalizeColor(styles.stroke);
      }

      // Also check path elements
      const paths = icon.querySelectorAll('path');
      paths.forEach(path => {
        const pathStyles = getCachedComputedStyle(path);
        if (pathStyles.fill && pathStyles.fill !== 'none' && !colors.iconFill) {
          colors.iconFill = normalizeColor(pathStyles.fill);
        }
        if (pathStyles.stroke && pathStyles.stroke !== 'none' && !colors.iconStroke) {
          colors.iconStroke = normalizeColor(pathStyles.stroke);
        }
      });
    } else {
      // Icon font
      colors.text = normalizeColor(styles.color);
    }

    const signature = createColorSignature(colors);

    if (iconVariants.has(signature)) {
      const existing = iconVariants.get(signature)!;
      existing.count++;
    } else {
      iconVariants.set(signature, {
        component: 'icon',
        variant: 'icon',
        count: 1,
        colors,
      });
    }
  }

  return Array.from(iconVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Extracts colors from input elements
 */
function extractInputColors(): ComponentColorUsage[] {
  const inputs = Array.from(document.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea, select'));

  const inputVariants = new Map<string, ComponentColorUsage>();

  for (const input of inputs) {
    const styles = getCachedComputedStyle(input);
    const rect = input.getBoundingClientRect();

    if (styles.display === 'none' || styles.visibility === 'hidden') continue;
    if (rect.width < 20 || rect.height < 16) continue;

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
      fontSize: styles.fontSize,
    };

    const signature = createColorSignature(colors);

    if (inputVariants.has(signature)) {
      const existing = inputVariants.get(signature)!;
      existing.count++;
    } else {
      inputVariants.set(signature, {
        component: 'input',
        variant: 'input',
        count: 1,
        colors,
        measurements,
      });
    }
  }

  return Array.from(inputVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Extracts colors from card elements
 */
function extractCardColors(): ComponentColorUsage[] {
  const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], article'));

  const cardVariants = new Map<string, ComponentColorUsage>();

  for (const card of cards) {
    const styles = getCachedComputedStyle(card);
    const rect = card.getBoundingClientRect();

    if (styles.display === 'none' || styles.visibility === 'hidden') continue;
    // Cards are typically larger
    if (rect.width < 100 || rect.height < 50) continue;

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    const measurements: ComponentColorUsage['measurements'] = {
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
    };

    const signature = createColorSignature(colors);

    if (cardVariants.has(signature)) {
      const existing = cardVariants.get(signature)!;
      existing.count++;
    } else {
      cardVariants.set(signature, {
        component: 'card',
        variant: 'card',
        count: 1,
        colors,
        measurements,
      });
    }
  }

  return Array.from(cardVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Main function to extract component-specific colors
 */
export function extractComponentSpecificColors(): ComponentSpecificColors {
  // Identify and extract colors from each component type
  const buttons = identifyButtons();
  const buttonColors = extractButtonColors(buttons);

  const navigation = identifyNavigation();
  const navigationColors = extractNavigationColors(navigation);

  const icons = identifyIcons();
  const iconColors = extractIconColors(icons);

  const inputColors = extractInputColors();
  const cardColors = extractCardColors();

  // Collect all unique colors across all components
  const allColors = new Map<string, number>();

  const addColors = (componentColors: ComponentColorUsage[]) => {
    componentColors.forEach(comp => {
      Object.values(comp.colors).forEach(color => {
        if (color && color !== 'none' && color !== 'rgba(0, 0, 0, 0)') {
          allColors.set(color, (allColors.get(color) || 0) + comp.count);
        }
      });
    });
  };

  addColors(buttonColors);
  addColors(navigationColors);
  addColors(iconColors);
  addColors(inputColors);
  addColors(cardColors);

  return {
    buttons: buttonColors,
    navigation: navigationColors,
    icons: iconColors,
    inputs: inputColors,
    cards: cardColors,
    allComponentColors: allColors,
  };
}

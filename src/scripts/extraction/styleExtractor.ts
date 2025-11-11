/**
 * Style Extractor Module
 *
 * Extracts design system styles from web pages:
 * - CSS Custom Properties with theme variants
 * - Colors with usage tracking
 * - Box shadows with elevation levels
 * - Border radius values
 */

import type {
  ParsedShadow,
  ShadowGroup,
  ShadowSystem,
  CSSCustomProperties,
  ColorExtraction
} from '../types/extraction';
import { getThemeFromSelector, normalizeColor } from '../utils/styleHelpers';
import { getCachedElements, getCachedComputedStyle } from '../utils/domCache';

/**
 * Extracts CSS Custom Properties from stylesheets
 *
 * Handles theme variants like :root, .dark, [data-theme="dark"] and automatically
 * detects light and dark mode variables. Filters out browser extension and utility
 * framework variables to extract only the site's design system variables.
 *
 * @returns {CSSCustomProperties} Object mapping CSS variable names to theme variant values
 *
 * @example
 * ```typescript
 * const cssVars = extractCSSCustomProperties();
 * // Returns: {
 * //   '--color-primary': { light: '#3b82f6', dark: '#60a5fa' },
 * //   '--spacing-4': { light: '1rem' }
 * // }
 * ```
 */
export function extractCSSCustomProperties(): CSSCustomProperties {
  const cssVars: CSSCustomProperties = {};
  const stylesheets = document.styleSheets;

  for (let i = 0; i < stylesheets.length; i++) {
    try {
      const stylesheet = stylesheets[i];

      // Skip browser extension stylesheets
      if (stylesheet.href && (
        stylesheet.href.includes('chrome-extension://') ||
        stylesheet.href.includes('moz-extension://') ||
        stylesheet.href.includes('safari-extension://')
      )) {
        continue;
      }

      let rules: CSSRuleList | null = null;
      try {
        rules = stylesheet.cssRules || stylesheet.rules;
      } catch (error) {
        // Log for debugging (use console.debug to keep it low-priority)
        console.debug('Failed to access stylesheet rules (likely CORS):', error);
        continue; // CORS blocked
      }

      if (!rules || rules.length === 0) continue;

      parseCSSRules(rules, cssVars);
    } catch (error) {
      // Log for debugging (use console.debug to keep it low-priority)
      console.debug('Failed to parse stylesheet:', error);
      // Continue to next sheet
    }
  }

  // Fallback: Read from getComputedStyle if no variables found
  if (Object.keys(cssVars).length === 0) {
    extractComputedVariables(cssVars);
  }

  filterExtensionVariables(cssVars);

  // Filter to only actually used variables
  const usedVars = filterToUsedVariables(cssVars);

  return usedVars;
}

/**
 * Extract CSS variables using getComputedStyle fallback
 *
 * This fallback method is used when no CSS variables are found in stylesheets
 * (e.g., due to CORS restrictions). It reads the computed styles from the document
 * and attempts to detect dark mode variants by temporarily toggling the dark class.
 *
 * @param {CSSCustomProperties} cssVars - Object to populate with CSS variable values
 * @returns {void}
 *
 * @example
 * ```typescript
 * const cssVars: CSSCustomProperties = {};
 * extractComputedVariables(cssVars);
 * // cssVars is now populated with variables from computed styles
 * ```
 */
export function extractComputedVariables(cssVars: CSSCustomProperties): void {
  const rootStyles = getComputedStyle(document.documentElement);

  // Extract light mode
  for (let i = 0; i < rootStyles.length; i++) {
    const prop = rootStyles[i];
    if (prop.startsWith('--')) {
      const value = rootStyles.getPropertyValue(prop).trim();
      if (value) {
        cssVars[prop] = { light: value };
      }
    }
  }

  // Try dark mode detection
  const hadDarkClass = document.documentElement.classList.contains('dark');
  const hadDataTheme = document.documentElement.getAttribute('data-theme');

  document.documentElement.classList.add('dark');
  const darkStyles = getComputedStyle(document.documentElement);

  for (let i = 0; i < darkStyles.length; i++) {
    const prop = darkStyles[i];
    if (prop.startsWith('--')) {
      const value = darkStyles.getPropertyValue(prop).trim();
      if (value && cssVars[prop] && cssVars[prop].light !== value) {
        cssVars[prop].dark = value;
      } else if (value && !cssVars[prop]) {
        cssVars[prop] = { dark: value };
      }
    }
  }

  // Restore original state
  if (!hadDarkClass) {
    document.documentElement.classList.remove('dark');
  }
  if (hadDataTheme !== null) {
    document.documentElement.setAttribute('data-theme', hadDataTheme);
  }
}

/**
 * Filters out browser extension and utility CSS variables
 *
 * Removes CSS variables that are likely from browser extensions (Vimium, Arc, Grammarly, etc.)
 * or from utility CSS frameworks like Tailwind CSS. This ensures we only extract variables
 * that are part of the site's actual design system.
 *
 * @param {CSSCustomProperties} cssVars - Object containing CSS variables to filter (modified in place)
 * @returns {void}
 *
 * @example
 * ```typescript
 * const cssVars = {
 *   '--color-primary': { light: 'blue' },
 *   '--vimium-hint-bg': { light: 'yellow' }, // Will be removed
 *   '--text-sm': { light: '0.875rem' }       // Will be removed (Tailwind utility)
 * };
 * filterExtensionVariables(cssVars);
 * // cssVars now only contains: { '--color-primary': { light: 'blue' } }
 * ```
 */
export function filterExtensionVariables(cssVars: CSSCustomProperties): void {
  const extensionPatterns = [
    'vimium-', 'arc-', 'extension-', 'grammarly-', 'lastpass-'
  ];

  const tailwindUtilityPatterns = [
    'container-', 'text-', 'blur-', 'font-weight-', 'font-size-',
    'tracking-', 'leading-', 'animate-', 'ease-', 'default-',
    'spacing-', 'line-height-', 'letter-spacing-', 'prose-',
    'screen-', 'breakpoint-', 'duration-', 'delay-', 'scale-',
    'rotate-', 'translate-', 'skew-'
  ];

  const utilityExactNames = ['spacing', 'default', 'none', 'auto', 'full', 'screen'];

  for (const varName in cssVars) {
    const cleanName = varName.replace('--', '').toLowerCase();

    if (extensionPatterns.some(pattern => cleanName.startsWith(pattern))) {
      delete cssVars[varName];
      continue;
    }

    if (tailwindUtilityPatterns.some(pattern => cleanName.startsWith(pattern))) {
      delete cssVars[varName];
      continue;
    }

    if (utilityExactNames.includes(cleanName)) {
      delete cssVars[varName];
    }
  }
}

/**
 * Priority function for CSS variable semantic importance
 * Used to rank variables when filtering by importance
 *
 * @param name - CSS variable name (with or without -- prefix)
 * @returns Priority score (lower = more important)
 */
const getCSSVariablePriority = (name: string): number => {
  const lower = name.toLowerCase();
  if (lower.includes('primary') || lower.includes('secondary')) return 1;
  if (lower.includes('color') || lower.includes('text') || lower.includes('bg')) return 2;
  if (lower.includes('spacing') || lower.includes('gap') || lower.includes('padding')) return 3;
  if (lower.includes('font') || lower.includes('size')) return 4;
  if (lower.includes('shadow') || lower.includes('elevation')) return 5;
  if (lower.includes('radius') || lower.includes('border')) return 6;
  return 10;
};

/**
 * Fallback function to return top N CSS variables by semantic priority
 * Used when var() usage detection fails or no elements are available
 *
 * @param cssVars - All CSS variables
 * @param limit - Maximum number of variables to return
 * @returns Limited set of prioritized CSS variables
 */
function fallbackToSemanticPriority(cssVars: CSSCustomProperties, limit: number): CSSCustomProperties {
  const priorityVars: CSSCustomProperties = {};
  const allVars = Object.keys(cssVars);

  const sorted = allVars.sort((a, b) => getCSSVariablePriority(a) - getCSSVariablePriority(b));
  const limited = sorted.slice(0, limit);

  for (const varName of limited) {
    priorityVars[varName] = cssVars[varName];
  }

  return priorityVars;
}

/**
 * Pre-compiled regex for extracting CSS variable names from var() references
 * Pattern matches: var(--variable-name) or var(--variable-name, fallback)
 */
const CSS_VAR_PATTERN = /var\((--[a-z0-9-_]+)/gi;

/**
 * Filters CSS variables to only those actually used in the page
 *
 * Scans computed styles of visible elements to find which CSS variables
 * are actually referenced via var(--name). This dramatically reduces the
 * output size by excluding thousands of unused generated variables.
 *
 * @param {CSSCustomProperties} cssVars - All defined CSS variables
 * @returns {CSSCustomProperties} Only the CSS variables actually used
 */
function filterToUsedVariables(cssVars: CSSCustomProperties): CSSCustomProperties {
  const usedVarNames = new Set<string>();
  const elements = getCachedElements();

  // Defensive check: if no elements available, fall back to semantic priority
  if (elements.length === 0) {
    return fallbackToSemanticPriority(cssVars, 50);
  }

  const maxElements = Math.min(elements.length, 500); // Sample elements

  // Check common properties that often use CSS variables
  const propsToCheck = [
    'color', 'backgroundColor', 'borderColor', 'fill', 'stroke',
    'boxShadow', 'textShadow', 'fontFamily', 'fontSize', 'lineHeight',
    'padding', 'margin', 'gap', 'borderRadius', 'width', 'height'
  ];

  // Scan computed styles for var() references
  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getCachedComputedStyle(element);

    for (const prop of propsToCheck) {
      const value = styles.getPropertyValue(prop);
      if (value && value.includes('var(--')) {
        // Extract variable names from var(--name) or var(--name, fallback)
        // Reset regex lastIndex for global flag
        CSS_VAR_PATTERN.lastIndex = 0;
        const matches = value.matchAll(CSS_VAR_PATTERN);
        for (const match of matches) {
          usedVarNames.add(match[1]);
        }
      }
    }
  }

  // If no variables found in computed styles, return top 50 by name priority
  if (usedVarNames.size === 0) {
    return fallbackToSemanticPriority(cssVars, 50);
  }

  // Return only used variables
  const usedVars: CSSCustomProperties = {};
  for (const varName of usedVarNames) {
    if (cssVars[varName]) {
      usedVars[varName] = cssVars[varName];
    }
  }

  // Limit to 50 max even if more are used (for extremely variable-heavy sites)
  // Prioritize by semantic importance (50 is optimal for AI comprehension)
  if (Object.keys(usedVars).length > 50) {
    const limited: CSSCustomProperties = {};

    const sorted = Object.keys(usedVars).sort((a, b) => getCSSVariablePriority(a) - getCSSVariablePriority(b));
    const topVars = sorted.slice(0, 50);

    for (const varName of topVars) {
      limited[varName] = usedVars[varName];
    }
    return limited;
  }

  return usedVars;
}

/**
 * Recursively parse CSS rules to find custom properties
 *
 * Traverses CSS rules including nested rules (@media, @supports) and extracts
 * CSS custom properties from theme-related selectors (:root, html, .dark, etc.).
 * Maps each variable to its appropriate theme variant.
 *
 * @param {CSSRuleList} rules - CSS rules to parse
 * @param {CSSCustomProperties} cssVars - Object to populate with discovered variables (modified in place)
 * @returns {void}
 *
 * @example
 * ```typescript
 * const cssVars: CSSCustomProperties = {};
 * const rules = document.styleSheets[0].cssRules;
 * parseCSSRules(rules, cssVars);
 * // cssVars now contains all CSS variables from the stylesheet
 * ```
 */
export function parseCSSRules(rules: CSSRuleList, cssVars: CSSCustomProperties): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Handle nested rules (@media, @supports)
    if ('cssRules' in rule && rule.cssRules) {
      parseCSSRules(rule.cssRules as CSSRuleList, cssVars);
      continue;
    }

    if (!('style' in rule)) continue;

    const selector = 'selectorText' in rule ? (rule as CSSStyleRule).selectorText : '';
    if (!selector) continue;

    // Only extract from theme selectors
    const isThemeSelector = (
      selector === ':root' ||
      selector === 'html' ||
      selector === 'body' ||
      selector.includes('.dark') ||
      selector.includes('[data-theme') ||
      selector.includes(':host')
    );

    if (!isThemeSelector) continue;

    const theme = getThemeFromSelector(selector);
    const style = rule.style as CSSStyleDeclaration;

    for (let j = 0; j < style.length; j++) {
      const property = style[j];
      if (property.startsWith('--')) {
        const value = style.getPropertyValue(property).trim();
        if (!cssVars[property]) {
          cssVars[property] = {};
        }
        cssVars[property][theme] = value;
      }
    }
  }
}

/**
 * Extracts colors from page with usage tracking
 *
 * Scans the page's elements to discover all colors used in backgrounds, text, and borders.
 * Tracks usage frequency for each color and returns the top 20 most frequently used colors.
 * All colors are normalized to a consistent format.
 *
 * @returns {ColorExtraction} Object containing array of colors and usage count mapping
 *
 * @example
 * ```typescript
 * const result = extractColors();
 * // Returns: {
 * //   colors: ['#ffffff', '#000000', '#3b82f6', ...],
 * //   usage: { '#ffffff': 45, '#000000': 38, '#3b82f6': 12, ... }
 * // }
 * ```
 */
export function extractColors(): ColorExtraction {
  const colorUsage = new Map<string, number>();
  const elements = getCachedElements();
  const maxElements = Math.min(elements.length, 200);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getCachedComputedStyle(element);

    // Background colors
    const bgColor = styles.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      const normalized = normalizeColor(bgColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }

    // Text colors
    const textColor = styles.color;
    if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
      const normalized = normalizeColor(textColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }

    // Border colors
    const borderColor = styles.borderColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
      const normalized = normalizeColor(borderColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }
  }

  const sortedColors = Array.from(colorUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Calculate confidence score based on color system consistency
  let confidence = 0.5; // Default medium confidence

  if (sortedColors.length === 0) {
    confidence = 0.0; // No colors detected
  } else {
    const totalUniqueColors = colorUsage.size;

    // Get CSS variables to check if colors are systematized
    const cssVars = extractCSSCustomProperties();
    const colorVarCount = Object.keys(cssVars).filter(name =>
      name.toLowerCase().includes('color') ||
      name.toLowerCase().includes('bg') ||
      name.toLowerCase().includes('text')
    ).length;

    // High confidence if using CSS variables for colors
    if (colorVarCount >= 10) {
      confidence = 0.85;
    } else if (colorVarCount >= 5) {
      confidence = 0.75;
    } else {
      // Confidence based on color palette size (smaller = more consistent)
      if (totalUniqueColors <= 15) {
        confidence = 0.80; // Very consistent palette
      } else if (totalUniqueColors <= 30) {
        confidence = 0.70; // Moderate palette
      } else if (totalUniqueColors <= 50) {
        confidence = 0.60; // Larger palette
      } else {
        confidence = 0.45; // Very large/inconsistent palette
      }
    }

    // Boost confidence if top colors dominate usage
    if (sortedColors.length > 0) {
      const topColorUsage = sortedColors[0][1];
      const totalUsage = Array.from(colorUsage.values()).reduce((sum, count) => sum + count, 0);
      const dominance = topColorUsage / totalUsage;

      if (dominance > 0.3) {
        confidence = Math.min(confidence + 0.1, 1.0);
      }
    }
  }

  return {
    colors: sortedColors.map(([color]) => color),
    usage: Object.fromEntries(sortedColors),
    confidence: Math.round(confidence * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Extracts border radius values
 *
 * Discovers all border-radius values used across the page's elements.
 * Filters out percentage-based values and extreme values to focus on the
 * design system's rounded corner scale. Returns up to 10 unique values.
 *
 * @returns {string[]} Array of border radius values (e.g., ['4px', '8px', '12px'])
 *
 * @example
 * ```typescript
 * const radii = extractBorderRadius();
 * // Returns: ['2px', '4px', '8px', '16px', '24px']
 * ```
 */
export function extractBorderRadius(): string[] {
  const radiusValues = new Set<string>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getCachedComputedStyle(element);
    const borderRadius = styles.borderRadius;

    if (borderRadius && borderRadius !== '0px') {
      const pixels = parseFloat(borderRadius);

      // Filter out percentage-based and absurd values
      if (borderRadius.includes('%')) continue;
      if (pixels > 0 && pixels <= 100) {
        radiusValues.add(borderRadius);
      }
    }
  }

  return Array.from(radiusValues).slice(0, 10);
}

/**
 * Extracts and analyzes box shadow values with elevation levels
 *
 * Performs comprehensive shadow analysis by scanning elements, parsing shadow values,
 * grouping them by intensity into elevation levels (0-5), and detecting the overall
 * shadow system pattern (Material Design, custom scale, etc.).
 *
 * @returns {ShadowSystem} Complete shadow system analysis including elevation levels and pattern
 *
 * @example
 * ```typescript
 * const shadows = extractShadows();
 * // Returns: {
 * //   elevationLevels: [
 * //     { elevationLevel: 1, name: 'Subtle', shadows: [...], count: 5, ... },
 * //     { elevationLevel: 2, name: 'Moderate', shadows: [...], count: 8, ... }
 * //   ],
 * //   pattern: 'Material Design inspired (elevation-based)',
 * //   totalUniqueShadows: 12
 * // }
 * ```
 */
export function extractShadows(): ShadowSystem {
  const shadowUsage = new Map<string, number>();

  // Target elements that commonly have shadows
  const shadowSelectors = [
    '[class*="card"]', '[class*="modal"]', '[class*="dialog"]', '[class*="popup"]',
    '[class*="menu"]', '[class*="dropdown"]', '[class*="tooltip"]', '[class*="popover"]',
    '[class*="panel"]', '[class*="sheet"]', '[class*="paper"]', '[class*="surface"]',
    'button', 'input', 'select', 'textarea',
    'img', 'figure', 'article',
    'header', 'footer', 'aside', 'nav', 'section',
    '[role="dialog"]', '[role="menu"]', '[role="tooltip"]'
  ];

  const shadowElements = document.querySelectorAll(shadowSelectors.join(', '));
  const maxElements = Math.min(shadowElements.length, 1000); // Increased from 500

  // Collect all shadows with usage counts
  for (let i = 0; i < maxElements; i++) {
    const element = shadowElements[i];
    const styles = getCachedComputedStyle(element);
    const boxShadow = styles.boxShadow;

    if (boxShadow && boxShadow !== 'none') {
      shadowUsage.set(boxShadow, (shadowUsage.get(boxShadow) || 0) + 1);
    }

    // Also check ::before and ::after pseudo-elements
    try {
      const beforeStyles = window.getComputedStyle(element, '::before');
      const beforeShadow = beforeStyles.boxShadow;
      if (beforeShadow && beforeShadow !== 'none') {
        shadowUsage.set(beforeShadow, (shadowUsage.get(beforeShadow) || 0) + 1);
      }

      const afterStyles = window.getComputedStyle(element, '::after');
      const afterShadow = afterStyles.boxShadow;
      if (afterShadow && afterShadow !== 'none') {
        shadowUsage.set(afterShadow, (shadowUsage.get(afterShadow) || 0) + 1);
      }
    } catch (e) {
      // Pseudo-element access might fail on some elements
    }
  }

  // Parse all unique shadows
  const parsedShadows: Array<{ parsed: ParsedShadow; count: number }> = [];
  for (const [shadowStr, count] of shadowUsage.entries()) {
    const parsed = parseShadow(shadowStr);
    if (parsed) {
      parsedShadows.push({ parsed, count });
    }
  }

  // Group similar shadows and assign elevation levels
  const shadowGroups = groupShadowsByElevation(parsedShadows);

  // Detect pattern (Material Design, custom, etc.)
  const pattern = detectShadowPattern(shadowGroups);

  return {
    elevationLevels: shadowGroups,
    pattern,
    totalUniqueShadows: shadowUsage.size
  };
}

/**
 * Parses a CSS box-shadow string into structured data
 *
 * Handles both single and multiple shadows (comma-separated). For multiple shadows,
 * it extracts the most prominent one (first non-inset shadow). Parses all shadow
 * components including offsets, blur, spread, color, and inset status.
 *
 * @param {string} shadowStr - CSS box-shadow value to parse
 * @returns {ParsedShadow | null} Structured shadow data or null if parsing fails
 *
 * @example
 * ```typescript
 * const shadow = parseShadow('0px 2px 8px 0px rgba(0, 0, 0, 0.1)');
 * // Returns: {
 * //   offsetX: 0,
 * //   offsetY: 2,
 * //   blur: 8,
 * //   spread: 0,
 * //   color: 'rgba(0, 0, 0, 0.1)',
 * //   inset: false,
 * //   raw: '0px 2px 8px 0px rgba(0, 0, 0, 0.1)'
 * // }
 * ```
 */
export function parseShadow(shadowStr: string): ParsedShadow | null {
  if (!shadowStr || shadowStr === 'none') return null;

  // For multiple shadows, take the most prominent one (first non-inset)
  const shadows = shadowStr.split(/,(?![^(]*\))/);

  for (const shadow of shadows) {
    const trimmed = shadow.trim();

    // Check for inset
    const inset = trimmed.startsWith('inset');
    const cleanShadow = trimmed.replace(/^inset\s+/, '');

    // Parse shadow components: offsetX offsetY blur spread color
    // Match patterns like: "0px 2px 8px 0px rgba(0, 0, 0, 0.1)"
    const regex = /([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px(?:\s+([-\d.]+)px)?\s+(.+)/;
    const match = cleanShadow.match(regex);

    if (match) {
      const [, offsetX, offsetY, blur, spread, color] = match;

      return {
        offsetX: parseFloat(offsetX),
        offsetY: parseFloat(offsetY),
        blur: parseFloat(blur),
        spread: spread ? parseFloat(spread) : 0,
        color: color.trim(),
        inset,
        raw: shadowStr
      };
    }
  }

  return null;
}

/**
 * Calculates shadow intensity for grouping and sorting
 *
 * Computes a numeric intensity score based on blur radius, offset, and spread.
 * Blur has the highest weight (3x), followed by Y offset (1.5x), and spread (0.5x).
 * Higher values indicate more prominent shadows.
 *
 * @param {ParsedShadow} shadow - Parsed shadow object
 * @returns {number} Intensity score (typically 0-200)
 *
 * @example
 * ```typescript
 * const shadow = {
 *   offsetX: 0, offsetY: 4, blur: 12, spread: 0,
 *   color: 'rgba(0,0,0,0.1)', inset: false, raw: '...'
 * };
 * const intensity = calculateShadowIntensity(shadow);
 * // Returns: 42 (12*3 + 4*1.5 + 0*0.5)
 * ```
 */
export function calculateShadowIntensity(shadow: ParsedShadow): number {
  // Blur is the primary factor for elevation
  const blurWeight = shadow.blur * 3;

  // Y offset is secondary (shadows usually go down)
  const offsetWeight = Math.abs(shadow.offsetY) * 1.5;

  // Spread adds subtle depth
  const spreadWeight = Math.abs(shadow.spread) * 0.5;

  return blurWeight + offsetWeight + spreadWeight;
}

/**
 * Merges visually similar shadows within a group
 *
 * Groups shadows that are visually similar (within 20% intensity difference) to reduce
 * redundancy in the shadow system. Combines usage counts for merged shadows.
 *
 * @param {Array<{parsed: ParsedShadow; count: number; intensity: number}>} shadows - Shadows to merge
 * @returns {Array<{parsed: ParsedShadow; count: number; intensity: number}>} Merged shadow array
 */
function mergeSimilarShadows(
  shadows: Array<{ parsed: ParsedShadow; count: number; intensity: number }>
): Array<{ parsed: ParsedShadow; count: number; intensity: number }> {
  if (shadows.length <= 1) return shadows;

  const merged: Array<{ parsed: ParsedShadow; count: number; intensity: number }> = [];
  const used = new Set<number>();

  for (let i = 0; i < shadows.length; i++) {
    if (used.has(i)) continue;

    const current = shadows[i];
    let totalCount = current.count;

    // Find similar shadows
    for (let j = i + 1; j < shadows.length; j++) {
      if (used.has(j)) continue;

      const other = shadows[j];

      // Check if shadows are similar (within 20% intensity difference)
      const intensityDiff = Math.abs(current.intensity - other.intensity);
      const avgIntensity = (current.intensity + other.intensity) / 2;

      if (intensityDiff / avgIntensity < 0.2) {
        totalCount += other.count;
        used.add(j);
      }
    }

    merged.push({
      parsed: current.parsed,
      count: totalCount,
      intensity: current.intensity
    });
    used.add(i);
  }

  return merged;
}

/**
 * Groups shadows by elevation level (0-5)
 *
 * Organizes shadows into 6 elevation levels (0=None, 1=Subtle, 2=Moderate, 3=Strong,
 * 4=Heavy, 5=Extra Heavy) based on calculated intensity scores. Merges similar shadows
 * within each level and selects the most frequently used shadow as representative.
 *
 * @param {Array<{parsed: ParsedShadow; count: number}>} shadows - Array of parsed shadows with usage counts
 * @returns {ShadowGroup[]} Array of shadow groups organized by elevation level
 *
 * @example
 * ```typescript
 * const shadows = [
 *   { parsed: { blur: 4, offsetY: 2, ... }, count: 10 },
 *   { parsed: { blur: 12, offsetY: 6, ... }, count: 5 }
 * ];
 * const groups = groupShadowsByElevation(shadows);
 * // Returns: [
 * //   { elevationLevel: 1, name: 'Subtle', shadows: [...], count: 10, ... },
 * //   { elevationLevel: 2, name: 'Moderate', shadows: [...], count: 5, ... }
 * // ]
 * ```
 */
export function groupShadowsByElevation(
  shadows: Array<{ parsed: ParsedShadow; count: number }>
): ShadowGroup[] {
  if (shadows.length === 0) {
    return [];
  }

  // Calculate intensity for each shadow
  const shadowsWithIntensity = shadows.map(({ parsed, count }) => ({
    parsed,
    count,
    intensity: calculateShadowIntensity(parsed)
  }));

  // Sort by intensity
  shadowsWithIntensity.sort((a, b) => a.intensity - b.intensity);

  // Define elevation levels based on intensity ranges
  const elevationRanges = [
    { level: 0, name: 'Border/Outline', min: 0, max: 5 },
    { level: 1, name: 'Subtle', min: 5, max: 25 },
    { level: 2, name: 'Moderate', min: 25, max: 50 },
    { level: 3, name: 'Strong', min: 50, max: 80 },
    { level: 4, name: 'Heavy', min: 80, max: 120 },
    { level: 5, name: 'Extra Heavy', min: 120, max: Infinity }
  ];

  // Group shadows into elevation levels
  const groups: ShadowGroup[] = [];

  for (const range of elevationRanges) {
    const shadowsInRange = shadowsWithIntensity.filter(
      s => s.intensity >= range.min && s.intensity < range.max
    );

    if (shadowsInRange.length > 0) {
      // Merge similar shadows within the same elevation level
      const merged = mergeSimilarShadows(shadowsInRange);

      if (merged.length > 0) {
        // Pick the most common shadow as representative
        merged.sort((a, b) => b.count - a.count);
        const representative = merged[0].parsed;

        groups.push({
          shadows: merged.map(s => s.parsed),
          elevationLevel: range.level,
          name: range.name,
          count: merged.reduce((sum, s) => sum + s.count, 0),
          intensity: merged[0].intensity,
          representative: representative.raw
        });
      }
    }
  }

  return groups;
}

/**
 * Detects shadow system pattern (Material Design, custom, etc.)
 *
 * Analyzes shadow groups to identify the design system pattern being used.
 * Detects Material Design patterns (blur/offset ratios of 1.5-4), geometric
 * progressions (1.4x-2.5x ratios), or custom patterns.
 *
 * @param {ShadowGroup[]} groups - Array of shadow groups to analyze
 * @returns {string} Description of the detected shadow pattern
 *
 * @example
 * ```typescript
 * const groups = extractShadows().elevationLevels;
 * const pattern = detectShadowPattern(groups);
 * // Returns: 'Material Design inspired (elevation-based)' or
 * //          'Custom scale (~1.8x progression)' or
 * //          'Custom shadow system (4 levels)'
 * ```
 */
export function detectShadowPattern(groups: ShadowGroup[]): string {
  if (groups.length === 0) return 'No shadows detected';
  if (groups.length === 1) return 'Single shadow style';

  // Check for Material Design pattern
  // Material uses specific elevation levels with predictable blur/offset ratios
  const hasMaterialPattern = groups.some(g => {
    const shadow = g.shadows[0];
    // Material Design shadows typically have blur/offsetY ratio around 2-3
    const ratio = shadow.blur / Math.abs(shadow.offsetY || 1);
    return ratio >= 1.5 && ratio <= 4 && shadow.offsetY > 0;
  });

  if (hasMaterialPattern && groups.length >= 3) {
    return 'Material Design inspired (elevation-based)';
  }

  // Check for geometric progression
  if (groups.length >= 3) {
    const intensities = groups.map(g => g.intensity);
    const ratios: number[] = [];

    for (let i = 1; i < intensities.length; i++) {
      ratios.push(intensities[i] / intensities[i - 1]);
    }

    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    if (avgRatio >= 1.4 && avgRatio <= 2.5) {
      return `Custom scale (~${avgRatio.toFixed(1)}x progression)`;
    }
  }

  return `Custom shadow system (${groups.length} levels)`;
}

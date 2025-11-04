/**
 * Yoink Content Script
 *
 * Extracts design system styles from web pages:
 * - CSS Custom Properties with theme variants
 * - Colors mapped to semantic names
 * - Typography, spacing, shadows, border radius
 */

import type { StyleData, CSSVariables, ColorUsage } from '../types';

interface ScanStylesRequest {
  action: 'scanStyles';
}

interface ScanResponse {
  success: boolean;
  data?: StyleData;
  error?: string;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
  request: ScanStylesRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ScanResponse) => void
): boolean => {
  if (request.action === 'scanStyles') {
    try {
      const styleData = extractStyles();
      sendResponse({ success: true, data: styleData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Style extraction error:', error);
      sendResponse({ success: false, error: errorMessage });
    }
  }
  return true;
});

/**
 * Main style extraction orchestrator
 */
function extractStyles(): StyleData {
  console.log('🎨 Yoink: Starting style extraction...');

  const cssVariables = extractCSSCustomProperties();
  const colorData = extractColors();

  const styleData: StyleData = {
    cssVariables,
    colors: colorData.colors,
    colorUsage: colorData.usage,
    fonts: extractFonts(),
    borderRadius: extractBorderRadius(),
    shadows: extractShadows()
  };

  console.log('✅ Yoink: Style extraction complete', styleData);
  return styleData;
}

/**
 * Extracts CSS Custom Properties from stylesheets
 * Handles theme variants like :root, .dark, [data-theme="dark"]
 */
function extractCSSCustomProperties(): CSSVariables {
  const cssVars: CSSVariables = {};
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
      } catch {
        continue; // CORS blocked
      }

      if (!rules || rules.length === 0) continue;

      parseCSSRules(rules, cssVars);
    } catch {
      // Silent fail - continue to next sheet
    }
  }

  // Fallback: Read from getComputedStyle if no variables found
  if (Object.keys(cssVars).length === 0) {
    extractComputedVariables(cssVars);
  }

  filterExtensionVariables(cssVars);
  return cssVars;
}

/**
 * Extract CSS variables using getComputedStyle fallback
 */
function extractComputedVariables(cssVars: CSSVariables): void {
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
 */
function filterExtensionVariables(cssVars: CSSVariables): void {
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
 * Recursively parse CSS rules to find custom properties
 */
function parseCSSRules(rules: CSSRuleList, cssVars: CSSVariables): void {
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
 * Determines theme variant from CSS selector
 */
function getThemeFromSelector(selector: string): string {
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
 * Extracts colors from page with usage tracking
 */
function extractColors(): { colors: string[]; usage: ColorUsage } {
  const colorUsage = new Map<string, number>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 200);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);

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

  return {
    colors: sortedColors.map(([color]) => color),
    usage: Object.fromEntries(sortedColors)
  };
}

/**
 * Normalizes color to rgb() format
 */
function normalizeColor(color: string): string {
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
 * Extracts font families from the page
 */
function extractFonts(): string[] {
  const fonts = new Set<string>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
    const fontFamily = styles.fontFamily;

    if (fontFamily && fontFamily !== 'inherit') {
      fonts.add(fontFamily);
    }
  }

  return Array.from(fonts).slice(0, 10);
}

/**
 * Extracts border radius values
 */
function extractBorderRadius(): string[] {
  const radiusValues = new Set<string>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
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
 * Extracts box shadow values
 */
function extractShadows(): string[] {
  const shadows = new Set<string>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 50);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
    const boxShadow = styles.boxShadow;

    if (boxShadow && boxShadow !== 'none') {
      shadows.add(boxShadow);
    }
  }

  return Array.from(shadows).slice(0, 5);
}

console.log('🎨 Yoink content script loaded');

/**
 * Yoink Content Script
 *
 * This script is injected into web pages and extracts design system styles.
 * It analyzes the DOM, computed styles, and CSS custom properties to extract:
 * - CSS Custom Properties (CSS variables with theme variants)
 * - Colors (background, text, borders) mapped to semantic names
 * - Font families and sizes
 * - Spacing (margins, padding)
 * - Border radius values
 * - Box shadows
 *
 * The extracted data is sent back to the popup for Markdown generation.
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanStyles') {
    try {
      // Extract styles from the current page
      const styleData = extractStyles();

      // Send back the extracted data
      sendResponse({
        success: true,
        data: styleData
      });
    } catch (error) {
      console.error('Style extraction error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // Return true to indicate we'll send a response asynchronously
  return true;
});

/**
 * Main style extraction function
 * Orchestrates the extraction of all design tokens
 * @returns {Object} - Extracted style data
 */
function extractStyles() {
  console.log('🎨 Yoink: Starting style extraction...');

  // First extract CSS custom properties (this is the foundation)
  const cssVariables = extractCSSCustomProperties();
  console.log('📋 Extracted CSS variables:', cssVariables);

  // Build a color lookup map for semantic mapping
  const colorMap = buildColorLookupMap(cssVariables);
  console.log('🗺️  Color lookup map:', colorMap);

  // Extract colors with usage tracking
  const colorData = extractColors();

  const styleData = {
    cssVariables,        // NEW: CSS custom properties with theme variants
    colorMap,            // NEW: Map of computed colors to CSS variable names
    colors: colorData.colors,
    colorUsage: colorData.usage,  // NEW: Usage count for each color
    fonts: extractFonts(),
    fontSizes: extractFontSizes(),
    spacing: extractSpacing(),
    borderRadius: extractBorderRadius(),
    shadows: extractShadows()
  };

  console.log('✅ Yoink: Style extraction complete', styleData);

  return styleData;
}

/**
 * Extracts CSS Custom Properties from all stylesheets
 * Handles theme variants like :root, .dark, [data-theme="dark"], etc.
 * @returns {Object} - Object mapping variable names to their values across themes
 */
function extractCSSCustomProperties() {
  const cssVars = {};

  // Parse all stylesheets
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
        console.log(`⚠️  Skipping browser extension stylesheet: ${stylesheet.href}`);
        continue;
      }

      // Skip CORS-blocked stylesheets
      if (!stylesheet.cssRules && !stylesheet.rules) {
        console.log(`⚠️  Skipping CORS-blocked stylesheet: ${stylesheet.href}`);
        continue;
      }

      const rules = stylesheet.cssRules || stylesheet.rules;
      parseCSSRules(rules, cssVars);

    } catch (error) {
      console.log(`⚠️  Could not access stylesheet (CORS): ${stylesheets[i].href || 'inline'}`);
    }
  }

  // Filter out known browser extension variables
  filterExtensionVariables(cssVars);

  return cssVars;
}

/**
 * Filters out known browser extension CSS variables
 * @param {Object} cssVars - CSS variables object to filter
 */
function filterExtensionVariables(cssVars) {
  const extensionPatterns = [
    'vimium-',
    'arc-',
    'extension-',
    'grammarly-',
    'lastpass-',
    // Add more known extension prefixes
  ];

  for (const varName in cssVars) {
    const cleanName = varName.replace('--', '').toLowerCase();

    // Remove if matches any extension pattern
    if (extensionPatterns.some(pattern => cleanName.startsWith(pattern))) {
      console.log(`🚫 Filtered extension variable: ${varName}`);
      delete cssVars[varName];
    }
  }
}

/**
 * Recursively parse CSS rules to find custom properties
 * @param {CSSRuleList} rules - CSS rules to parse
 * @param {Object} cssVars - Object to store extracted variables
 */
function parseCSSRules(rules, cssVars) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Handle @media, @supports, etc. (nested rules)
    if (rule.cssRules) {
      parseCSSRules(rule.cssRules, cssVars);
      continue;
    }

    // Skip non-style rules
    if (!rule.style) continue;

    // Determine theme context from selector
    const selector = rule.selectorText || '';
    const theme = getThemeFromSelector(selector);

    // Extract custom properties from this rule
    for (let j = 0; j < rule.style.length; j++) {
      const property = rule.style[j];

      if (property.startsWith('--')) {
        const value = rule.style.getPropertyValue(property).trim();

        // Initialize variable entry if needed
        if (!cssVars[property]) {
          cssVars[property] = {};
        }

        // Store value for this theme
        cssVars[property][theme] = value;
      }
    }
  }
}

/**
 * Extract computed CSS variables from computed styles
 * @param {CSSStyleDeclaration} styles - Computed styles
 * @param {Object} cssVars - Object to store extracted variables
 * @param {string} theme - Theme name (light/dark)
 */
function extractComputedCSSVariables(styles, cssVars, theme) {
  // Get all property names
  for (let i = 0; i < styles.length; i++) {
    const property = styles[i];

    if (property.startsWith('--')) {
      const value = styles.getPropertyValue(property).trim();

      if (!cssVars[property]) {
        cssVars[property] = {};
      }

      // Only add if not already present for this theme
      if (!cssVars[property][theme]) {
        cssVars[property][theme] = value;
      }
    }
  }
}

/**
 * Determines theme variant from CSS selector
 * @param {string} selector - CSS selector text
 * @returns {string} - Theme name (light, dark, or selector-based name)
 */
function getThemeFromSelector(selector) {
  const lower = selector.toLowerCase();

  // Dark mode variants
  if (lower.includes('.dark') ||
      lower.includes('[data-theme="dark"]') ||
      lower.includes('[data-theme=\'dark\']') ||
      lower.includes('[theme="dark"]') ||
      lower.includes('.theme-dark')) {
    return 'dark';
  }

  // Light mode (explicit)
  if (lower.includes('.light') ||
      lower.includes('[data-theme="light"]') ||
      lower.includes('[data-theme=\'light\']')) {
    return 'light';
  }

  // :root is typically light mode
  if (lower.includes(':root') || lower === 'html' || lower === 'body') {
    return 'light';
  }

  // Other theme selectors - use a generic name
  if (lower.includes('[data-theme=')) {
    const match = lower.match(/\[data-theme=["']?([^"'\]]+)["']?\]/);
    if (match) return match[1];
  }

  return 'light'; // Default to light
}

/**
 * Builds a color lookup map from CSS variables
 * Maps normalized color values to their CSS variable names
 * @param {Object} cssVars - CSS variables object
 * @returns {Object} - Map of normalized colors to variable names
 */
function buildColorLookupMap(cssVars) {
  const colorMap = {};

  for (const [varName, themes] of Object.entries(cssVars)) {
    for (const [theme, value] of Object.entries(themes)) {
      // Resolve var() references
      const resolvedValue = resolveCSSVarReferences(value, cssVars, theme);

      // Check if this looks like a color value
      if (isColorValue(resolvedValue)) {
        const normalizedColor = normalizeColorValue(resolvedValue);

        if (normalizedColor) {
          if (!colorMap[normalizedColor]) {
            colorMap[normalizedColor] = [];
          }

          // Store variable name with theme info
          colorMap[normalizedColor].push({
            name: varName,
            theme: theme,
            originalValue: value
          });
        }
      }
    }
  }

  return colorMap;
}

/**
 * Resolves CSS var() references to their actual values
 * @param {string} value - CSS value that might contain var() references
 * @param {Object} cssVars - CSS variables object
 * @param {string} theme - Current theme
 * @returns {string} - Resolved value
 */
function resolveCSSVarReferences(value, cssVars, theme) {
  // Handle var() references like var(--primary) or var(--primary, #000)
  const varRegex = /var\((--[a-zA-Z0-9-]+)(?:,\s*([^)]+))?\)/g;

  let resolved = value;
  let match;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep resolving until no more var() references
  while ((match = varRegex.exec(resolved)) !== null && iterations < maxIterations) {
    const varName = match[1];
    const fallback = match[2];

    // Look up the variable value
    const varValue = cssVars[varName]?.[theme] || cssVars[varName]?.['light'] || fallback || match[0];

    // Replace this var() reference
    resolved = resolved.replace(match[0], varValue);

    // Reset regex for next iteration
    varRegex.lastIndex = 0;
    iterations++;
  }

  return resolved;
}

/**
 * Checks if a value looks like a color
 * @param {string} value - CSS value
 * @returns {boolean} - True if it looks like a color
 */
function isColorValue(value) {
  if (!value) return false;

  const lower = value.toLowerCase().trim();

  // Check for color formats
  return (
    lower.startsWith('#') ||
    lower.startsWith('rgb') ||
    lower.startsWith('hsl') ||
    lower.startsWith('oklch') ||
    lower.startsWith('lch') ||
    lower.startsWith('lab') ||
    lower === 'transparent' ||
    lower === 'currentcolor' ||
    // Common color keywords
    ['white', 'black', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
     'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'navy', 'teal'].includes(lower)
  );
}

/**
 * Normalizes a color value to rgb() format for comparison
 * @param {string} color - Color value in any format
 * @returns {string|null} - Normalized rgb() color or null if invalid
 */
function normalizeColorValue(color) {
  if (!color) return null;

  // Create a temporary element to compute the color
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);

  const computed = window.getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Normalize the computed color
  return normalizeColor(computed);
}

/**
 * Extracts unique colors from the page with usage tracking
 * @returns {Object} - Object with colors array and usage map
 */
function extractColors() {
  const colorUsage = new Map(); // Map of color -> count
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 200); // Limit for performance

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);

    // Extract background colors
    const bgColor = styles.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      const normalized = normalizeColor(bgColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }

    // Extract text colors
    const textColor = styles.color;
    if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
      const normalized = normalizeColor(textColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }

    // Extract border colors
    const borderColor = styles.borderColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
      const normalized = normalizeColor(borderColor);
      colorUsage.set(normalized, (colorUsage.get(normalized) || 0) + 1);
    }
  }

  // Convert to array sorted by usage (most used first)
  const sortedColors = Array.from(colorUsage.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 20); // Limit to 20 most common colors

  return {
    colors: sortedColors.map(([color]) => color),
    usage: Object.fromEntries(sortedColors)
  };
}

/**
 * Extracts unique font families from the page
 * @returns {Array<string>} - Array of unique font family values
 */
function extractFonts() {
  const fonts = new Set();
  const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, input, textarea, body');

  elements.forEach(element => {
    const styles = window.getComputedStyle(element);
    const fontFamily = styles.fontFamily;

    if (fontFamily) {
      // Clean up font family string
      const cleanFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      fonts.add(cleanFont);
    }
  });

  return Array.from(fonts).slice(0, 10); // Limit to 10 unique fonts
}

/**
 * Extracts unique font sizes from the page
 * @returns {Array<string>} - Array of unique font size values
 */
function extractFontSizes() {
  const fontSizes = new Set();
  const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, input');

  elements.forEach(element => {
    const styles = window.getComputedStyle(element);
    const fontSize = styles.fontSize;

    if (fontSize) {
      fontSizes.add(fontSize);
    }
  });

  return Array.from(fontSizes)
    .sort((a, b) => parseFloat(b) - parseFloat(a)) // Sort by size descending
    .slice(0, 15); // Limit to 15 sizes
}

/**
 * Extracts common spacing values (margins and padding)
 * @returns {Array<string>} - Array of unique spacing values
 */
function extractSpacing() {
  const spacing = new Set();
  const elements = document.querySelectorAll('div, section, article, header, footer, main, aside, nav');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);

    // Extract padding values
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(prop => {
      const value = styles[prop];
      if (value && value !== '0px') {
        spacing.add(value);
      }
    });

    // Extract margin values
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(prop => {
      const value = styles[prop];
      if (value && value !== '0px' && value !== 'auto') {
        spacing.add(value);
      }
    });
  }

  return Array.from(spacing)
    .filter(val => {
      const numVal = parseFloat(val);
      return numVal > 0 && numVal < 200; // Filter reasonable spacing values
    })
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .slice(0, 20); // Limit to 20 values
}

/**
 * Extracts border radius values from the page
 * @returns {Array<string>} - Array of unique border radius values
 */
function extractBorderRadius() {
  const radiusValues = new Set();
  const elements = document.querySelectorAll('button, input, div, section, img, a');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
    const borderRadius = styles.borderRadius;

    if (borderRadius && borderRadius !== '0px') {
      // Parse the value to check if it's reasonable
      const pixels = parseFloat(borderRadius);

      // Filter out absurd values
      // Skip if > 100px (likely 9999px or other "fully rounded" hack)
      // Skip if 50% (circular elements, not a design token)
      if (borderRadius.includes('%')) {
        continue; // Skip percentage-based radius
      }

      if (pixels > 0 && pixels <= 100) {
        radiusValues.add(borderRadius);
      }
    }
  }

  return Array.from(radiusValues)
    .slice(0, 10); // Limit to 10 values
}

/**
 * Extracts box shadow values from the page
 * @returns {Array<string>} - Array of unique box shadow values
 */
function extractShadows() {
  const shadows = new Set();
  const elements = document.querySelectorAll('div, button, section, article, header, nav, aside, img');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
    const boxShadow = styles.boxShadow;

    if (boxShadow && boxShadow !== 'none') {
      shadows.add(boxShadow);
    }
  }

  return Array.from(shadows)
    .slice(0, 10); // Limit to 10 values
}

/**
 * Normalizes color values to a consistent format
 * Converts rgba to rgb if fully opaque, or keeps rgba format
 * @param {string} color - Color value to normalize
 * @returns {string} - Normalized color value
 */
function normalizeColor(color) {
  // If it's already in hex format, return as is
  if (color.startsWith('#')) {
    return color;
  }

  // Handle rgb/rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const alpha = a !== undefined ? parseFloat(a) : 1;

    // If fully opaque, return as rgb
    if (alpha === 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Otherwise return as rgba
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

console.log('🎨 Yoink content script loaded');

/**
 * Layout Extraction Module
 *
 * Handles extraction of layout structure, flexbox/grid patterns, spacing scales,
 * z-index hierarchies, color context, and responsive breakpoints.
 */

// ============================================================================
// Helper Functions for CSS Custom Properties and Color Variable Mapping
// ============================================================================

/**
 * Extract CSS custom properties (variables) from stylesheets
 */
function extractCSSCustomProperties(): any {
  const cssVars: any = {};
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
function extractComputedVariables(cssVars: any): void {
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
function filterExtensionVariables(cssVars: any): void {
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
function parseCSSRules(rules: CSSRuleList, cssVars: any): void {
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
 * Normalizes color to rgb() or rgba() format
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
 * Deduplicates array items based on specified keys
 */
function deduplicateByKey(arr: any[], keys: string[]): any[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keys.map(k => item[k]).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds a map of computed colors to CSS variable names
 */
function buildColorVariableMap(cssVariables: any): Map<string, string> {
  const colorVarMap = new Map<string, string>();
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  try {
    for (const [varName, themes] of Object.entries(cssVariables || {})) {
      const lightValue = (themes as any).light || (themes as any)[Object.keys(themes as any)[0]];
      if (!lightValue) continue;

      // Set the variable value and read the computed color
      tempDiv.style.color = `var(${varName})`;
      const computedColor = getComputedStyle(tempDiv).color;

      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
        const normalized = normalizeColor(computedColor);
        colorVarMap.set(normalized, varName);
      }

      // Also try setting the raw value directly to handle all color formats
      tempDiv.style.color = lightValue;
      const directComputed = getComputedStyle(tempDiv).color;

      if (directComputed && directComputed !== computedColor) {
        const directNormalized = normalizeColor(directComputed);
        if (!colorVarMap.has(directNormalized)) {
          colorVarMap.set(directNormalized, varName);
        }
      }
    }
  } finally {
    document.body.removeChild(tempDiv);
  }

  return colorVarMap;
}

/**
 * Maps a computed color to its CSS variable name
 */
function mapColorToVariable(computedColor: string, colorVarMap: Map<string, string>): string {
  const normalized = normalizeColor(computedColor);

  // Try direct match
  if (colorVarMap.has(normalized)) {
    return `var(${colorVarMap.get(normalized)})`;
  }

  // Try common color names
  const colorNames: { [key: string]: string } = {
    'rgb(255, 255, 255)': '#ffffff',
    'rgb(0, 0, 0)': '#000000',
    'rgb(255, 0, 0)': '#ff0000',
    'rgb(0, 255, 0)': '#00ff00',
    'rgb(0, 0, 255)': '#0000ff',
  };

  if (colorNames[normalized]) {
    return colorNames[normalized];
  }

  // Return original if no mapping found
  return computedColor;
}

// ============================================================================
// Helper Functions for Spacing Analysis
// ============================================================================

/**
 * Infers the context where spacing is used
 */
function inferSpacingContext(element: HTMLElement, type: string): string {
  const tagName = element.tagName.toLowerCase();
  const className = element.className?.toString() || '';

  // Component-level spacing
  if (tagName === 'button' || className.includes('btn')) {
    return type === 'padding' ? 'button-internal' : 'button-spacing';
  }

  if (className.includes('card') || className.includes('panel')) {
    return type === 'padding' ? 'card-internal' : 'card-spacing';
  }

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return type === 'padding' ? 'input-internal' : 'input-spacing';
  }

  // Layout spacing
  if (tagName === 'section' || tagName === 'article') {
    return type === 'padding' ? 'section-padding' : 'section-margin';
  }

  if (className.includes('container') || className.includes('wrapper')) {
    return 'container-spacing';
  }

  // Typography spacing
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
    return 'typography-spacing';
  }

  return 'general';
}

/**
 * Categorizes spacing usage into readable categories
 */
function categorizeSpacingUsage(spacingEntry: any): string {
  const { value } = spacingEntry;

  // Determine primary usage
  if (value <= 8) {
    return 'Micro spacing (component internals)';
  } else if (value <= 16) {
    return 'Small spacing (component padding, tight layouts)';
  } else if (value <= 32) {
    return 'Medium spacing (component margins, content separation)';
  } else if (value <= 64) {
    return 'Large spacing (section padding, major separations)';
  } else {
    return 'Extra large spacing (page layout, hero sections)';
  }
}

/**
 * Finds the greatest common divisor (base unit) of spacing values
 */
function findBaseUnit(values: number[]): number {
  if (values.length === 0) return 8; // Default fallback

  // Filter out values that are too small or too large
  const filtered = values.filter(v => v >= 4 && v <= 100);
  if (filtered.length === 0) return 8;

  // Calculate GCD of all values
  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
  };

  let result = filtered[0];
  for (let i = 1; i < filtered.length; i++) {
    result = gcd(result, filtered[i]);
    if (result <= 1) break; // Stop if GCD becomes 1
  }

  // Common base units in design systems
  const commonBaseUnits = [4, 8, 6, 12, 16];

  // If calculated GCD is too small, find closest common base unit
  if (result <= 2) {
    // Find which base unit most values are divisible by
    let bestBase = 8;
    let bestScore = 0;

    for (const base of commonBaseUnits) {
      const score = filtered.filter(v => v % base === 0).length;
      if (score > bestScore) {
        bestScore = score;
        bestBase = base;
      }
    }

    return bestBase;
  }

  // Return the calculated GCD if it's reasonable
  return result >= 4 && result <= 16 ? result : 8;
}

/**
 * Analyzes the pattern/ratio of spacing scale
 */
function analyzeSpacingPattern(values: number[]): string {
  if (values.length < 2) return 'Insufficient data';

  const ratios: number[] = [];
  for (let i = 1; i < Math.min(values.length, 6); i++) {
    const ratio = values[i] / values[i - 1];
    ratios.push(ratio);
  }

  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  // Identify pattern type
  if (avgRatio < 1.3) {
    return 'Linear progression (evenly spaced)';
  } else if (avgRatio >= 1.3 && avgRatio < 1.7) {
    return `Geometric progression (~${avgRatio.toFixed(1)}x multiplier)`;
  } else if (avgRatio >= 1.7 && avgRatio < 2.2) {
    return 'Doubling pattern (2x progression)';
  } else {
    return 'Custom progression';
  }
}

/**
 * Generates recommendations for spacing scale
 */
function generateSpacingRecommendation(scaleLength: number, baseUnit: number): string {
  if (scaleLength <= 5) {
    return `Limited spacing scale detected. Consider expanding to 8-10 values based on ${baseUnit}px base unit.`;
  } else if (scaleLength >= 10) {
    return `Good spacing scale coverage with ${baseUnit}px base unit.`;
  } else {
    return `Moderate spacing scale with ${baseUnit}px base unit. Could benefit from standardization.`;
  }
}

// ============================================================================
// Main Extract Functions
// ============================================================================

/**
 * Extracts the overall layout structure from the page
 * Including fixed, sticky, and main container elements
 */
export function extractLayoutStructure(): any {
  const layouts: any = {
    fixedElements: [],
    stickyElements: [],
    containers: [],
    grids: [],
    sidebars: []
  };

  const allElements = document.querySelectorAll('*');
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);
    const position = styles.position;
    const display = styles.display;

    // Detect fixed positioned elements
    if (position === 'fixed') {
      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const left = parseFloat(styles.left);
      const right = parseFloat(styles.right);
      const top = parseFloat(styles.top);
      const bottom = parseFloat(styles.bottom);

      // Detect sidebars (fixed, tall, on left or right edge)
      const isSidebar = height > window.innerHeight * 0.5 &&
                       width < window.innerWidth * 0.4 &&
                       (left === 0 || right === 0 || left < 50 || right < 50);

      if (isSidebar) {
        layouts.sidebars.push({
          width: `${Math.round(width)}px`,
          position: left === 0 || left < 50 ? 'left' : 'right',
          backgroundColor: styles.backgroundColor,
          zIndex: styles.zIndex
        });
      } else {
        layouts.fixedElements.push({
          position: 'fixed',
          width: `${Math.round(width)}px`,
          height: `${Math.round(height)}px`,
          top: isNaN(top) ? 'auto' : `${Math.round(top)}px`,
          left: isNaN(left) ? 'auto' : `${Math.round(left)}px`,
          right: isNaN(right) ? 'auto' : `${Math.round(right)}px`,
          bottom: isNaN(bottom) ? 'auto' : `${Math.round(bottom)}px`,
          zIndex: styles.zIndex
        });
      }
    }

    // Detect sticky positioned elements
    if (position === 'sticky' || position === '-webkit-sticky') {
      layouts.stickyElements.push({
        position: 'sticky',
        top: styles.top,
        zIndex: styles.zIndex
      });
    }

    // Detect main containers (high-level layout containers)
    const maxWidth = styles.maxWidth;
    if (maxWidth && maxWidth !== 'none' && parseFloat(maxWidth) > 600) {
      const marginLeft = styles.marginLeft;
      const marginRight = styles.marginRight;
      const isCentered = marginLeft === 'auto' && marginRight === 'auto';

      layouts.containers.push({
        maxWidth,
        centered: isCentered,
        padding: styles.padding
      });
    }

    // Detect grid layouts
    if (display === 'grid') {
      const gridTemplateColumns = styles.gridTemplateColumns;
      const gap = styles.gap || styles.gridGap;

      if (gridTemplateColumns && gridTemplateColumns !== 'none') {
        layouts.grids.push({
          columns: gridTemplateColumns,
          gap: gap || '0px',
          alignItems: styles.alignItems,
          justifyItems: styles.justifyItems
        });
      }
    }
  });

  // Deduplicate similar entries
  layouts.sidebars = deduplicateByKey(layouts.sidebars, ['width', 'position']);
  layouts.fixedElements = deduplicateByKey(layouts.fixedElements, ['width', 'height', 'top']);
  layouts.stickyElements = deduplicateByKey(layouts.stickyElements, ['top']);
  layouts.containers = deduplicateByKey(layouts.containers, ['maxWidth']);
  layouts.grids = deduplicateByKey(layouts.grids, ['columns', 'gap']);

  return layouts;
}

/**
 * Extracts flexbox patterns from the page
 * Identifies common flex configurations and their usage
 */
export function extractFlexboxPatterns(): any {
  const flexPatterns = new Map<string, any>();
  const allElements = document.querySelectorAll('*');
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);

    if (styles.display === 'flex' || styles.display === 'inline-flex') {
      const pattern = {
        flexDirection: styles.flexDirection,
        justifyContent: styles.justifyContent,
        alignItems: styles.alignItems,
        gap: styles.gap,
        flexWrap: styles.flexWrap
      };

      const signature = `${pattern.flexDirection}-${pattern.justifyContent}-${pattern.alignItems}-${pattern.gap}`;

      if (flexPatterns.has(signature)) {
        const existing = flexPatterns.get(signature)!;
        existing.count++;
      } else {
        flexPatterns.set(signature, { ...pattern, count: 1 });
      }
    }
  });

  return Array.from(flexPatterns.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Extracts component composition and nesting patterns
 * Identifies common component combinations on the page
 */
export function extractComponentComposition(): any {
  const compositions: any[] = [];

  // Look for common composition patterns
  const patterns = [
    {
      name: 'card-with-button',
      selector: '[class*="card"], article',
      childSelector: 'button, [role="button"]'
    },
    {
      name: 'card-with-image',
      selector: '[class*="card"], article',
      childSelector: 'img'
    },
    {
      name: 'modal-with-form',
      selector: '[role="dialog"], [class*="modal"]',
      childSelector: 'form, input, textarea'
    },
    {
      name: 'nav-with-dropdown',
      selector: 'nav, [role="navigation"]',
      childSelector: '[role="menu"], [class*="dropdown"]'
    },
    {
      name: 'table-with-actions',
      selector: 'table, [role="table"]',
      childSelector: 'button, [class*="action"]'
    },
    {
      name: 'form-with-validation',
      selector: 'form',
      childSelector: '[class*="error"], [class*="invalid"], [aria-invalid="true"]'
    },
    {
      name: 'button-with-icon',
      selector: 'button, [role="button"]',
      childSelector: 'svg, [class*="icon"]'
    },
    {
      name: 'input-with-label',
      selector: 'input, textarea, select',
      childSelector: 'label'
    },
    {
      name: 'list-with-avatars',
      selector: 'ul, ol, [role="list"]',
      childSelector: '[class*="avatar"], img[class*="profile"]'
    }
  ];

  patterns.forEach(pattern => {
    const containers = document.querySelectorAll(pattern.selector);
    let count = 0;

    containers.forEach(container => {
      const children = container.querySelectorAll(pattern.childSelector);
      if (children.length > 0) {
        count++;
      }
    });

    if (count > 0) {
      compositions.push({
        pattern: pattern.name,
        count,
        description: `${pattern.selector} containing ${pattern.childSelector}`
      });
    }
  });

  return compositions.sort((a, b) => b.count - a.count);
}

/**
 * Extracts z-index hierarchy and organizes into semantic layers
 * Groups elements by z-index and identifies their context (modal, dropdown, etc.)
 */
export function extractZIndexHierarchy(): any {
  const zIndexMap = new Map<number, { elements: number; contexts: string[] }>();

  const allElements = document.querySelectorAll('*');
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);
    const zIndex = parseInt(styles.zIndex, 10);

    if (!isNaN(zIndex) && zIndex !== 0) {
      const position = styles.position;

      // z-index only works on positioned elements
      if (position !== 'static') {
        const existing = zIndexMap.get(zIndex) || { elements: 0, contexts: [] };
        existing.elements += 1;

        // Detect context by class names
        const className = element.className.toString().toLowerCase();
        if (className.includes('modal') && !existing.contexts.includes('modal')) {
          existing.contexts.push('modal');
        } else if (className.includes('dropdown') && !existing.contexts.includes('dropdown')) {
          existing.contexts.push('dropdown');
        } else if (className.includes('tooltip') && !existing.contexts.includes('tooltip')) {
          existing.contexts.push('tooltip');
        } else if (className.includes('toast') || className.includes('notification')) {
          if (!existing.contexts.includes('toast')) existing.contexts.push('toast');
        } else if (className.includes('header') || className.includes('nav')) {
          if (!existing.contexts.includes('navigation')) existing.contexts.push('navigation');
        } else if (className.includes('sidebar')) {
          if (!existing.contexts.includes('sidebar')) existing.contexts.push('sidebar');
        }

        zIndexMap.set(zIndex, existing);
      }
    }
  });

  // Convert to sorted array
  const hierarchy = Array.from(zIndexMap.entries())
    .map(([zIndex, data]) => ({
      zIndex,
      elements: data.elements,
      contexts: data.contexts.length > 0 ? data.contexts : ['base']
    }))
    .sort((a, b) => a.zIndex - b.zIndex);

  // Organize into semantic layers
  const layers: any = {
    base: [],      // z-index 1-10
    dropdown: [],  // z-index 10-100
    modal: [],     // z-index 100-1000
    toast: []      // z-index 1000+
  };

  hierarchy.forEach(item => {
    if (item.zIndex < 10) {
      layers.base.push(item);
    } else if (item.zIndex < 100) {
      layers.dropdown.push(item);
    } else if (item.zIndex < 1000) {
      layers.modal.push(item);
    } else {
      layers.toast.push(item);
    }
  });

  return {
    hierarchy,
    layers,
    range: hierarchy.length > 0 ? {
      min: hierarchy[0].zIndex,
      max: hierarchy[hierarchy.length - 1].zIndex
    } : null
  };
}

/**
 * Extracts color usage context with CSS variable mapping
 * Analyzes background colors, text colors, border colors, and color pairings
 */
export function extractColorContext(): any {
  const colorUsage: any = {
    backgrounds: {},
    text: {},
    borders: {},
    pairings: [],
    variableMap: {}
  };

  // Get CSS variables for mapping
  const cssVariables = extractCSSCustomProperties();
  const colorVarMap = buildColorVariableMap(cssVariables);

  const pairingMap = new Map<string, any>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 300);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getComputedStyle(element);

    // Track background colors
    const bg = styles.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const normalized = normalizeColor(bg);
      colorUsage.backgrounds[normalized] = (colorUsage.backgrounds[normalized] || 0) + 1;

      // Map to variable name
      const bgVar = mapColorToVariable(bg, colorVarMap);
      if (bgVar !== bg && bgVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = bgVar;
      }

      // Track color pairings
      const textColor = styles.color;
      if (textColor) {
        const normalizedText = normalizeColor(textColor);
        const pairKey = `${normalized}::${normalizedText}`;

        // Map text color to variable
        const textVar = mapColorToVariable(textColor, colorVarMap);
        if (textVar !== textColor && textVar.startsWith('var(')) {
          colorUsage.variableMap[normalizedText] = textVar;
        }

        if (pairingMap.has(pairKey)) {
          pairingMap.get(pairKey)!.count++;
        } else {
          pairingMap.set(pairKey, {
            pair: `${normalized} / ${normalizedText}`,
            background: normalized,
            backgroundVar: bgVar,
            text: normalizedText,
            textVar: textVar,
            count: 1
          });
        }
      }
    }

    // Track text colors
    const textColor = styles.color;
    if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
      const normalized = normalizeColor(textColor);
      colorUsage.text[normalized] = (colorUsage.text[normalized] || 0) + 1;

      // Map to variable name
      const textVar = mapColorToVariable(textColor, colorVarMap);
      if (textVar !== textColor && textVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = textVar;
      }
    }

    // Track border colors
    const borderColor = styles.borderColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && styles.borderWidth !== '0px') {
      const normalized = normalizeColor(borderColor);
      colorUsage.borders[normalized] = (colorUsage.borders[normalized] || 0) + 1;

      // Map to variable name
      const borderVar = mapColorToVariable(borderColor, colorVarMap);
      if (borderVar !== borderColor && borderVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = borderVar;
      }
    }
  }

  // Convert pairings map to sorted array
  colorUsage.pairings = Array.from(pairingMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return colorUsage;
}

/**
 * Extracts comprehensive spacing scale from the page
 * Identifies common spacing values, base unit, and usage patterns
 */
export function extractSpacingScale(): any {
  const spacingValues = new Map<number, any>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 500);

  // Collect all spacing values from elements
  for (let i = 0; i < maxElements; i++) {
    const el = elements[i] as HTMLElement;
    const styles = getComputedStyle(el);
    const tagName = el.tagName.toLowerCase();

    // Skip script, style, and head elements
    if (tagName === 'script' || tagName === 'style' || tagName === 'head') continue;

    // Extract padding values
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;

    // Extract margin values
    const marginTop = parseFloat(styles.marginTop) || 0;
    const marginRight = parseFloat(styles.marginRight) || 0;
    const marginBottom = parseFloat(styles.marginBottom) || 0;
    const marginLeft = parseFloat(styles.marginLeft) || 0;

    // Track all non-zero spacing values
    const allValues = [
      { value: paddingTop, type: 'padding', side: 'top' },
      { value: paddingRight, type: 'padding', side: 'right' },
      { value: paddingBottom, type: 'padding', side: 'bottom' },
      { value: paddingLeft, type: 'padding', side: 'left' },
      { value: marginTop, type: 'margin', side: 'top' },
      { value: marginRight, type: 'margin', side: 'right' },
      { value: marginBottom, type: 'margin', side: 'bottom' },
      { value: marginLeft, type: 'margin', side: 'left' }
    ];

    for (const item of allValues) {
      if (item.value > 0 && item.value < 1000) { // Filter out extreme values
        const rounded = Math.round(item.value); // Round to nearest pixel

        if (!spacingValues.has(rounded)) {
          spacingValues.set(rounded, {
            value: rounded,
            count: 0,
            usages: { padding: 0, margin: 0 },
            contexts: new Set<string>()
          });
        }

        const entry = spacingValues.get(rounded)!;
        entry.count++;
        entry.usages[item.type as 'padding' | 'margin']++;

        // Track context (what type of element uses this spacing)
        const context = inferSpacingContext(el, item.type);
        entry.contexts.add(context);
      }
    }
  }

  // Convert to sorted array
  const sortedSpacing = Array.from(spacingValues.values())
    .sort((a, b) => b.count - a.count);

  // Identify the base unit (GCD of common spacing values)
  const topValues = sortedSpacing.slice(0, 10).map(s => s.value);
  const baseUnit = findBaseUnit(topValues);

  // Build spacing scale (values that are multiples of base unit or close to it)
  const spacingScale = sortedSpacing
    .filter(s => {
      // Include if it's a multiple of base unit (within 2px tolerance)
      const ratio = s.value / baseUnit;
      const nearestMultiple = Math.round(ratio);
      return Math.abs(s.value - (nearestMultiple * baseUnit)) <= 2;
    })
    .slice(0, 12) // Limit to top 12 scale values
    .map(s => ({
      value: `${s.value}px`,
      count: s.count,
      usage: categorizeSpacingUsage(s),
      contexts: Array.from(s.contexts)
    }));

  // Analyze the scale pattern
  const scalePattern = analyzeSpacingPattern(spacingScale.map(s => parseInt(s.value)));

  return {
    spacingScale,
    baseUnit: `${baseUnit}px`,
    pattern: scalePattern,
    totalUniqueValues: spacingValues.size,
    recommendation: generateSpacingRecommendation(spacingScale.length, baseUnit)
  };
}

/**
 * Extracts layout patterns including containers, spacing patterns, and breakpoints
 */
export function extractLayoutPatterns(): any {
  const layout: any = {
    containers: [],
    breakpoints: extractBreakpoints(),
    spacingScale: extractSpacingScale(),
    spacingPatterns: {}
  };

  // Find container elements
  const containerSelectors = '[class*="container"], main, section, [class*="wrapper"]';
  const containers = document.querySelectorAll(containerSelectors);
  const containerMap = new Map<string, any>();

  containers.forEach(el => {
    const styles = getComputedStyle(el);
    const maxWidth = styles.maxWidth;

    if (maxWidth && maxWidth !== 'none') {
      const key = `${maxWidth}-${styles.padding}`;

      if (containerMap.has(key)) {
        containerMap.get(key)!.count++;
      } else {
        const className = (el as HTMLElement).className;
        const firstClass = className ? className.split(' ')[0] : '';

        containerMap.set(key, {
          selector: el.tagName.toLowerCase() + (firstClass ? `.${firstClass}` : ''),
          maxWidth,
          padding: styles.padding,
          count: 1
        });
      }
    }
  });

  layout.containers = Array.from(containerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Extract spacing patterns
  const spacingElements = document.querySelectorAll('section, article, div[class*="card"], [class*="container"]');
  const maxSpacingElements = Math.min(spacingElements.length, 100);

  for (let i = 0; i < maxSpacingElements; i++) {
    const el = spacingElements[i];
    const styles = getComputedStyle(el);

    const padding = styles.padding;
    if (padding && padding !== '0px') {
      const key = `padding:${padding}`;
      if (!layout.spacingPatterns[key]) {
        layout.spacingPatterns[key] = { type: 'padding', count: 0 };
      }
      layout.spacingPatterns[key].count++;
    }

    const margin = styles.margin;
    if (margin && margin !== '0px') {
      const key = `margin:${margin}`;
      if (!layout.spacingPatterns[key]) {
        layout.spacingPatterns[key] = { type: 'margin', count: 0 };
      }
      layout.spacingPatterns[key].count++;
    }
  }

  return layout;
}

/**
 * Extracts breakpoints from stylesheets and Tailwind classes
 * Identifies responsive design breakpoints used on the page
 */
export function extractBreakpoints(): number[] {
  const breakpoints = new Set<number>();

  // Extract from @media rules in stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.href && (
        sheet.href.includes('chrome-extension://') ||
        sheet.href.includes('moz-extension://') ||
        sheet.href.includes('safari-extension://')
      )) {
        continue;
      }

      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];

        if (rule.constructor.name === 'CSSMediaRule' || rule.type === CSSRule.MEDIA_RULE) {
          const mediaRule = rule as CSSMediaRule;
          const text = mediaRule.conditionText || mediaRule.media.mediaText;

          // Extract pixel values from media queries
          const matches = text.match(/(\d+)px/g);
          if (matches) {
            matches.forEach(match => {
              const value = parseInt(match);
              if (value >= 320 && value <= 2560) {
                breakpoints.add(value);
              }
            });
          }
        }
      }
    } catch {
      // CORS or permission error - skip this stylesheet
    }
  }

  // Extract from Tailwind responsive classes
  const allElements = document.querySelectorAll('*');
  const maxElements = Math.min(allElements.length, 500);

  for (let i = 0; i < maxElements; i++) {
    const classes = allElements[i].className;
    if (typeof classes !== 'string') continue;

    if (classes.includes('sm:')) breakpoints.add(640);
    if (classes.includes('md:')) breakpoints.add(768);
    if (classes.includes('lg:')) breakpoints.add(1024);
    if (classes.includes('xl:')) breakpoints.add(1280);
    if (classes.includes('2xl:')) breakpoints.add(1536);
  }

  return Array.from(breakpoints).sort((a, b) => a - b);
}

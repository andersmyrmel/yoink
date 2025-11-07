/**
 * Yoink Content Script
 *
 * Extracts design system styles from web pages:
 * - CSS Custom Properties with theme variants
 * - Colors mapped to semantic names
 * - Typography, spacing, shadows, border radius
 */

interface ScanStylesRequest {
  action: 'scanStyles';
  includeComponents?: boolean;
}

interface ScanResponse {
  success: boolean;
  data?: any;
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
      const styleData = extractStyles(request.includeComponents);
      sendResponse({ success: true, data: styleData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({ success: false, error: errorMessage });
    }
  }
  return true;
});

/**
 * Main style extraction orchestrator
 */
function extractStyles(includeComponents: boolean = true): any {
  const cssVariables = extractCSSCustomProperties();
  const colorData = extractColors();

  const styleData: any = {
    cssVariables,
    colors: colorData.colors,
    colorUsage: colorData.usage,
    fonts: extractFonts(),
    borderRadius: extractBorderRadius(),
    shadows: extractShadows(),
    layout: extractLayoutStructure(),
    icons: extractIcons(),
    gradients: extractGradients(),
    responsive: extractResponsiveBreakpoints(),
    scrollbars: extractScrollbarStyles()
  };

  // Add component patterns and context if requested
  if (includeComponents) {
    styleData.components = extractComponents();
    styleData.typographyContext = extractTypographyContext();
    styleData.colorContext = extractColorContext();
    styleData.layoutPatterns = extractLayoutPatterns();
    styleData.flexboxPatterns = extractFlexboxPatterns();
    styleData.componentComposition = extractComponentComposition();
    styleData.zIndex = extractZIndexHierarchy();
    styleData.animations = extractAnimations();
  }

  return styleData;
}

/**
 * Extracts CSS Custom Properties from stylesheets
 * Handles theme variants like :root, .dark, [data-theme="dark"]
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
 * Extracts colors from page with usage tracking
 */
function extractColors(): { colors: string[]; usage: any } {
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
 * Parsed shadow data structure
 */
interface ParsedShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
  raw: string;
}

/**
 * Shadow group with elevation level
 */
interface ShadowGroup {
  shadows: ParsedShadow[];
  elevationLevel: number;
  name: string;
  count: number;
  intensity: number;
  representative: string;
}

/**
 * Shadow system analysis result
 */
interface ShadowSystem {
  elevationLevels: ShadowGroup[];
  pattern: string;
  totalUniqueShadows: number;
}

/**
 * Extracts and analyzes box shadow values with elevation levels
 */
function extractShadows(): ShadowSystem {
  const shadowUsage = new Map<string, number>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 500);

  // Collect all shadows with usage counts
  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = window.getComputedStyle(element);
    const boxShadow = styles.boxShadow;

    if (boxShadow && boxShadow !== 'none') {
      shadowUsage.set(boxShadow, (shadowUsage.get(boxShadow) || 0) + 1);
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
 * Handles both single and multiple shadows (comma-separated)
 */
function parseShadow(shadowStr: string): ParsedShadow | null {
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
 * Higher blur and offset = higher intensity
 */
function calculateShadowIntensity(shadow: ParsedShadow): number {
  // Blur is the primary factor for elevation
  const blurWeight = shadow.blur * 3;

  // Y offset is secondary (shadows usually go down)
  const offsetWeight = Math.abs(shadow.offsetY) * 1.5;

  // Spread adds subtle depth
  const spreadWeight = Math.abs(shadow.spread) * 0.5;

  return blurWeight + offsetWeight + spreadWeight;
}

/**
 * Groups shadows by elevation level (0-5)
 */
function groupShadowsByElevation(
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
    { level: 0, name: 'None', min: 0, max: 5 },
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
 * Merges visually similar shadows within a group
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
 * Detects shadow system pattern (Material Design, custom, etc.)
 */
function detectShadowPattern(groups: ShadowGroup[]): string {
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

/**
 * Extracts layout structure patterns (fixed/sticky positioning, sidebars, containers, grids)
 */
function extractLayoutStructure(): any {
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
 * Extracts flexbox patterns
 */
function extractFlexboxPatterns(): any {
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
 * Extracts gradient patterns from backgrounds
 */
function extractGradients(): any[] {
  const gradients: any[] = [];
  const seen = new Set<string>();

  const allElements = document.querySelectorAll('*');
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);
    const backgroundImage = styles.backgroundImage;

    // Check for gradient
    if (backgroundImage && (backgroundImage.includes('gradient'))) {
      // Normalize the gradient string
      const normalized = backgroundImage.replace(/\s+/g, ' ').trim();

      if (!seen.has(normalized)) {
        seen.add(normalized);

        // Detect gradient type
        let type = 'linear';
        if (normalized.includes('radial-gradient')) type = 'radial';
        if (normalized.includes('conic-gradient')) type = 'conic';

        gradients.push({
          type,
          value: normalized,
          count: 1
        });
      } else {
        // Increment count if we've seen it
        const existing = gradients.find(g => g.value === normalized);
        if (existing) existing.count++;
      }
    }
  });

  return gradients.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Extracts component composition and nesting patterns
 */
function extractComponentComposition(): any {
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
 * Extracts z-index hierarchy and organizes into layers
 */
function extractZIndexHierarchy(): any {
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
 * Extracts animations and transition patterns
 */
function extractAnimations(): any {
  const transitions = new Map<string, number>();
  const animations = new Map<string, number>();

  const allElements = document.querySelectorAll('*');
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);

    // Extract transitions
    const transition = styles.transition;
    if (transition && transition !== 'all 0s ease 0s' && transition !== 'none') {
      const count = transitions.get(transition) || 0;
      transitions.set(transition, count + 1);
    }

    // Extract animations
    const animation = styles.animation;
    if (animation && animation !== 'none') {
      const count = animations.get(animation) || 0;
      animations.set(animation, count + 1);
    }
  });

  // Parse common transition patterns
  const transitionPatterns: any[] = [];
  transitions.forEach((count, transition) => {
    // Parse transition string
    const parts = transition.split(',').map(t => t.trim());
    parts.forEach(part => {
      const match = part.match(/^([\w-]+)\s+([\d.]+m?s)\s+([\w-]+)(?:\s+([\d.]+m?s))?/);
      if (match) {
        transitionPatterns.push({
          property: match[1],
          duration: match[2],
          easing: match[3],
          delay: match[4] || '0s',
          count
        });
      }
    });
  });

  // Deduplicate and sort by count
  const uniqueTransitions = deduplicateByKey(transitionPatterns, ['property', 'duration', 'easing'])
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const uniqueAnimations = Array.from(animations.entries())
    .map(([animation, count]) => ({ animation, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Extract common durations and easings
  const durations = new Map<string, number>();
  const easings = new Map<string, number>();

  uniqueTransitions.forEach(t => {
    const dCount = durations.get(t.duration) || 0;
    durations.set(t.duration, dCount + t.count);

    const eCount = easings.get(t.easing) || 0;
    easings.set(t.easing, eCount + t.count);
  });

  return {
    transitions: uniqueTransitions,
    animations: uniqueAnimations,
    commonDurations: Array.from(durations.entries())
      .map(([duration, count]) => ({ duration, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    commonEasings: Array.from(easings.entries())
      .map(([easing, count]) => ({ easing, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}

/**
 * Helper function to deduplicate array of objects by specified keys
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
 * Extracts component patterns from the page
 */
function extractComponents(): any {
  return {
    buttons: extractButtons(),
    cards: extractCards(),
    inputs: extractInputs(),
    navigation: extractNavigation(),
    headings: extractHeadings(),
    dropdowns: extractDropdowns(),
    tables: extractTables(),
    modals: extractModals(),
    tooltips: extractTooltips(),
    badges: extractBadges(),
    avatars: extractAvatars(),
    tabs: extractTabs(),
    accordions: extractAccordions(),
    progress: extractProgress(),
    breadcrumbs: extractBreadcrumbs(),
    pagination: extractPagination(),
    alerts: extractAlerts(),
    searchBars: extractSearchBars(),
    toggles: extractToggles(),
    dividers: extractDividers(),
    skeletons: extractSkeletonStates(),
    emptyStates: extractEmptyStates(),
    datePickers: extractDatePickers(),
    colorPickers: extractColorPickers(),
    richTextEditors: extractRichTextEditors(),
    sliders: extractSliders(),
    comboboxes: extractComboboxes()
  };
}

/**
 * Gets clean HTML snippet with proper tag closure
 */
function getCleanHTML(element: HTMLElement): string {
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
 * Extracts interactive state styles (hover, focus, active, disabled) from CSS and element
 */
function extractStateStyles(element: HTMLElement): any {
  const states: any = {};

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
  } catch (e) {
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
 * Get matching CSS rules for an element (including pseudo-classes)
 */
function getMatchingCSSRules(element: HTMLElement): CSSStyleRule[] {
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
 * Convert OKLAB to Linear RGB
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
 * Convert Linear RGB to sRGB (gamma correction)
 */
function linearRGBToSRGB(linear: number): number {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  } else {
    return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  }
}

/**
 * Parse OKLCH color format: oklch(L C H) or oklch(L C H / alpha)
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
 * Parse OKLAB color format: oklab(L a b) or oklab(L a b / alpha)
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
 * Converts a color string (rgb, rgba, hex, oklch, oklab, hsl, etc.) to RGB components
 * Uses browser's color computation for formats like oklch/oklab that require complex conversion
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
 * Calculates color distance using Euclidean distance in RGB space
 * Returns a value between 0 (identical) and 1 (very different)
 * Normalized by dividing by maximum possible distance (441.67)
 */
function calculateColorDistance(color1: string, color2: string): number {
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
 * Checks if two buttons are visually similar enough to be merged
 * Uses weighted scoring for colors (most important) and structure (less important)
 * More forgiving tolerances to reduce variant fragmentation
 * Variant-aware: buttons with same semantic variant (ghost, outline, etc.) merge more easily
 */
function areButtonsSimilar(btn1: any, btn2: any): boolean {
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
  const radius1 = parseFloat(styles1.borderRadius) || 0;
  const radius2 = parseFloat(styles2.borderRadius) || 0;
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
  const fontSize1 = parseFloat(styles1.fontSize) || 14;
  const fontSize2 = parseFloat(styles2.fontSize) || 14;
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
 * Extracts the main padding value from padding string
 * Handles formats like "8px", "8px 16px", "8px 16px 8px 16px"
 */
function parsePaddingValue(padding: string): number {
  const parts = padding.split(' ');
  const firstValue = parseFloat(parts[0]) || 0;
  return firstValue;
}

/**
 * Gets the actual font size from button text content
 * Buttons often have base font on the wrapper, but larger font on the text inside
 */
function getButtonTextFontSize(button: HTMLElement): string {
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

/**
 * Extracts button components with variants using visual similarity merging
 */
function extractButtons(): any[] {
  const buttons: any[] = [];

  const buttonSelectors = 'button, [role="button"], a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]';
  const elements = document.querySelectorAll(buttonSelectors);

  elements.forEach(btn => {
    const styles = getComputedStyle(btn);

    // Get font size from the actual text content, not the button wrapper
    const textFontSize = getButtonTextFontSize(btn as HTMLElement);

    const componentStyles: any = {
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

    const newButton: any = {
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
 * Extracts card components with interactive states
 */
function extractCards(): any[] {
  const cards: any[] = [];
  const seen = new Map<string, any>();

  // Look for elements that look like cards
  const cardSelectors = '[class*="card"], article, [class*="panel"], [class*="box"], [class*="item"]';
  const elements = document.querySelectorAll(cardSelectors);

  elements.forEach(card => {
    const styles = getComputedStyle(card);

    // Filter: must have border or shadow or background to be considered a card
    const hasBorder = styles.border !== 'none' && styles.borderWidth !== '0px';
    const hasShadow = styles.boxShadow !== 'none';
    const hasBackground = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent';

    if (!hasBorder && !hasShadow && !hasBackground) return;

    const signature = createStyleSignature(card as HTMLElement);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        margin: styles.margin,
        display: styles.display,
        width: styles.width
      };

      const variant: any = {
        html: getCleanHTML(card as HTMLElement),
        classes: (card as HTMLElement).className || '',
        styles: componentStyles,
        variant: inferCardVariant(card as HTMLElement),
        count: 1,
        states: extractStateStyles(card as HTMLElement)
      };

      cards.push(variant);
      seen.set(signature, variant);
    }
  });

  return cards.sort((a, b) => b.count - a.count).slice(0, 10); // Increased to capture more card variants
}

/**
 * Infers card variant from classes or structure
 */
function inferCardVariant(card: HTMLElement): string {
  const className = card.className.toLowerCase();

  if (className.includes('elevated') || className.includes('raised')) return 'elevated';
  if (className.includes('flat') || className.includes('outlined')) return 'flat';
  if (className.includes('interactive') || className.includes('clickable')) return 'interactive';
  if (card.querySelector('img, video')) return 'media';

  return 'default';
}

/**
 * Extracts form input components with states and types
 */
function extractInputs(): any[] {
  const inputs: any[] = [];
  const seen = new Map<string, any>();

  // Expanded to catch custom input implementations (contenteditable, role="textbox", etc.)
  const inputSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"], [class*="input"]:not(input)';
  const elements = document.querySelectorAll(inputSelectors);

  elements.forEach(input => {
    const styles = getComputedStyle(input);
    const el = input as HTMLElement;
    const inputType = (input as HTMLInputElement).type || el.tagName.toLowerCase();

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height,
        width: styles.width
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        type: inputType,
        variant: inferInputVariant(el, inputType),
        count: 1,
        states: extractStateStyles(el)
      };

      inputs.push(variant);
      seen.set(signature, variant);
    }
  });

  return inputs.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers input variant from type and classes
 */
function inferInputVariant(input: HTMLElement, type: string): string {
  const className = input.className.toLowerCase();

  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio';
  if (type === 'select' || input.tagName.toLowerCase() === 'select') return 'select';
  if (type === 'textarea' || input.tagName.toLowerCase() === 'textarea') return 'textarea';
  if (type === 'search') return 'search';

  if (className.includes('error') || className.includes('invalid')) return 'text-error';
  if (className.includes('success') || className.includes('valid')) return 'text-success';

  return 'text';
}

/**
 * Extracts navigation components with active states
 */
function extractNavigation(): any[] {
  const navItems: any[] = [];
  const seen = new Map<string, any>();

  const navSelectors = 'nav a, [role="navigation"] a, header a, [class*="nav"] a, [class*="menu"] a';
  const elements = document.querySelectorAll(navSelectors);

  elements.forEach(navItem => {
    const styles = getComputedStyle(navItem);
    const el = navItem as HTMLElement;
    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        padding: styles.padding,
        textDecoration: styles.textDecoration,
        background: styles.backgroundColor,
        borderRadius: styles.borderRadius
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferNavVariant(el),
        count: 1,
        states: extractStateStyles(el)
      };

      navItems.push(variant);
      seen.set(signature, variant);
    }
  });

  return navItems.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers navigation variant from classes or attributes
 */
function inferNavVariant(navItem: HTMLElement): string {
  const className = navItem.className.toLowerCase();
  const isActive = className.includes('active') || navItem.getAttribute('aria-current') === 'page';

  if (isActive) return 'active';
  if (className.includes('primary')) return 'primary';
  if (className.includes('secondary')) return 'secondary';

  return 'default';
}

/**
 * Extracts heading components
 */
function extractHeadings(): any[] {
  const headings: any[] = [];
  const seen = new Map<string, any>();

  const headingSelectors = 'h1, h2, h3, h4, h5, h6';
  const elements = document.querySelectorAll(headingSelectors);

  elements.forEach(heading => {
    const styles = getComputedStyle(heading);
    const tag = (heading as HTMLElement).tagName.toLowerCase();
    const signature = `${tag}-${styles.fontSize}-${styles.fontWeight}`;

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        color: styles.color,
        margin: styles.margin
      };

      const variant: any = {
        html: (heading as HTMLElement).outerHTML.substring(0, 500),
        classes: (heading as HTMLElement).className || '',
        styles: componentStyles,
        variant: tag,
        count: 1
      };

      headings.push(variant);
      seen.set(signature, variant);
    }
  });

  return headings.sort((a, b) => b.count - a.count);
}

/**
 * Extracts dropdown/menu components
 */
function extractDropdowns(): any[] {
  const dropdowns: any[] = [];
  const seen = new Map<string, any>();

  // Expanded to catch more dropdown patterns and custom implementations
  const dropdownSelectors = '[role="menu"], [role="listbox"], [role="select"], [class*="dropdown"], [class*="menu"][class*="list"], [class*="popover"], [class*="select"]:not(select), [data-dropdown], [data-menu]';
  const elements = document.querySelectorAll(dropdownSelectors);

  elements.forEach(dropdown => {
    const styles = getComputedStyle(dropdown);
    const el = dropdown as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        minWidth: styles.minWidth,
        zIndex: styles.zIndex
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'dropdown',
        count: 1
      };

      dropdowns.push(variant);
      seen.set(signature, variant);
    }
  });

  return dropdowns.sort((a, b) => b.count - a.count).slice(0, 10); // Increased to capture more dropdown variants
}

/**
 * Extracts table components - enhanced to detect inline styles and virtualized tables (Attio, etc.)
 */
function extractTables(): any[] {
  const tables: any[] = [];
  const seen = new Map<string, any>();
  const candidates = new Set<Element>();

  // Strategy 1: Standard semantic selectors
  const standardElements = document.querySelectorAll('table, [role="table"], [role="grid"], [role="treegrid"], [class*="table"]:not(table), [class*="data-grid"], [class*="datagrid"], [data-table], [data-grid]');
  standardElements.forEach(el => candidates.add(el));

  // Strategy 2: Radix UI scroll areas (common in Attio)
  const radixScrollAreas = document.querySelectorAll('[data-radix-scroll-area-viewport]');
  radixScrollAreas.forEach(scrollArea => {
    // Look for display:table inside
    const innerTable = scrollArea.querySelector('[style*="display"]');
    if (innerTable) {
      const styleAttr = innerTable.getAttribute('style') || '';
      if (styleAttr.includes('display: table') || styleAttr.includes('display:table')) {
        candidates.add(innerTable);
      }
    }
  });

  // Strategy 3: CRITICAL - Scan divs for inline styles with display:table or display:grid
  const divsWithStyle = document.querySelectorAll('div[style*="display"]');
  divsWithStyle.forEach(div => {
    const styleAttr = div.getAttribute('style') || '';
    if (styleAttr.includes('display: table') || styleAttr.includes('display:table') ||
        styleAttr.includes('display: grid') || styleAttr.includes('display:grid')) {
      candidates.add(div);
    }
  });

  // Process all candidates
  candidates.forEach(table => {
    const el = table as HTMLElement;

    // For non-table elements, verify they have table-like structure
    if (el.tagName.toLowerCase() !== 'table') {
      // Check for rows using multiple patterns
      const rowSelectors = '[role="row"], [class*="row"], [data-row], [class*="grid-row"], [class*="table-row"]';
      const rows = el.querySelectorAll(rowSelectors);

      // Check computed styles (this will catch inline styles too)
      const styles = getComputedStyle(el);
      const isTableDisplay = styles.display === 'table' || styles.display === 'inline-table';
      const isGridLayout = styles.display === 'grid' || styles.display === 'inline-grid';
      const hasMultipleChildren = el.children.length > 3;

      // Check for virtualization pattern (many absolutely positioned children with transforms)
      const absoluteChildren = Array.from(el.children).filter(child => {
        const childStyles = getComputedStyle(child as HTMLElement);
        const hasTransform = childStyles.transform && childStyles.transform !== 'none';
        return (childStyles.position === 'absolute' || childStyles.position === 'fixed') && hasTransform;
      });
      const isVirtualized = absoluteChildren.length > 5;

      // Skip if it doesn't look like a table at all
      if (!isTableDisplay && !isGridLayout && rows.length === 0 && !isVirtualized) return;
      if (isGridLayout && !hasMultipleChildren && rows.length === 0 && !isVirtualized) return;
    }

    const styles = getComputedStyle(el);
    const signature = `table-${styles.display}-${styles.backgroundColor}-${styles.border}-${el.children.length}`;

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderCollapse: styles.borderCollapse,
        width: styles.width,
        display: styles.display
      };

      // Extract header styles if present (expanded selectors)
      const header = el.querySelector('thead, [role="rowheader"], [role="columnheader"], th, [class*="header"][class*="cell"], [class*="head"]');
      if (header) {
        const headerStyles = getComputedStyle(header as HTMLElement);
        componentStyles.header = {
          background: headerStyles.backgroundColor,
          color: headerStyles.color,
          fontWeight: headerStyles.fontWeight,
          padding: headerStyles.padding
        };
      }

      // Extract cell styles (expanded selectors for grid-based tables)
      const cell = el.querySelector('td, [role="cell"], [role="gridcell"], [class*="cell"]:not([class*="header"])');
      if (cell) {
        const cellStyles = getComputedStyle(cell as HTMLElement);
        componentStyles.cell = {
          padding: cellStyles.padding,
          borderBottom: cellStyles.borderBottom
        };
      }

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'table',
        count: 1
      };

      tables.push(variant);
      seen.set(signature, variant);
    }
  });

  return tables.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Extracts modal/dialog components
 */
function extractModals(): any[] {
  const modals: any[] = [];
  const seen = new Map<string, any>();

  const modalSelectors = '[role="dialog"], [role="alertdialog"], [class*="modal"], [class*="dialog"], [aria-modal="true"]';
  const elements = document.querySelectorAll(modalSelectors);

  elements.forEach(modal => {
    const styles = getComputedStyle(modal);
    const el = modal as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        maxWidth: styles.maxWidth,
        zIndex: styles.zIndex,
        position: styles.position
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'modal',
        count: 1
      };

      modals.push(variant);
      seen.set(signature, variant);
    }
  });

  return modals.sort((a, b) => b.count - a.count).slice(0, 10); // Increased to capture more modal variants
}

/**
 * Extracts tooltip and popover components
 */
function extractTooltips(): any[] {
  const tooltips: any[] = [];
  const seen = new Map<string, any>();

  const tooltipSelectors = '[role="tooltip"], [class*="tooltip"], [class*="popover"]:not([role="menu"])';
  const elements = document.querySelectorAll(tooltipSelectors);

  elements.forEach(tooltip => {
    const styles = getComputedStyle(tooltip);
    const el = tooltip as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        boxShadow: styles.boxShadow,
        zIndex: styles.zIndex
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'tooltip',
        count: 1
      };

      tooltips.push(variant);
      seen.set(signature, variant);
    }
  });

  return tooltips.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts badge/tag/chip components
 */
function extractBadges(): any[] {
  const badges: any[] = [];
  const seen = new Map<string, any>();

  // Expanded to catch more badge/tag patterns including data attributes
  const badgeSelectors = '[class*="badge"], [class*="tag"], [class*="chip"], [class*="pill"], [class*="label"]:not(label), [data-badge], [data-tag], [role="status"]';
  const elements = document.querySelectorAll(badgeSelectors);

  elements.forEach(badge => {
    const styles = getComputedStyle(badge);
    const el = badge as HTMLElement;

    // Filter: must be small and inline-like
    const rect = el.getBoundingClientRect();
    if (rect.width > 200 || rect.height > 50) return;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        display: styles.display
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferBadgeVariant(el),
        count: 1
      };

      badges.push(variant);
      seen.set(signature, variant);
    }
  });

  return badges.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers badge variant from classes or content
 */
function inferBadgeVariant(badge: HTMLElement): string {
  const className = badge.className.toLowerCase();

  if (className.includes('success') || className.includes('green')) return 'success';
  if (className.includes('error') || className.includes('danger') || className.includes('red')) return 'error';
  if (className.includes('warning') || className.includes('yellow')) return 'warning';
  if (className.includes('info') || className.includes('blue')) return 'info';
  if (className.includes('primary')) return 'primary';
  if (className.includes('secondary') || className.includes('gray')) return 'secondary';

  return 'default';
}

/**
 * Extracts avatar components
 */
function extractAvatars(): any[] {
  const avatars: any[] = [];
  const seen = new Map<string, any>();

  // Expanded to catch more avatar patterns including data attributes
  const avatarSelectors = '[class*="avatar"], img[class*="profile"], img[class*="user"], [data-avatar], [role="img"][class*="user"], [role="img"][class*="profile"]';
  const elements = document.querySelectorAll(avatarSelectors);

  elements.forEach(avatar => {
    const styles = getComputedStyle(avatar);
    const el = avatar as HTMLElement;

    // Filter: typically small and circular/rounded
    const rect = el.getBoundingClientRect();
    if (rect.width > 200 || rect.height > 200) return;

    const signature = `${Math.round(rect.width)}-${styles.borderRadius}`;

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
        borderRadius: styles.borderRadius,
        border: styles.border,
        objectFit: styles.objectFit
      };

      const variant: any = {
        classes: el.className || '',
        styles: componentStyles,
        variant: inferAvatarVariant(el, styles),
        count: 1
      };

      avatars.push(variant);
      seen.set(signature, variant);
    }
  });

  return avatars.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers avatar variant from size and shape
 */
function inferAvatarVariant(avatar: HTMLElement, styles: CSSStyleDeclaration): string {
  const borderRadius = styles.borderRadius;
  const rect = avatar.getBoundingClientRect();
  const size = Math.round(rect.width);

  // Determine shape
  const isCircular = borderRadius === '50%' || borderRadius === '9999px';
  const shape = isCircular ? 'circular' : 'rounded';

  // Determine size category
  if (size <= 24) return `${shape}-xs`;
  if (size <= 32) return `${shape}-sm`;
  if (size <= 48) return `${shape}-md`;
  if (size <= 64) return `${shape}-lg`;
  return `${shape}-xl`;
}

/**
 * Extracts tab components
 */
function extractTabs(): any[] {
  const tabs: any[] = [];
  const seen = new Map<string, any>();

  const tabSelectors = '[role="tab"], [class*="tab"]:not([role="tabpanel"])';
  const elements = document.querySelectorAll(tabSelectors);

  elements.forEach(tab => {
    const styles = getComputedStyle(tab);
    const el = tab as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const isActive = el.getAttribute('aria-selected') === 'true' || el.className.includes('active');

      const componentStyles: any = {
        color: styles.color,
        background: styles.backgroundColor,
        borderBottom: styles.borderBottom,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: isActive ? 'active' : 'inactive',
        count: 1,
        states: extractStateStyles(el)
      };

      tabs.push(variant);
      seen.set(signature, variant);
    }
  });

  return tabs.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts accordion/collapsible components
 */
function extractAccordions(): any[] {
  const accordions: any[] = [];
  const seen = new Map<string, any>();

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
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding
      };

      const variant: any = {
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
 * Extracts progress bar and spinner components
 */
function extractProgress(): any[] {
  const progress: any[] = [];
  const seen = new Map<string, any>();

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
      const componentStyles: any = {
        background: styles.backgroundColor,
        color: styles.color,
        height: styles.height,
        width: styles.width,
        borderRadius: styles.borderRadius
      };

      const isSpinner = el.className.toLowerCase().includes('spinner') ||
                       el.className.toLowerCase().includes('loader');

      const variant: any = {
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
 * Extracts breadcrumb components
 */
function extractBreadcrumbs(): any[] {
  const breadcrumbs: any[] = [];
  const seen = new Map<string, any>();

  const breadcrumbSelectors = '[aria-label*="breadcrumb"], [class*="breadcrumb"], nav ol, nav ul';
  const elements = document.querySelectorAll(breadcrumbSelectors);

  elements.forEach(breadcrumb => {
    const el = breadcrumb as HTMLElement;

    // Verify it looks like a breadcrumb (has links separated by delimiters)
    const links = el.querySelectorAll('a, span');
    if (links.length < 2) return;

    const styles = getComputedStyle(el);
    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        fontSize: styles.fontSize,
        color: styles.color,
        display: styles.display
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'breadcrumb',
        count: 1
      };

      breadcrumbs.push(variant);
      seen.set(signature, variant);
    }
  });

  return breadcrumbs.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts pagination components
 */
function extractPagination(): any[] {
  const pagination: any[] = [];
  const seen = new Map<string, any>();

  const paginationSelectors = '[role="navigation"][aria-label*="pagination"], [class*="pagination"], nav[class*="page"]';
  const elements = document.querySelectorAll(paginationSelectors);

  elements.forEach(page => {
    const styles = getComputedStyle(page);
    const el = page as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        display: styles.display,
        gap: styles.gap
      };

      // Extract button/link styles from pagination items
      const items = el.querySelectorAll('button, a, [class*="page"]');
      if (items.length > 0) {
        const itemStyles = getComputedStyle(items[0] as HTMLElement);
        componentStyles.item = {
          padding: itemStyles.padding,
          background: itemStyles.backgroundColor,
          border: itemStyles.border,
          borderRadius: itemStyles.borderRadius,
          fontSize: itemStyles.fontSize
        };
      }

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'pagination',
        count: 1
      };

      pagination.push(variant);
      seen.set(signature, variant);
    }
  });

  return pagination.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts alert/banner components
 */
function extractAlerts(): any[] {
  const alerts: any[] = [];
  const seen = new Map<string, any>();

  const alertSelectors = '[role="alert"], [class*="alert"], [class*="banner"], [class*="notification"]:not([class*="toast"])';
  const elements = document.querySelectorAll(alertSelectors);

  elements.forEach(alert => {
    const styles = getComputedStyle(alert);
    const el = alert as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferAlertVariant(el),
        count: 1
      };

      alerts.push(variant);
      seen.set(signature, variant);
    }
  });

  return alerts.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers alert variant from classes or aria attributes
 */
function inferAlertVariant(alert: HTMLElement): string {
  const className = alert.className.toLowerCase();
  const role = alert.getAttribute('role');

  if (className.includes('success')) return 'success';
  if (className.includes('error') || className.includes('danger')) return 'error';
  if (className.includes('warning')) return 'warning';
  if (className.includes('info')) return 'info';
  if (role === 'alert') return 'alert';

  return 'default';
}

/**
 * Extracts search bar components
 */
function extractSearchBars(): any[] {
  const searches: any[] = [];
  const seen = new Map<string, any>();

  const searchSelectors = 'input[type="search"], [role="search"], [class*="search"] input';
  const elements = document.querySelectorAll(searchSelectors);

  elements.forEach(search => {
    const styles = getComputedStyle(search);
    const el = search as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height,
        width: styles.width
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'search',
        count: 1,
        states: extractStateStyles(el)
      };

      searches.push(variant);
      seen.set(signature, variant);
    }
  });

  return searches.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts toggle switch components
 */
function extractToggles(): any[] {
  const toggles: any[] = [];
  const seen = new Map<string, any>();

  const toggleSelectors = '[role="switch"], input[type="checkbox"][class*="toggle"], input[type="checkbox"][class*="switch"], [class*="toggle"]:not(button)';
  const elements = document.querySelectorAll(toggleSelectors);

  elements.forEach(toggle => {
    const styles = getComputedStyle(toggle);
    const el = toggle as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        width: styles.width,
        height: styles.height
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'toggle',
        count: 1,
        states: extractStateStyles(el)
      };

      toggles.push(variant);
      seen.set(signature, variant);
    }
  });

  return toggles.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts divider/separator components
 */
function extractDividers(): any[] {
  const dividers: any[] = [];
  const seen = new Map<string, any>();

  const dividerSelectors = 'hr, [class*="divider"], [class*="separator"], [role="separator"]';
  const elements = document.querySelectorAll(dividerSelectors);

  elements.forEach(divider => {
    const styles = getComputedStyle(divider);
    const el = divider as HTMLElement;

    const signature = `${styles.borderTop}-${styles.borderBottom}-${styles.height}-${styles.margin}`;

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        borderTop: styles.borderTop,
        borderBottom: styles.borderBottom,
        height: styles.height,
        margin: styles.margin,
        background: styles.backgroundColor
      };

      const variant: any = {
        classes: el.className || '',
        styles: componentStyles,
        variant: 'divider',
        count: 1
      };

      dividers.push(variant);
      seen.set(signature, variant);
    }
  });

  return dividers.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts icon system patterns
 */
function extractIcons(): any {
  const icons: any = {
    svgIcons: [],
    iconFonts: [],
    sizes: new Map<string, number>()
  };

  // Extract SVG icons - catch ALL svgs, not just ones with specific attributes
  const svgs = document.querySelectorAll('svg');
  const svgPatterns = new Map<string, any>();

  svgs.forEach(svg => {
    const el = svg as SVGElement;

    // Try multiple methods to get dimensions
    let width = parseFloat(el.getAttribute('width') || '0');
    let height = parseFloat(el.getAttribute('height') || '0');

    // If no width/height attributes, try bounding box
    if (!width || !height || isNaN(width) || isNaN(height)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
      }
    }

    // If still no dimensions, try viewBox
    if ((!width || !height || isNaN(width) || isNaN(height))) {
      const viewBox = el.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/\s+/);
        if (parts.length === 4) {
          width = parseFloat(parts[2]) || width;
          height = parseFloat(parts[3]) || height;
        }
      }
    }

    // Skip if we still don't have valid dimensions
    if (!width || !height || isNaN(width) || isNaN(height) || width === 0 || height === 0) {
      return; // Skip this SVG
    }

    const viewBox = el.getAttribute('viewBox');
    const className = el.className.baseVal || '';

    const size = `${Math.round(width)}x${Math.round(height)}`;
    const sizeCount = icons.sizes.get(size) || 0;
    icons.sizes.set(size, sizeCount + 1);

    const signature = `${size}-${viewBox}`;
    if (svgPatterns.has(signature)) {
      svgPatterns.get(signature).count++;
    } else {
      svgPatterns.set(signature, {
        size,
        viewBox,
        className,
        count: 1
      });
    }
  });

  icons.svgIcons = Array.from(svgPatterns.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Extract icon font usage (Font Awesome, Material Icons, etc.)
  const iconFontSelectors = '[class*="icon-"], [class*="fa-"], [class*="material-icons"], i[class*="icon"]';
  const iconFontElements = document.querySelectorAll(iconFontSelectors);
  const iconFontPatterns = new Map<string, number>();

  iconFontElements.forEach(icon => {
    const styles = getComputedStyle(icon);
    const fontSize = styles.fontSize;
    const count = iconFontPatterns.get(fontSize) || 0;
    iconFontPatterns.set(fontSize, count + 1);
  });

  icons.iconFonts = (Array.from(iconFontPatterns.entries()) as [string, number][])
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Convert sizes map to array
  const commonSizes = (Array.from(icons.sizes.entries()) as [string, number][])
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    svgPatterns: icons.svgIcons,
    iconFonts: icons.iconFonts,
    commonSizes,
    totalSvgs: svgs.length,
    totalIconFonts: iconFontElements.length
  };
}

/**
 * Extracts responsive breakpoints from media queries
 */
function extractResponsiveBreakpoints(): any {
  const breakpoints = new Map<number, any>();
  const mediaQueries: any[] = [];

  try {
    const sheets = Array.from(document.styleSheets);

    sheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);

        rules.forEach(rule => {
          if (rule instanceof CSSMediaRule) {
            const mediaText = rule.media.mediaText;
            mediaQueries.push(mediaText);

            // Extract min-width and max-width values
            const minWidthMatch = mediaText.match(/min-width:\s*(\d+)px/);
            const maxWidthMatch = mediaText.match(/max-width:\s*(\d+)px/);

            if (minWidthMatch) {
              const width = parseInt(minWidthMatch[1], 10);
              if (!breakpoints.has(width)) {
                breakpoints.set(width, {
                  value: `${width}px`,
                  type: 'min-width',
                  queries: []
                });
              }
              breakpoints.get(width)!.queries.push(mediaText);
            }

            if (maxWidthMatch) {
              const width = parseInt(maxWidthMatch[1], 10);
              if (!breakpoints.has(width)) {
                breakpoints.set(width, {
                  value: `${width}px`,
                  type: 'max-width',
                  queries: []
                });
              }
              breakpoints.get(width)!.queries.push(mediaText);
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

  // Sort breakpoints and deduplicate queries
  const sortedBreakpoints = Array.from(breakpoints.entries())
    .map(([width, data]) => ({
      width,
      value: data.value,
      type: data.type,
      queryCount: data.queries.length
    }))
    .sort((a, b) => a.width - b.width);

  // Infer common breakpoint names
  const namedBreakpoints = sortedBreakpoints.map(bp => {
    let name = 'custom';

    // Common breakpoint standards
    if (bp.width === 640) name = 'sm (Tailwind)';
    else if (bp.width === 768) name = 'md (Tailwind/Bootstrap)';
    else if (bp.width === 1024) name = 'lg (Tailwind)';
    else if (bp.width === 1280) name = 'xl (Tailwind)';
    else if (bp.width === 1536) name = '2xl (Tailwind)';
    else if (bp.width === 576) name = 'sm (Bootstrap)';
    else if (bp.width === 992) name = 'lg (Bootstrap)';
    else if (bp.width === 1200) name = 'xl (Bootstrap)';
    else if (bp.width === 1400) name = 'xxl (Bootstrap)';

    return { ...bp, name };
  });

  return {
    breakpoints: namedBreakpoints,
    totalMediaQueries: mediaQueries.length,
    uniqueBreakpoints: namedBreakpoints.length
  };
}

/**
 * Extracts custom scrollbar styles
 */
function extractScrollbarStyles(): any[] {
  const scrollbars: any[] = [];

  try {
    const sheets = Array.from(document.styleSheets);

    sheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);

        rules.forEach(rule => {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText;

            // Check for webkit scrollbar selectors
            if (selector && (
              selector.includes('::-webkit-scrollbar') ||
              selector.includes('scrollbar-width') ||
              selector.includes('scrollbar-color')
            )) {
              const style = rule.style;
              const scrollbarData: any = {
                selector,
                styles: {}
              };

              // Webkit scrollbar properties
              if (style.width) scrollbarData.styles.width = style.width;
              if (style.height) scrollbarData.styles.height = style.height;
              if (style.backgroundColor) scrollbarData.styles.backgroundColor = style.backgroundColor;
              if (style.borderRadius) scrollbarData.styles.borderRadius = style.borderRadius;

              // Firefox scrollbar properties
              if (style.scrollbarWidth) scrollbarData.styles.scrollbarWidth = style.scrollbarWidth;
              if (style.scrollbarColor) scrollbarData.styles.scrollbarColor = style.scrollbarColor;

              if (Object.keys(scrollbarData.styles).length > 0) {
                scrollbars.push(scrollbarData);
              }
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

  return scrollbars.slice(0, 5);
}

/**
 * Extracts skeleton/loading state components
 */
function extractSkeletonStates(): any[] {
  const skeletons: any[] = [];
  const seen = new Map<string, any>();

  const skeletonSelectors = '[class*="skeleton"], [class*="shimmer"], [class*="placeholder"], [class*="loading"][class*="state"]';
  const elements = document.querySelectorAll(skeletonSelectors);

  elements.forEach(skeleton => {
    const styles = getComputedStyle(skeleton);
    const el = skeleton as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        height: styles.height,
        width: styles.width,
        borderRadius: styles.borderRadius,
        animation: styles.animation
      };

      // Check if it has shimmer/pulse animation
      const hasAnimation = styles.animation !== 'none' ||
                          styles.backgroundImage.includes('gradient');

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: hasAnimation ? 'animated' : 'static',
        count: 1
      };

      skeletons.push(variant);
      seen.set(signature, variant);
    }
  });

  return skeletons.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Extracts empty state components
 */
function extractEmptyStates(): any[] {
  const emptyStates: any[] = [];
  const seen = new Map<string, any>();

  const emptySelectors = '[class*="empty"], [class*="no-data"], [class*="no-results"], [class*="blank-slate"]';
  const elements = document.querySelectorAll(emptySelectors);

  elements.forEach(empty => {
    const styles = getComputedStyle(empty);
    const el = empty as HTMLElement;

    // Should have some content (text or image)
    const hasContent = el.textContent?.trim().length || el.querySelector('img, svg');
    if (!hasContent) return;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        textAlign: styles.textAlign,
        padding: styles.padding,
        color: styles.color,
        fontSize: styles.fontSize
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'empty-state',
        count: 1
      };

      emptyStates.push(variant);
      seen.set(signature, variant);
    }
  });

  return emptyStates.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts date picker components
 */
function extractDatePickers(): any[] {
  const datePickers: any[] = [];
  const seen = new Map<string, any>();

  const dateSelectors = 'input[type="date"], input[type="datetime-local"], [class*="date-picker"], [class*="calendar"], [role="dialog"][aria-label*="date"]';
  const elements = document.querySelectorAll(dateSelectors);

  elements.forEach(picker => {
    const styles = getComputedStyle(picker);
    const el = picker as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'date-picker',
        count: 1
      };

      datePickers.push(variant);
      seen.set(signature, variant);
    }
  });

  return datePickers.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts color picker components
 */
function extractColorPickers(): any[] {
  const colorPickers: any[] = [];
  const seen = new Map<string, any>();

  const colorSelectors = 'input[type="color"], [class*="color-picker"], [class*="colour-picker"]';
  const elements = document.querySelectorAll(colorSelectors);

  elements.forEach(picker => {
    const styles = getComputedStyle(picker);
    const el = picker as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        width: styles.width,
        height: styles.height,
        border: styles.border,
        borderRadius: styles.borderRadius
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'color-picker',
        count: 1
      };

      colorPickers.push(variant);
      seen.set(signature, variant);
    }
  });

  return colorPickers.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts rich text editor components
 */
function extractRichTextEditors(): any[] {
  const editors: any[] = [];
  const seen = new Map<string, any>();

  const editorSelectors = '[contenteditable="true"], [class*="editor"], [class*="rich-text"], [role="textbox"][aria-multiline="true"]';
  const elements = document.querySelectorAll(editorSelectors);

  elements.forEach(editor => {
    const styles = getComputedStyle(editor);
    const el = editor as HTMLElement;

    // Should be reasonably sized
    const rect = el.getBoundingClientRect();
    if (rect.height < 50) return;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        minHeight: styles.minHeight
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'rich-text-editor',
        count: 1
      };

      editors.push(variant);
      seen.set(signature, variant);
    }
  });

  return editors.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts slider/range input components
 */
function extractSliders(): any[] {
  const sliders: any[] = [];
  const seen = new Map<string, any>();

  const sliderSelectors = 'input[type="range"], [role="slider"], [class*="slider"]';
  const elements = document.querySelectorAll(sliderSelectors);

  elements.forEach(slider => {
    const styles = getComputedStyle(slider);
    const el = slider as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        width: styles.width,
        height: styles.height,
        background: styles.backgroundColor
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'slider',
        count: 1
      };

      sliders.push(variant);
      seen.set(signature, variant);
    }
  });

  return sliders.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts advanced select/combobox components
 */
function extractComboboxes(): any[] {
  const comboboxes: any[] = [];
  const seen = new Map<string, any>();

  const comboSelectors = '[role="combobox"], [class*="combobox"], [class*="autocomplete"], [class*="typeahead"]';
  const elements = document.querySelectorAll(comboSelectors);

  elements.forEach(combo => {
    const styles = getComputedStyle(combo);
    const el = combo as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height
      };

      const variant: any = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'combobox',
        count: 1,
        states: extractStateStyles(el)
      };

      comboboxes.push(variant);
      seen.set(signature, variant);
    }
  });

  return comboboxes.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Creates a unique signature for an element based on key styles
 * Rounds padding to nearest 16px to group similar variants together
 */
function createStyleSignature(element: HTMLElement): string {
  const styles = getComputedStyle(element);

  // Round padding to nearest 16px to group variants with minor padding differences
  const paddingLeft = Math.round(parseInt(styles.paddingLeft) / 16) * 16;
  const paddingTop = Math.round(parseInt(styles.paddingTop) / 16) * 16;

  return `${styles.backgroundColor}-${styles.color}-${styles.borderRadius}-${paddingLeft}px-${paddingTop}px-${styles.fontSize}-${styles.fontWeight}`;
}

/**
 * Infers button variant from classes and styles with improved heuristics
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
 * Infers button size variant from padding and font size
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
 * Enhanced typography analysis result
 */
interface TypographyAnalysis {
  headings: { [tag: string]: any };
  body: any[];
  typeScale: TypeScaleAnalysis;
  lineHeightPatterns: LineHeightPattern[];
}

/**
 * Type scale analysis
 */
interface TypeScaleAnalysis {
  baseSize: number;
  ratio: number;
  ratioName: string;
  scale: number[];
  confidence: string;
}

/**
 * Line height pattern
 */
interface LineHeightPattern {
  value: string;
  ratio: number;
  count: number;
  usage: string;
}

/**
 * Extracts comprehensive typography context with semantic usage
 */
function extractTypographyContext(): TypographyAnalysis {
  const headings: { [tag: string]: any } = {};
  const bodyMap = new Map<string, any>();
  const inferredHeadingsMap = new Map<string, any>();
  const allFontSizes: number[] = [];
  const lineHeightMap = new Map<string, { count: number; fontSize: number[] }>();

  // Extract semantic heading styles (h1-h6 tags)
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    const elements = document.querySelectorAll(tag);
    if (elements.length === 0) return;

    const firstElement = elements[0] as HTMLElement;
    const styles = getComputedStyle(firstElement);
    const actualFontSize = parseFloat(styles.fontSize);

    allFontSizes.push(actualFontSize);
    trackLineHeight(styles.lineHeight, actualFontSize, lineHeightMap);

    headings[tag] = {
      fontSize: `${actualFontSize}px`,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      color: styles.color,
      usage: `${tag.toUpperCase()} headings`,
      examples: Array.from(elements).slice(0, 2).map(el =>
        el.textContent?.substring(0, 50) || ''
      ),
      tag,
      count: elements.length
    };
  });

  // Extract text styles from actual content-bearing elements
  // Scan more elements for comprehensive analysis
  const bodySelectors = 'p, span:not([class*="icon"]), div, a, button, label, li, td, th, figcaption, small, strong, em';
  const bodyElements = document.querySelectorAll(bodySelectors);
  const maxBodyElements = Math.min(bodyElements.length, 500); // Increased for better coverage

  for (let i = 0; i < maxBodyElements; i++) {
    const element = bodyElements[i] as HTMLElement;
    const text = element.textContent?.trim() || '';

    // Skip if no meaningful text
    if (text.length < 2 || text.length > 300) continue;

    // Filter out container elements
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim() || '')
      .join(' ')
      .trim();

    // Skip if it's mainly a container
    if (element.children.length > 2 && directText.length < 10) continue;

    // Skip if it contains structural elements
    const hasStructuralChildren = element.querySelector('div, section, article, aside, main') !== null;
    if (hasStructuralChildren && element.children.length > 0) continue;

    const styles = getComputedStyle(element);
    const actualFontSize = parseFloat(styles.fontSize);
    const weight = parseInt(styles.fontWeight);

    // Track all font sizes for scale detection
    allFontSizes.push(actualFontSize);
    trackLineHeight(styles.lineHeight, actualFontSize, lineHeightMap);

    // Use actual font size in signature
    const signature = `${actualFontSize}px-${weight}-${styles.lineHeight}`;

    // Enhanced heading detection with better heuristics
    const isHeading = detectIfHeading(element, actualFontSize, weight, text);

    if (isHeading) {
      // This looks like a heading - add to inferred headings
      const headingLevel = inferHeadingLevelFromSize(actualFontSize);
      const headingKey = `${headingLevel} (inferred)`;

      if (!inferredHeadingsMap.has(headingKey)) {
        const cleanText = text.replace(/\s+/g, ' ').substring(0, 50);

        inferredHeadingsMap.set(headingKey, {
          fontSize: `${actualFontSize}px`,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          color: styles.color,
          usage: `${headingLevel} headings (inferred from ${actualFontSize}px text)`,
          examples: [cleanText + (text.length > 50 ? '...' : '')],
          tag: headingLevel,
          count: 1
        });
      } else {
        inferredHeadingsMap.get(headingKey)!.count++;
      }
    } else {
      // This is body text - classify with enhanced categories
      if (!bodyMap.has(signature)) {
        const usage = classifyBodyText(element, actualFontSize, weight);
        const cleanText = text.replace(/\s+/g, ' ').substring(0, 60);

        bodyMap.set(signature, {
          fontSize: `${actualFontSize}px`,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          color: styles.color,
          usage,
          examples: [cleanText + (text.length > 60 ? '...' : '')],
          tag: element.tagName.toLowerCase(),
          count: 1
        });
      } else {
        // Increment count for existing signature
        const existing = bodyMap.get(signature)!;
        existing.count++;
      }
    }
  }

  // Merge inferred headings into the headings object
  for (const [key, heading] of inferredHeadingsMap.entries()) {
    headings[key] = heading;
  }

  // Sort body text by count (most common first)
  const sortedBody = Array.from(bodyMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Show top 8 for better coverage

  // Analyze type scale
  const typeScale = analyzeTypeScale(allFontSizes);

  // Analyze line-height patterns
  const lineHeightPatterns = analyzeLineHeightPatterns(lineHeightMap);

  return {
    headings,
    body: sortedBody,
    typeScale,
    lineHeightPatterns
  };
}

/**
 * Enhanced heading detection with multiple heuristics
 */
function detectIfHeading(element: HTMLElement, fontSize: number, weight: number, text: string): boolean {
  const tagName = element.tagName.toLowerCase();

  // Don't classify buttons, links in nav, or form elements as headings
  if (tagName === 'button') return false;
  if (tagName === 'a' && element.closest('nav, header')) return false;
  if (tagName === 'label') return false;

  // Check visual hierarchy
  const isLargeAndBold = fontSize >= 18 && weight >= 600;
  const isVeryLarge = fontSize >= 24;
  const isExtraLarge = fontSize >= 32;

  // Check text characteristics
  const isShortText = text.length < 80; // Headings are typically short
  const isCapitalized = text.length > 0 && text[0] === text[0].toUpperCase();

  // Check semantic markers
  const hasHeadingClass = element.className.toLowerCase().match(/title|heading|headline|display/);

  // Combine heuristics
  if (isExtraLarge) return true; // Very large text is almost always a heading
  if (isVeryLarge && isShortText) return true;
  if (isLargeAndBold && isShortText && isCapitalized) return true;
  if (hasHeadingClass && fontSize >= 16) return true;

  return false;
}

/**
 * Enhanced body text classification
 */
function classifyBodyText(element: HTMLElement, fontSize: number, weight: number): string {
  const tagName = element.tagName.toLowerCase();
  const className = element.className.toLowerCase();

  // UI Text (buttons, menus, nav)
  if (tagName === 'button' || element.getAttribute('role') === 'button') {
    return 'UI: Button text';
  }
  if (tagName === 'a' && element.closest('nav, header')) {
    return 'UI: Navigation';
  }
  if (className.includes('menu') || className.includes('dropdown')) {
    return 'UI: Menu items';
  }

  // Caption/Meta text (small text, usually under 13px)
  if (fontSize < 13 || tagName === 'small' || className.includes('caption')) {
    return 'Caption/Meta text';
  }
  if (tagName === 'figcaption') {
    return 'Caption: Figure caption';
  }
  if (className.includes('meta') || className.includes('timestamp')) {
    return 'Caption: Metadata';
  }

  // Label text
  if (tagName === 'label' || className.includes('label')) {
    return 'Label: Form label';
  }
  if (tagName === 'th') {
    return 'Label: Table header';
  }

  // Content text (paragraphs, articles)
  if (tagName === 'p') {
    return 'Content: Paragraph';
  }
  if (tagName === 'td' || tagName === 'li') {
    return 'Content: Body text';
  }
  if (element.closest('article, main, section')) {
    return 'Content: Article text';
  }

  // Link text
  if (tagName === 'a') {
    return 'Link text';
  }

  // Emphasis
  if (tagName === 'strong' || weight >= 600) {
    return 'Content: Emphasized text';
  }

  return 'Body text';
}

/**
 * Tracks line-height values for pattern analysis
 */
function trackLineHeight(lineHeight: string, fontSize: number, lineHeightMap: Map<string, { count: number; fontSize: number[] }>): void {
  if (!lineHeight || lineHeight === 'normal') return;

  if (!lineHeightMap.has(lineHeight)) {
    lineHeightMap.set(lineHeight, { count: 0, fontSize: [] });
  }

  const entry = lineHeightMap.get(lineHeight)!;
  entry.count++;
  entry.fontSize.push(fontSize);
}

/**
 * Analyzes font sizes to detect type scale ratio
 */
function analyzeTypeScale(fontSizes: number[]): TypeScaleAnalysis {
  if (fontSizes.length < 3) {
    return {
      baseSize: 16,
      ratio: 1,
      ratioName: 'Insufficient data',
      scale: [],
      confidence: 'low'
    };
  }

  // Get unique font sizes, sorted
  const uniqueSizes = Array.from(new Set(fontSizes)).sort((a, b) => a - b);

  // Detect base size (most common small-to-medium size)
  const baseCandidates = fontSizes.filter(s => s >= 12 && s <= 18);
  const baseSize = baseCandidates.length > 0
    ? Math.round(baseCandidates.reduce((a, b) => a + b) / baseCandidates.length)
    : 16;

  // Calculate ratios between consecutive sizes
  const ratios: number[] = [];
  for (let i = 1; i < uniqueSizes.length && i < 6; i++) {
    const ratio = uniqueSizes[i] / uniqueSizes[i - 1];
    if (ratio >= 1.1 && ratio <= 2.0) {
      ratios.push(ratio);
    }
  }

  // If we have ratios, calculate average
  const avgRatio = ratios.length > 0
    ? ratios.reduce((a, b) => a + b) / ratios.length
    : 1;

  // Identify common type scale ratios
  const commonRatios = [
    { value: 1.125, name: 'Major Second (1.125)' },
    { value: 1.2, name: 'Minor Third (1.2)' },
    { value: 1.25, name: 'Major Third (1.25)' },
    { value: 1.333, name: 'Perfect Fourth (1.333)' },
    { value: 1.414, name: 'Augmented Fourth (1.414)' },
    { value: 1.5, name: 'Perfect Fifth (1.5)' },
    { value: 1.618, name: 'Golden Ratio (1.618)' },
    { value: 2, name: 'Octave (2.0)' }
  ];

  // Find closest match
  let closestRatio = commonRatios[0];
  let minDiff = Math.abs(avgRatio - closestRatio.value);

  for (const ratio of commonRatios) {
    const diff = Math.abs(avgRatio - ratio.value);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = ratio;
    }
  }

  // Determine confidence
  let confidence = 'low';
  if (minDiff < 0.05 && ratios.length >= 3) confidence = 'high';
  else if (minDiff < 0.1 && ratios.length >= 2) confidence = 'medium';

  return {
    baseSize,
    ratio: closestRatio.value,
    ratioName: closestRatio.name,
    scale: uniqueSizes.slice(0, 8),
    confidence
  };
}

/**
 * Analyzes line-height patterns
 */
function analyzeLineHeightPatterns(lineHeightMap: Map<string, { count: number; fontSize: number[] }>): LineHeightPattern[] {
  const patterns: LineHeightPattern[] = [];

  for (const [value, data] of lineHeightMap.entries()) {
    // Calculate average ratio (line-height / font-size)
    const avgFontSize = data.fontSize.reduce((a, b) => a + b, 0) / data.fontSize.length;
    const lineHeightPx = parseFloat(value);
    const ratio = lineHeightPx / avgFontSize;

    // Determine usage category
    let usage = 'Body text';
    if (ratio <= 1.2) usage = 'Tight (headings)';
    else if (ratio >= 1.6) usage = 'Loose (content)';
    else if (ratio >= 1.4 && ratio < 1.6) usage = 'Normal (body)';

    patterns.push({
      value,
      ratio: Math.round(ratio * 100) / 100,
      count: data.count,
      usage
    });
  }

  // Sort by count (most common first)
  patterns.sort((a, b) => b.count - a.count);

  return patterns.slice(0, 5);
}

/**
 * Infer heading level from font size (for inferred headings)
 */
function inferHeadingLevelFromSize(fontSize: number): string {
  if (fontSize >= 32) return 'h1';
  if (fontSize >= 24) return 'h2';
  if (fontSize >= 20) return 'h3';
  if (fontSize >= 18) return 'h4';
  if (fontSize >= 16) return 'h5';
  return 'h6';
}

/**
 * Builds a map of CSS variable names to their computed color values
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

/**
 * Extracts color usage context with CSS variable mapping
 */
function extractColorContext(): any {
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
function extractSpacingScale(): any {
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

/**
 * Extracts layout patterns
 */
function extractLayoutPatterns(): any {
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
 */
function extractBreakpoints(): number[] {
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

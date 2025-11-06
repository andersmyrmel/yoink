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
    shadows: extractShadows()
  };

  // Add component patterns and context if requested
  if (includeComponents) {
    styleData.components = extractComponents();
    styleData.typographyContext = extractTypographyContext();
    styleData.colorContext = extractColorContext();
    styleData.layoutPatterns = extractLayoutPatterns();
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

/**
 * Extracts component patterns from the page
 */
function extractComponents(): any {
  return {
    buttons: extractButtons(),
    cards: extractCards(),
    inputs: extractInputs(),
    navigation: extractNavigation(),
    headings: extractHeadings()
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
 * Extracts hover, focus, and disabled states from classes
 */
function extractStateStyles(element: HTMLElement): any {
  const states: any = {};
  const classes = Array.from(element.classList);

  // Extract hover states
  const hoverClasses = classes.filter(c => c.includes('hover:'));
  if (hoverClasses.length > 0) {
    states.hover = {};
    hoverClasses.forEach(cls => {
      const parts = cls.split('hover:')[1];
      if (parts.includes('bg-')) states.hover.background = parts;
      if (parts.includes('text-')) states.hover.color = parts;
      if (parts.includes('opacity-')) states.hover.opacity = parts;
    });
  }

  // Extract focus states
  const focusClasses = classes.filter(c => c.includes('focus:'));
  if (focusClasses.length > 0) {
    states.focus = {};
    focusClasses.forEach(cls => {
      const parts = cls.split('focus:')[1];
      if (parts.includes('ring')) states.focus.ring = parts;
      if (parts.includes('outline')) states.focus.outline = parts;
    });
  }

  // Extract disabled states
  const disabledClasses = classes.filter(c => c.includes('disabled:'));
  if (disabledClasses.length > 0) {
    states.disabled = {};
    disabledClasses.forEach(cls => {
      const parts = cls.split('disabled:')[1];
      states.disabled[parts] = true;
    });
  }

  return Object.keys(states).length > 0 ? states : undefined;
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

  // Handle oklch, oklab, hsl, and other CSS color formats
  // Use browser's color computation
  if (color.includes('oklch') || color.includes('oklab') || color.includes('hsl') || color.includes('lab')) {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.display = 'none';
      tempDiv.style.color = color;
      document.body.appendChild(tempDiv);

      const computed = getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);

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
  if (btn1.variant !== btn2.variant) return false;

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
      if (bgDistance > 0.15) return false; // More forgiving for ghost/outline
    }
  } else {
    // For filled buttons, enforce stricter color matching
    const bgDistance = calculateColorDistance(bg1, bg2);
    if (bgDistance > 0.12) return false;
  }

  // 3. Compare text colors (more forgiving for ghost/outline variants)
  const textDistance = calculateColorDistance(styles1.color || 'rgb(0,0,0)', styles2.color || 'rgb(0,0,0)');

  if (isGhostOrOutline) {
    // Ghost/outline buttons often have varying text shades (dark, medium, light gray)
    if (textDistance > 0.20) return false; // Very forgiving: ~50 RGB units
  } else {
    if (textDistance > 0.12) return false; // Standard tolerance for filled buttons
  }

  // 4. Compare border-radius (very forgiving for same variant type)
  const radius1 = parseFloat(styles1.borderRadius) || 0;
  const radius2 = parseFloat(styles2.borderRadius) || 0;
  const radiusDiff = Math.abs(radius1 - radius2);

  // Ghost/outline buttons often have 0px (flat) or 8px (rounded) - both are acceptable
  if (isGhostOrOutline || isSecondarySized) {
    if (radiusDiff > 10) return false; // Very forgiving: 0px vs 10px is okay
  } else {
    if (radiusDiff > 6) return false;
  }

  // 5. Compare padding (size variants often differ here, be forgiving)
  const padding1 = parsePaddingValue(styles1.padding || '0px');
  const padding2 = parsePaddingValue(styles2.padding || '0px');
  const paddingDiff = Math.abs(padding1 - padding2);
  if (paddingDiff > 12) return false;

  // 6. Compare font size (size variants differ here, be very forgiving)
  const fontSize1 = parseFloat(styles1.fontSize) || 14;
  const fontSize2 = parseFloat(styles2.fontSize) || 14;
  const fontDiff = Math.abs(fontSize1 - fontSize2);

  // Small buttons (10-12px) vs Medium (14-16px) vs Large (18-20px) should merge
  if (fontDiff > 6) return false;

  // If fonts are significantly different (>4px), require closer padding match
  if (fontDiff > 4 && paddingDiff > 6) return false;

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
 * Extracts card components
 */
function extractCards(): any[] {
  const cards: any[] = [];
  const seen = new Map<string, any>();

  // Look for elements that look like cards
  const cardSelectors = '[class*="card"], article, [class*="panel"], [class*="box"]';
  const elements = document.querySelectorAll(cardSelectors);

  elements.forEach(card => {
    const styles = getComputedStyle(card);

    // Filter: must have border or shadow to be considered a card
    const hasBorder = styles.border !== 'none' && styles.borderWidth !== '0px';
    const hasShadow = styles.boxShadow !== 'none';

    if (!hasBorder && !hasShadow) return;

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
        margin: styles.margin
      };

      const variant: any = {
        html: (card as HTMLElement).outerHTML.substring(0, 500),
        classes: (card as HTMLElement).className || '',
        styles: componentStyles,
        variant: 'card',
        count: 1
      };

      cards.push(variant);
      seen.set(signature, variant);
    }
  });

  return cards.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts form input components
 */
function extractInputs(): any[] {
  const inputs: any[] = [];
  const seen = new Map<string, any>();

  const inputSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';
  const elements = document.querySelectorAll(inputSelectors);

  elements.forEach(input => {
    const styles = getComputedStyle(input);
    const signature = createStyleSignature(input as HTMLElement);

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
        height: styles.height
      };

      const variant: any = {
        html: (input as HTMLElement).outerHTML.substring(0, 500),
        classes: (input as HTMLElement).className || '',
        styles: componentStyles,
        variant: (input as HTMLElement).tagName.toLowerCase(),
        count: 1
      };

      inputs.push(variant);
      seen.set(signature, variant);
    }
  });

  return inputs.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts navigation components
 */
function extractNavigation(): any[] {
  const navItems: any[] = [];
  const seen = new Map<string, any>();

  const navSelectors = 'nav a, [role="navigation"] a, header a';
  const elements = document.querySelectorAll(navSelectors);

  elements.forEach(navItem => {
    const styles = getComputedStyle(navItem);
    const signature = createStyleSignature(navItem as HTMLElement);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: any = {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        padding: styles.padding,
        textDecoration: styles.textDecoration
      };

      const variant: any = {
        html: (navItem as HTMLElement).outerHTML.substring(0, 500),
        classes: (navItem as HTMLElement).className || '',
        styles: componentStyles,
        variant: 'nav-link',
        count: 1
      };

      navItems.push(variant);
      seen.set(signature, variant);
    }
  });

  return navItems.sort((a, b) => b.count - a.count).slice(0, 3);
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
 * Extracts typography context with semantic usage
 */
function extractTypographyContext(): any {
  const headings: { [tag: string]: any } = {};
  const bodyMap = new Map<string, any>();
  const inferredHeadingsMap = new Map<string, any>();

  // Extract semantic heading styles (h1-h6 tags)
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    const elements = document.querySelectorAll(tag);
    if (elements.length === 0) return;

    const firstElement = elements[0] as HTMLElement;
    const styles = getComputedStyle(firstElement);
    const actualFontSize = parseFloat(styles.fontSize);

    headings[tag] = {
      fontSize: `${actualFontSize}px`,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      color: styles.color,
      usage: `${tag.toUpperCase()} headings`,
      examples: Array.from(elements).slice(0, 2).map(el =>
        el.textContent?.substring(0, 50) || ''
      ),
      tag
    };
  });

  // Extract text styles from actual content-bearing elements
  // Use more specific selectors and filter out containers
  const bodySelectors = 'p, span:not([class*="icon"]), div, a, button, label, li';
  const bodyElements = document.querySelectorAll(bodySelectors);
  const maxBodyElements = Math.min(bodyElements.length, 200); // Increased to get better coverage

  for (let i = 0; i < maxBodyElements; i++) {
    const element = bodyElements[i] as HTMLElement;
    const text = element.textContent?.trim() || '';

    // Skip if no meaningful text
    if (text.length < 3 || text.length > 200) continue;

    // Filter out container elements more aggressively
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim() || '')
      .join(' ')
      .trim();

    // Skip if it's mainly a container
    if (element.children.length > 1 && directText.length < 15) continue;

    // Skip if it contains structural elements (containers with nested divs/sections)
    const hasStructuralChildren = element.querySelector('div, section, article') !== null;
    if (hasStructuralChildren && element.children.length > 0) continue;

    // Skip button and link elements - they're extracted separately in component patterns
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'button' || (tagName === 'a' && element.getAttribute('role') === 'button')) continue;

    const styles = getComputedStyle(element);
    const actualFontSize = parseFloat(styles.fontSize);
    const weight = parseInt(styles.fontWeight);

    // Use actual font size in signature
    const signature = `${actualFontSize}px-${weight}-${styles.lineHeight}`;

    // Detect if this should be a heading based on size and weight
    // Be conservative: only large + bold text, or very large text
    // Don't classify navigation text as headings - it's body text
    const isLargeAndBold = actualFontSize >= 16 && weight >= 600;
    const isVeryLarge = actualFontSize >= 20;
    const isHeading = isLargeAndBold || isVeryLarge || (actualFontSize >= 18 && weight >= 700);

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
          tag: headingLevel
        });
      }
    } else {
      // This is body text
      if (!bodyMap.has(signature)) {
        // Infer semantic usage from tag and context
        let usage = 'Body text';
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'p') usage = 'Paragraph text';
        else if (tagName === 'a' && element.closest('nav')) usage = 'Navigation links';
        else if (tagName === 'a') usage = 'Link text';
        else if (tagName === 'button') usage = 'Button text';
        else if (tagName === 'label') usage = 'Label text';
        else if (element.classList.toString().includes('caption')) usage = 'Caption text';

        const cleanText = text.replace(/\s+/g, ' ').substring(0, 60);

        bodyMap.set(signature, {
          fontSize: `${actualFontSize}px`,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          color: styles.color,
          usage,
          examples: [cleanText + (text.length > 60 ? '...' : '')],
          tag: tagName,
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
    .slice(0, 5); // Show top 5 instead of 3

  return {
    headings,
    body: sortedBody
  };
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

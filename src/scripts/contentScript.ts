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
 * Extracts button components with variants
 */
function extractButtons(): any[] {
  const buttons: any[] = [];
  const seen = new Map<string, any>();

  const buttonSelectors = 'button, [role="button"], a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]';
  const elements = document.querySelectorAll(buttonSelectors);

  elements.forEach(btn => {
    const styles = getComputedStyle(btn);
    const signature = createStyleSignature(btn as HTMLElement);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
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

      const variant: any = {
        html: getCleanHTML(btn as HTMLElement),
        classes: (btn as HTMLElement).className || '',
        styles: componentStyles,
        variant: inferVariant(btn as HTMLElement),
        count: 1,
        stateStyles: extractStateStyles(btn as HTMLElement)
      };

      buttons.push(variant);
      seen.set(signature, variant);
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
 * Infers button variant from classes and styles
 */
function inferVariant(button: HTMLElement): string {
  const classes = button.className.toLowerCase();

  if (classes.includes('primary')) return 'primary';
  if (classes.includes('secondary')) return 'secondary';
  if (classes.includes('ghost') || classes.includes('outline')) return 'outline';
  if (classes.includes('danger') || classes.includes('destructive')) return 'danger';

  // Fallback: analyze background color
  const styles = getComputedStyle(button);
  const bg = styles.backgroundColor;

  if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return 'ghost';

  return 'default';
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
 * Extracts layout patterns
 */
function extractLayoutPatterns(): any {
  const layout: any = {
    containers: [],
    breakpoints: extractBreakpoints(),
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

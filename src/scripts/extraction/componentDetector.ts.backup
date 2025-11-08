import {
  getCleanHTML,
  getMatchingCSSRules,
  calculateColorDistance,
  parsePaddingValue,
  getButtonTextFontSize
} from '../utils/styleHelpers';

/**
 * Extracts component patterns from the page
 */
export function extractComponents(): any {
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
 * Extracts interactive state styles (hover, focus, active, disabled) from CSS and element
 */
export function extractStateStyles(element: HTMLElement): any {
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
 * Checks if two buttons are visually similar enough to be merged
 * Uses weighted scoring for colors (most important) and structure (less important)
 * More forgiving tolerances to reduce variant fragmentation
 * Variant-aware: buttons with same semantic variant (ghost, outline, etc.) merge more easily
 */
export function areButtonsSimilar(btn1: any, btn2: any): boolean {
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
 * Extracts button components with variants using visual similarity merging
 */
export function extractButtons(): any[] {
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
export function extractCards(): any[] {
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
export function extractInputs(): any[] {
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
export function extractNavigation(): any[] {
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
export function extractHeadings(): any[] {
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
export function extractDropdowns(): any[] {
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
export function extractTables(): any[] {
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
export function extractModals(): any[] {
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
export function extractTooltips(): any[] {
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
export function extractBadges(): any[] {
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
export function extractAvatars(): any[] {
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
export function extractTabs(): any[] {
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
export function extractAccordions(): any[] {
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
export function extractProgress(): any[] {
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
export function extractBreadcrumbs(): any[] {
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
export function extractPagination(): any[] {
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
export function extractAlerts(): any[] {
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
export function extractSearchBars(): any[] {
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
export function extractToggles(): any[] {
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
export function extractDividers(): any[] {
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
 * Extracts skeleton/loading state components
 */
export function extractSkeletonStates(): any[] {
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
export function extractEmptyStates(): any[] {
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
export function extractDatePickers(): any[] {
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
export function extractColorPickers(): any[] {
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
export function extractRichTextEditors(): any[] {
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
export function extractSliders(): any[] {
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
export function extractComboboxes(): any[] {
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

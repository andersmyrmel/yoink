import { getCleanHTML } from '../../utils/styleHelpers';

/**
 * Represents style information for a component variant
 */
interface ComponentStyles {
  [key: string]: string | undefined | ComponentStyles;
}

/**
 * Represents state-specific styles (hover, focus, active, disabled)
 */
interface StateStyles {
  hover?: {
    backgroundColor?: string;
    color?: string;
    opacity?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
    utilityClasses?: string[];
  };
  focus?: {
    outline?: string;
    boxShadow?: string;
    borderColor?: string;
    utilityClasses?: string[];
  };
  active?: {
    backgroundColor?: string;
    transform?: string;
    boxShadow?: string;
  };
  disabled?: {
    opacity?: string;
    cursor?: string;
    backgroundColor?: string;
    isDisabled?: boolean;
    utilityClasses?: string[];
  };
}

/**
 * Base component variant structure
 */
interface ComponentVariant {
  html: string;
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
  states?: StateStyles;
}

/**
 * Card component variant structure
 */
interface CardVariant extends ComponentVariant {
  variant: 'elevated' | 'flat' | 'interactive' | 'media' | 'default';
}

/**
 * Table component variant structure
 */
interface TableVariant extends ComponentVariant {
  variant: 'table';
  styles: ComponentStyles & {
    header?: {
      background: string;
      color: string;
      fontWeight: string;
      padding: string;
    };
    cell?: {
      padding: string;
      borderBottom: string;
    };
  };
}

/**
 * Heading component variant structure
 */
interface HeadingVariant extends ComponentVariant {
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

/**
 * Divider component variant structure
 */
interface DividerVariant {
  classes: string;
  styles: ComponentStyles;
  variant: 'divider';
  count: number;
}

/**
 * Avatar component variant structure
 */
interface AvatarVariant {
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
}

/**
 * Extracts card components with interactive states from the current page.
 *
 * Searches for elements that visually resemble cards based on their styling
 * (border, shadow, or background). Groups similar cards together and tracks
 * their occurrence count.
 *
 * @returns Array of card variants sorted by frequency, limited to top 10
 *
 * @example
 * ```typescript
 * const cards = extractCards();
 * // Returns: [
 * //   {
 * //     html: '<div class="card">...</div>',
 * //     classes: 'card elevated',
 * //     styles: { background: '#fff', borderRadius: '8px', ... },
 * //     variant: 'elevated',
 * //     count: 15,
 * //     states: { hover: { boxShadow: '...' } }
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractCards(): CardVariant[] {
  const cards: CardVariant[] = [];
  const seen = new Map<string, CardVariant>();

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
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        margin: styles.margin,
        display: styles.display,
        width: styles.width
      };

      const variant: CardVariant = {
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

  return cards.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Extracts table components including both semantic tables and virtualized grid layouts.
 *
 * Detects standard HTML tables as well as modern CSS-based table implementations
 * (display: table, display: grid) including virtualized tables with inline styles.
 * Extracts header and cell styling when available.
 *
 * @returns Array of table variants sorted by frequency, limited to top 10
 *
 * @example
 * ```typescript
 * const tables = extractTables();
 * // Returns: [
 * //   {
 * //     html: '<table>...</table>',
 * //     classes: 'data-table',
 * //     styles: {
 * //       background: '#fff',
 * //       border: '1px solid #e0e0e0',
 * //       header: { background: '#f5f5f5', ... },
 * //       cell: { padding: '12px', ... }
 * //     },
 * //     variant: 'table',
 * //     count: 3
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractTables(): TableVariant[] {
  const tables: TableVariant[] = [];
  const seen = new Map<string, TableVariant>();
  const candidates = new Set<Element>();

  // Strategy 1: Standard semantic selectors
  const standardElements = document.querySelectorAll('table, [role="table"], [role="grid"], [role="treegrid"], [class*="table"]:not(table), [class*="data-grid"], [class*="datagrid"], [data-table], [data-grid]');
  standardElements.forEach(el => candidates.add(el));

  // Strategy 2: Radix UI scroll areas (common in modern table implementations)
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

  // Strategy 3: Scan divs for inline styles with display:table or display:grid
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
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderCollapse: styles.borderCollapse,
        width: styles.width,
        display: styles.display
      };

      // Extract header styles if present
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

      // Extract cell styles
      const cell = el.querySelector('td, [role="cell"], [role="gridcell"], [class*="cell"]:not([class*="header"])');
      if (cell) {
        const cellStyles = getComputedStyle(cell as HTMLElement);
        componentStyles.cell = {
          padding: cellStyles.padding,
          borderBottom: cellStyles.borderBottom
        };
      }

      const variant: TableVariant = {
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
 * Extracts heading components (h1-h6) from the current page.
 *
 * Groups headings by tag, font size, and font weight to identify consistent
 * typography patterns. Useful for extracting design system heading styles.
 *
 * @returns Array of heading variants sorted by frequency
 *
 * @example
 * ```typescript
 * const headings = extractHeadings();
 * // Returns: [
 * //   {
 * //     html: '<h1 class="title">...</h1>',
 * //     classes: 'title',
 * //     styles: {
 * //       fontSize: '32px',
 * //       fontWeight: '700',
 * //       lineHeight: '1.2',
 * //       color: '#000',
 * //       margin: '0 0 16px'
 * //     },
 * //     variant: 'h1',
 * //     count: 5
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractHeadings(): HeadingVariant[] {
  const headings: HeadingVariant[] = [];
  const seen = new Map<string, HeadingVariant>();

  const headingSelectors = 'h1, h2, h3, h4, h5, h6';
  const elements = document.querySelectorAll(headingSelectors);

  elements.forEach(heading => {
    const styles = getComputedStyle(heading);
    const tag = (heading as HTMLElement).tagName.toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const signature = `${tag}-${styles.fontSize}-${styles.fontWeight}`;

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        color: styles.color,
        margin: styles.margin
      };

      const variant: HeadingVariant = {
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
 * Extracts divider/separator components from the current page.
 *
 * Identifies visual dividers including horizontal rules and elements with
 * divider/separator classes. Groups similar dividers by border and spacing.
 *
 * @returns Array of divider variants sorted by frequency, limited to top 3
 *
 * @example
 * ```typescript
 * const dividers = extractDividers();
 * // Returns: [
 * //   {
 * //     classes: 'divider',
 * //     styles: {
 * //       borderTop: '1px solid #e0e0e0',
 * //       borderBottom: 'none',
 * //       height: '1px',
 * //       margin: '16px 0',
 * //       background: 'transparent'
 * //     },
 * //     variant: 'divider',
 * //     count: 12
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractDividers(): DividerVariant[] {
  const dividers: DividerVariant[] = [];
  const seen = new Map<string, DividerVariant>();

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
      const componentStyles: ComponentStyles = {
        borderTop: styles.borderTop,
        borderBottom: styles.borderBottom,
        height: styles.height,
        margin: styles.margin,
        background: styles.backgroundColor
      };

      const variant: DividerVariant = {
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
 * Extracts avatar components from the current page.
 *
 * Identifies user profile images and avatar elements based on class names
 * and sizing. Categorizes by shape (circular/rounded) and size (xs/sm/md/lg/xl).
 *
 * @returns Array of avatar variants sorted by frequency, limited to top 5
 *
 * @example
 * ```typescript
 * const avatars = extractAvatars();
 * // Returns: [
 * //   {
 * //     classes: 'avatar avatar-md',
 * //     styles: {
 * //       width: '40px',
 * //       height: '40px',
 * //       borderRadius: '50%',
 * //       border: 'none',
 * //       objectFit: 'cover'
 * //     },
 * //     variant: 'circular-md',
 * //     count: 8
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractAvatars(): AvatarVariant[] {
  const avatars: AvatarVariant[] = [];
  const seen = new Map<string, AvatarVariant>();

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
      const componentStyles: ComponentStyles = {
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
        borderRadius: styles.borderRadius,
        border: styles.border,
        objectFit: styles.objectFit
      };

      const variant: AvatarVariant = {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a unique signature for an element based on key style properties.
 * Rounds padding to nearest 16px to group similar variants together.
 *
 * @param element - The HTML element to create a signature for
 * @returns A string signature representing the element's visual style
 *
 * @internal
 */
function createStyleSignature(element: HTMLElement): string {
  const styles = getComputedStyle(element);

  // Round padding to nearest 16px to group variants with minor padding differences
  const paddingLeft = Math.round(parseInt(styles.paddingLeft) / 16) * 16;
  const paddingTop = Math.round(parseInt(styles.paddingTop) / 16) * 16;

  return `${styles.backgroundColor}-${styles.color}-${styles.borderRadius}-${paddingLeft}px-${paddingTop}px-${styles.fontSize}-${styles.fontWeight}`;
}

/**
 * Infers card variant from classes or structure.
 *
 * Analyzes class names and DOM structure to categorize cards as:
 * - elevated: Has shadow or "raised" appearance
 * - flat: Outlined or minimal styling
 * - interactive: Clickable or has interactive classes
 * - media: Contains image or video content
 * - default: Standard card appearance
 *
 * @param card - The card element to analyze
 * @returns The inferred variant name
 *
 * @internal
 */
function inferCardVariant(card: HTMLElement): 'elevated' | 'flat' | 'interactive' | 'media' | 'default' {
  const className = card.className.toLowerCase();

  if (className.includes('elevated') || className.includes('raised')) return 'elevated';
  if (className.includes('flat') || className.includes('outlined')) return 'flat';
  if (className.includes('interactive') || className.includes('clickable')) return 'interactive';
  if (card.querySelector('img, video')) return 'media';

  return 'default';
}

/**
 * Extracts interactive state styles (hover, focus, active, disabled) from CSS rules
 * and element attributes.
 *
 * Attempts to read pseudo-class styles from matching CSS rules. Falls back to
 * detecting utility class patterns (e.g., Tailwind's hover:, focus: prefixes).
 *
 * @param element - The element to extract state styles from
 * @returns State styles object or undefined if no states found
 *
 * @internal
 */
function extractStateStyles(element: HTMLElement): StateStyles | undefined {
  const states: StateStyles = {};

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
 * Gets all CSS rules that match a given element.
 *
 * Iterates through all stylesheets in the document and returns rules whose
 * selectors match the element. Handles cross-origin stylesheet errors gracefully.
 *
 * @param element - The element to find matching CSS rules for
 * @returns Array of CSS rules that apply to the element
 *
 * @internal
 */
function getMatchingCSSRules(element: HTMLElement): CSSStyleRule[] {
  const matchingRules: CSSStyleRule[] = [];

  try {
    const sheets = Array.from(document.styleSheets);

    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);

        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            try {
              if (element.matches(rule.selectorText)) {
                matchingRules.push(rule);
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }
  } catch (e) {
    // Error accessing stylesheets
  }

  return matchingRules;
}

/**
 * Infers avatar variant from size and shape.
 *
 * Categorizes avatars by:
 * - Shape: circular (50% border-radius) or rounded (smaller radius)
 * - Size: xs (≤24px), sm (≤32px), md (≤48px), lg (≤64px), xl (>64px)
 *
 * @param avatar - The avatar element
 * @param styles - Computed styles of the avatar
 * @returns Variant string in format "{shape}-{size}" (e.g., "circular-md")
 *
 * @internal
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

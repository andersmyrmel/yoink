import { getCleanHTML, getClassName } from '../../utils/styleHelpers';
import { NavigationComponent, TabComponent } from '../../types/extraction';
import { extractStateStyles, createStyleSignature } from '../../utils/componentHelpers';

/**
 * Interface for extracted component data
 */
interface ComponentData {
  html: string;
  classes: string;
  styles: Record<string, string>;
  variant: string;
  count: number;
  states?: Record<string, unknown>;
}

/**
 * Interface for navigation component styles
 */
interface NavigationStyles extends Record<string, string> {
  color: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  textDecoration: string;
  background: string;
  borderRadius: string;
}

/**
 * Interface for breadcrumb component styles
 */
interface BreadcrumbStyles extends Record<string, string> {
  fontSize: string;
  color: string;
  display: string;
}

/**
 * Interface for pagination component styles
 */
interface PaginationStyles {
  display: string;
  gap: string;
  item?: {
    padding: string;
    background: string;
    border: string;
    borderRadius: string;
    fontSize: string;
  };
  [key: string]: string | unknown;
}

/**
 * Interface for tab component styles
 */
interface TabStyles extends Record<string, string> {
  color: string;
  background: string;
  borderBottom: string;
  padding: string;
  fontSize: string;
  fontWeight: string;
}

/**
 * Infers navigation variant from classes or attributes.
 * Determines whether a navigation item is active, primary, secondary, or default.
 *
 * @param navItem - The navigation HTML element to analyze
 * @returns The inferred variant type ('active', 'primary', 'secondary', or 'default')
 */
function inferNavVariant(navItem: HTMLElement): string {
  const className = getClassName(navItem).toLowerCase();
  const isActive = className.includes('active') || navItem.getAttribute('aria-current') === 'page';

  if (isActive) return 'active';
  if (className.includes('primary')) return 'primary';
  if (className.includes('secondary')) return 'secondary';

  return 'default';
}

/**
 * Extracts navigation components from the page with their active states and styles.
 * Searches for navigation links in nav elements, headers, and menu components.
 * Groups similar navigation items together and tracks their occurrence count.
 *
 * @returns An array of navigation component data objects, sorted by frequency,
 *          limited to the top 5 most common variants
 *
 * @example
 * ```typescript
 * const navItems = extractNavigation();
 * // Returns: [
 * //   {
 * //     html: '<a href="..." class="nav-link">Home</a>',
 * //     classes: 'nav-link active',
 * //     styles: { color: 'rgb(0, 0, 0)', fontSize: '14px', ... },
 * //     variant: 'active',
 * //     count: 1,
 * //     states: { hover: { color: 'rgb(100, 100, 100)' } }
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractNavigation(): NavigationComponent[] {
  const navItems: NavigationComponent[] = [];
  const seen = new Map<string, NavigationComponent>();

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
      const componentStyles: NavigationStyles = {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        padding: styles.padding,
        textDecoration: styles.textDecoration,
        background: styles.backgroundColor,
        borderRadius: styles.borderRadius
      };

      const variant: NavigationComponent = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferNavVariant(el) as 'active' | 'primary' | 'secondary' | 'default',
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
 * Extracts breadcrumb navigation components from the page.
 * Identifies breadcrumb trails by looking for elements with breadcrumb-related
 * attributes or classes that contain multiple links.
 *
 * @returns An array of breadcrumb component data objects, sorted by frequency,
 *          limited to the top 3 most common variants
 *
 * @example
 * ```typescript
 * const breadcrumbs = extractBreadcrumbs();
 * // Returns: [
 * //   {
 * //     html: '<nav><a>Home</a> / <a>Products</a> / <span>Item</span></nav>',
 * //     classes: 'breadcrumb',
 * //     styles: { fontSize: '14px', color: 'rgb(100, 100, 100)', ... },
 * //     variant: 'breadcrumb',
 * //     count: 1
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractBreadcrumbs(): ComponentData[] {
  const breadcrumbs: ComponentData[] = [];
  const seen = new Map<string, ComponentData>();

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
      const componentStyles: BreadcrumbStyles = {
        fontSize: styles.fontSize,
        color: styles.color,
        display: styles.display
      };

      const variant: ComponentData = {
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
 * Extracts pagination components from the page.
 * Identifies pagination controls by looking for navigation elements with
 * pagination-related attributes or classes. Captures both the container
 * styles and individual pagination item styles.
 *
 * @returns An array of pagination component data objects, sorted by frequency,
 *          limited to the top 3 most common variants
 *
 * @example
 * ```typescript
 * const pagination = extractPagination();
 * // Returns: [
 * //   {
 * //     html: '<nav><button>1</button><button>2</button>...</nav>',
 * //     classes: 'pagination',
 * //     styles: {
 * //       display: 'flex',
 * //       gap: '8px',
 * //       item: { padding: '8px 12px', background: 'white', ... }
 * //     },
 * //     variant: 'pagination',
 * //     count: 1
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractPagination(): ComponentData[] {
  const pagination: ComponentData[] = [];
  const seen = new Map<string, ComponentData>();

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
      const componentStyles: PaginationStyles = {
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

      const variant: ComponentData = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles as Record<string, string>,
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
 * Extracts tab components from the page with their active/inactive states.
 * Identifies tabs by looking for elements with role="tab" or tab-related classes.
 * Distinguishes between active and inactive tab states based on aria-selected
 * attribute or active class presence.
 *
 * @returns An array of tab component data objects, sorted by frequency,
 *          limited to the top 3 most common variants
 *
 * @example
 * ```typescript
 * const tabs = extractTabs();
 * // Returns: [
 * //   {
 * //     html: '<button role="tab" aria-selected="true">Home</button>',
 * //     classes: 'tab active',
 * //     styles: {
 * //       color: 'rgb(0, 0, 0)',
 * //       background: 'white',
 * //       borderBottom: '2px solid blue',
 * //       ...
 * //     },
 * //     variant: 'active',
 * //     count: 1,
 * //     states: { hover: { color: 'rgb(50, 50, 50)' } }
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractTabs(): TabComponent[] {
  const tabs: TabComponent[] = [];
  const seen = new Map<string, TabComponent>();

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
      const isActive = el.getAttribute('aria-selected') === 'true' || getClassName(el).includes('active');

      const componentStyles: TabStyles = {
        color: styles.color,
        background: styles.backgroundColor,
        borderBottom: styles.borderBottom,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight
      };

      const variant: TabComponent = {
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

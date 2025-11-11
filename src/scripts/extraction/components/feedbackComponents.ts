import { getCleanHTML, getClassName } from '../../utils/styleHelpers';
import {
  AlertComponent,
  BadgeComponent,
  SkeletonComponent,
  ComponentVariant
} from '../../types/extraction';
import { createStyleSignature } from '../../utils/componentHelpers';

/**
 * Extracts alert and banner components from the page.
 *
 * Searches for elements with role="alert" or classes containing "alert", "banner",
 * or "notification" (excluding toast notifications). Groups similar alerts together
 * based on their visual styling and returns the most common variants.
 *
 * @returns Array of up to 5 most common alert variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const alerts = extractAlerts();
 * // Returns: [
 * //   {
 * //     html: '<div role="alert">...</div>',
 * //     classes: 'alert alert-success',
 * //     styles: { background: 'rgb(0, 255, 0)', color: 'rgb(0, 0, 0)', ... },
 * //     variant: 'success',
 * //     count: 3
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractAlerts(): AlertComponent[] {
  const alerts: AlertComponent[] = [];
  const seen = new Map<string, AlertComponent>();

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
      const componentStyles: Record<string, string> = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize
      };

      const variant: AlertComponent = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferAlertVariant(el) as 'success' | 'error' | 'warning' | 'info' | 'alert' | 'default',
        count: 1
      };

      alerts.push(variant);
      seen.set(signature, variant);
    }
  });

  return alerts.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers the alert variant type from element classes or ARIA attributes.
 *
 * @param alert - The alert HTML element to analyze
 * @returns The inferred variant type (success, error, warning, info, alert, or default)
 */
function inferAlertVariant(alert: HTMLElement): string {
  const className = getClassName(alert).toLowerCase();
  const role = alert.getAttribute('role');
  const styles = getComputedStyle(alert);

  // Check class names first
  if (className.includes('success')) return 'success';
  if (className.includes('error') || className.includes('danger')) return 'error';
  if (className.includes('warning')) return 'warning';
  if (className.includes('info')) return 'info';
  if (role === 'alert') return 'alert';

  // Analyze colors to infer semantic variant
  const bgColor = styles.backgroundColor.toLowerCase();
  const borderColor = styles.borderColor?.toLowerCase() || '';

  // Helper to detect color dominance
  const hasColorDominance = (colorStr: string, targetChannel: 'r' | 'g' | 'b') => {
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return false;
    const [_, r, g, b] = match.map(Number);
    const values = { r, g, b };
    const target = values[targetChannel];
    const others = Object.entries(values).filter(([k]) => k !== targetChannel).map(([_, v]) => v);
    return target > Math.max(...others) && target > 150;
  };

  // Check background or border for semantic colors
  const checkColor = (c: string) => {
    if (hasColorDominance(c, 'g')) return 'success';
    if (hasColorDominance(c, 'r')) return 'error';
    if (hasColorDominance(c, 'b')) return 'info';
    if (c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) && c.includes('rgb(') &&
        parseInt(c.match(/rgb\((\d+)/)?.[1] || '0') > 200 &&
        parseInt(c.match(/,\s*(\d+)/)?.[1] || '0') > 150) {
      return 'warning';
    }
    return null;
  };

  const bgVariant = checkColor(bgColor);
  if (bgVariant) return bgVariant;

  const borderVariant = checkColor(borderColor);
  if (borderVariant) return borderVariant;

  return 'default';
}

/**
 * Extracts modal and dialog components from the page.
 *
 * Searches for elements with role="dialog", role="alertdialog", aria-modal="true",
 * or classes containing "modal" or "dialog". Groups similar modals together based
 * on their visual styling and returns the most common variants.
 *
 * @returns Array of up to 10 most common modal variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const modals = extractModals();
 * // Returns: [
 * //   {
 * //     html: '<div role="dialog">...</div>',
 * //     classes: 'modal modal-lg',
 * //     styles: { background: 'rgb(255, 255, 255)', padding: '24px', ... },
 * //     variant: 'modal',
 * //     count: 2
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractModals(): ComponentVariant[] {
  const modals: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

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
      const componentStyles: Record<string, string> = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        maxWidth: styles.maxWidth,
        zIndex: styles.zIndex,
        position: styles.position
      };

      const variant: ComponentVariant = {
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

  return modals.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Extracts tooltip and popover components from the page.
 *
 * Searches for elements with role="tooltip" or classes containing "tooltip" or
 * "popover" (excluding menu popovers). Groups similar tooltips together based on
 * their visual styling and returns the most common variants.
 *
 * @returns Array of up to 3 most common tooltip variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const tooltips = extractTooltips();
 * // Returns: [
 * //   {
 * //     html: '<div role="tooltip">...</div>',
 * //     classes: 'tooltip tooltip-top',
 * //     styles: { background: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)', ... },
 * //     variant: 'tooltip',
 * //     count: 5
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractTooltips(): ComponentVariant[] {
  const tooltips: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

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
      const componentStyles: Record<string, string> = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        boxShadow: styles.boxShadow,
        zIndex: styles.zIndex
      };

      const variant: ComponentVariant = {
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
 * Extracts badge, tag, chip, and pill components from the page.
 *
 * Searches for elements with classes containing "badge", "tag", "chip", "pill",
 * or "label" (excluding label elements), as well as data attributes and role="status".
 * Filters for small inline elements (width ≤ 200px, height ≤ 50px) and groups
 * similar badges together based on their visual styling.
 *
 * @returns Array of up to 5 most common badge variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const badges = extractBadges();
 * // Returns: [
 * //   {
 * //     html: '<span class="badge badge-success">Active</span>',
 * //     classes: 'badge badge-success',
 * //     styles: { background: 'rgb(0, 255, 0)', color: 'rgb(0, 0, 0)', ... },
 * //     variant: 'success',
 * //     count: 8
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractBadges(): BadgeComponent[] {
  const badges: BadgeComponent[] = [];
  const seen = new Map<string, BadgeComponent>();

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
      const componentStyles: Record<string, string> = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        display: styles.display
      };

      const variant: BadgeComponent = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: inferBadgeVariant(el) as 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'default',
        count: 1
      };

      badges.push(variant);
      seen.set(signature, variant);
    }
  });

  return badges.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Infers the badge variant type from element classes or content.
 *
 * @param badge - The badge HTML element to analyze
 * @returns The inferred variant type (success, error, warning, info, primary, secondary, or default)
 */
function inferBadgeVariant(badge: HTMLElement): string {
  const className = getClassName(badge).toLowerCase();
  const styles = getComputedStyle(badge);

  // Check class names first
  if (className.includes('success') || className.includes('green')) return 'success';
  if (className.includes('error') || className.includes('danger') || className.includes('red')) return 'error';
  if (className.includes('warning') || className.includes('yellow')) return 'warning';
  if (className.includes('info') || className.includes('blue')) return 'info';
  if (className.includes('primary')) return 'primary';
  if (className.includes('secondary') || className.includes('gray')) return 'secondary';

  // Analyze background color to infer semantic variant
  const bgColor = styles.backgroundColor.toLowerCase();

  // Helper to check if color contains RGB values in certain ranges
  const hasGreen = (c: string) => {
    const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [_, r, g, b] = match.map(Number);
      return g > r && g > b && g > 150; // Green dominant
    }
    return c.includes('green');
  };

  const hasRed = (c: string) => {
    const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [_, r, g, b] = match.map(Number);
      return r > g && r > b && r > 150; // Red dominant
    }
    return c.includes('red');
  };

  const hasYellow = (c: string) => {
    const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [_, r, g, b] = match.map(Number);
      return r > 200 && g > 150 && b < 100; // Yellow/orange
    }
    return c.includes('yellow') || c.includes('orange');
  };

  const hasBlue = (c: string) => {
    const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [_, r, g, b] = match.map(Number);
      return b > r && b > g && b > 150; // Blue dominant
    }
    return c.includes('blue');
  };

  const hasPurple = (c: string) => {
    const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [_, r, g, b] = match.map(Number);
      return r > 100 && b > 100 && Math.abs(r - b) < 50 && g < r - 30; // Purple
    }
    return c.includes('purple') || c.includes('violet');
  };

  // Check background color for semantic meaning
  if (hasGreen(bgColor)) return 'success';
  if (hasRed(bgColor)) return 'error';
  if (hasYellow(bgColor)) return 'warning';
  if (hasBlue(bgColor)) return 'info';
  if (hasPurple(bgColor)) return 'primary';

  // Check if it's a subtle badge (gray background)
  const isGray = bgColor.includes('rgb(') && !hasGreen(bgColor) && !hasRed(bgColor) && !hasYellow(bgColor) && !hasBlue(bgColor) && !hasPurple(bgColor);
  if (isGray) return 'secondary';

  return 'default';
}

/**
 * Extracts skeleton and loading state components from the page.
 *
 * Searches for elements with classes containing "skeleton", "shimmer", "placeholder",
 * or "loading" combined with "state". Groups similar skeleton components together
 * based on their visual styling. Differentiates between animated and static variants
 * based on CSS animations or gradient backgrounds.
 *
 * @returns Array of up to 5 most common skeleton variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const skeletons = extractSkeletonStates();
 * // Returns: [
 * //   {
 * //     html: '<div class="skeleton skeleton-text"></div>',
 * //     classes: 'skeleton skeleton-text',
 * //     styles: { background: 'rgb(240, 240, 240)', height: '20px', ... },
 * //     variant: 'animated',
 * //     count: 12
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractSkeletonStates(): SkeletonComponent[] {
  const skeletons: SkeletonComponent[] = [];
  const seen = new Map<string, SkeletonComponent>();

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
      const componentStyles: Record<string, string> = {
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

      const variant: SkeletonComponent = {
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
 * Extracts empty state components from the page.
 *
 * Searches for elements with classes containing "empty", "no-data", "no-results",
 * or "blank-slate". Filters for elements that contain actual content (text or images).
 * Groups similar empty states together based on their visual styling.
 *
 * @returns Array of up to 3 most common empty state variants, sorted by frequency
 *
 * @example
 * ```typescript
 * const emptyStates = extractEmptyStates();
 * // Returns: [
 * //   {
 * //     html: '<div class="empty-state">No results found</div>',
 * //     classes: 'empty-state',
 * //     styles: { textAlign: 'center', padding: '48px', ... },
 * //     variant: 'empty-state',
 * //     count: 2
 * //   },
 * //   ...
 * // ]
 * ```
 */
export function extractEmptyStates(): ComponentVariant[] {
  const emptyStates: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

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
      const componentStyles: Record<string, string> = {
        textAlign: styles.textAlign,
        padding: styles.padding,
        color: styles.color,
        fontSize: styles.fontSize
      };

      const variant: ComponentVariant = {
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

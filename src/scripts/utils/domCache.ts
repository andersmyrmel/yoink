/**
 * DOM element and computed style caching utilities
 *
 * Provides caching mechanisms to avoid expensive DOM operations like
 * querySelectorAll('*') and getComputedStyle() being called multiple times.
 */

/**
 * WeakMap cache for computed styles
 * Using WeakMap allows garbage collection when elements are removed from DOM
 */
const computedStyleCache = new WeakMap<Element, CSSStyleDeclaration>();

/**
 * Cached element array to avoid multiple full DOM scans
 */
let cachedElements: Element[] | null = null;

/**
 * Gets cached computed style for an element, or computes and caches it
 *
 * This function significantly improves performance when the same element's
 * styles are accessed multiple times across different extraction modules.
 *
 * @param element - DOM element to get computed styles for
 * @returns Computed style declaration for the element
 *
 * @example
 * ```typescript
 * const div = document.querySelector('div');
 * const styles = getCachedComputedStyle(div);
 * console.log(styles.color); // Cached on subsequent calls
 * ```
 */
export function getCachedComputedStyle(element: Element): CSSStyleDeclaration {
  let styles = computedStyleCache.get(element);

  if (!styles) {
    styles = window.getComputedStyle(element);
    computedStyleCache.set(element, styles);
  }

  return styles;
}

/**
 * Scans all DOM elements once and caches the result
 *
 * Instead of calling document.querySelectorAll('*') multiple times across
 * different extraction modules, this function scans once and caches the result.
 * This provides a massive performance improvement on large pages.
 *
 * @returns Array of all DOM elements
 *
 * @example
 * ```typescript
 * const elements = getCachedElements();
 * console.log(`Found ${elements.length} elements`);
 * ```
 */
export function getCachedElements(): Element[] {
  if (!cachedElements) {
    cachedElements = Array.from(document.querySelectorAll('*'));
  }

  return cachedElements;
}

/**
 * Clears all caches
 *
 * Should be called when a new extraction is started to ensure fresh data.
 * Typically called at the beginning of the main extraction function.
 *
 * @example
 * ```typescript
 * // At the start of extraction
 * clearCaches();
 *
 * // Now all caches are fresh
 * const elements = getCachedElements();
 * ```
 */
export function clearCaches(): void {
  // Clear WeakMap by creating a new one
  // (Note: We can't actually clear a WeakMap, but we can replace it)
  // Actually, we don't need to clear WeakMap as it's scoped to this module
  // and will be fresh on each page load. The computedStyleCache will naturally
  // garbage collect when elements are removed.

  // Clear element cache
  cachedElements = null;
}

/**
 * Gets cache statistics for debugging
 *
 * @returns Object with cache information
 */
export function getCacheStats(): { elementsCached: number } {
  return {
    elementsCached: cachedElements?.length ?? 0,
  };
}

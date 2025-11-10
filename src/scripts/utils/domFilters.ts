/**
 * DOM filtering utilities for extracting and analyzing DOM tree structures
 */

import { DOMNode } from '../types/extraction';

/**
 * Checks if an element is visible in the DOM based on computed styles.
 * Considers display, visibility, and opacity properties to determine visibility.
 *
 * @param el - DOM element to check for visibility
 * @returns True if element is visible (not hidden by CSS), false otherwise
 * @example
 * const div = document.querySelector('.my-div');
 * isVisible(div); // Returns false if display:none, visibility:hidden, or opacity:0
 */
export function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

/**
 * Checks if an element is within or near the current viewport.
 * Includes a 100px buffer zone around the viewport to catch elements just outside the visible area.
 * Useful for excluding far off-screen elements while including elements close to visibility.
 *
 * @param el - DOM element to check for viewport position
 * @returns True if element is in viewport or within 100px buffer zone, false otherwise
 * @example
 * const header = document.querySelector('header');
 * isInViewport(header); // Returns true if header is visible or within 100px of viewport
 */
export function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight + 100 && // +100px buffer
    rect.bottom > -100 &&
    rect.left < window.innerWidth + 100 &&
    rect.right > -100
  );
}

/**
 * Determines if an element should be completely excluded from DOM extraction.
 * Filters out non-visual elements like scripts, styles, metadata, and links that don't
 * contribute to the visual layout or user interface.
 *
 * @param el - DOM element to evaluate for exclusion
 * @returns True if element should be skipped (script, style, link, meta, noscript), false otherwise
 * @example
 * const script = document.querySelector('script');
 * shouldSkipElement(script); // Returns true
 *
 * const div = document.querySelector('div');
 * shouldSkipElement(div); // Returns false
 */
export function shouldSkipElement(el: Element): boolean {
  const tagName = el.tagName.toLowerCase();
  // Skip script, style, and other non-visual elements
  return ['script', 'style', 'link', 'meta', 'noscript'].includes(tagName);
}

/**
 * Determines if a DOM tree node should be pruned (removed) from the final extraction.
 * Preserves semantically meaningful nodes, interactive elements, text content, and styled elements.
 * Only prunes empty, unstyled container divs/spans that add no value to the structure.
 *
 * @param node - Extracted DOM node object to evaluate for pruning
 * @returns True if node should be pruned (removed), false if it should be kept
 * @example
 * const emptyDiv = { tag: 'div', styles: {}, children: [] };
 * shouldPruneNode(emptyDiv); // Returns true (empty, unstyled div)
 *
 * const textNode = { tag: 'p', text: 'Hello world' };
 * shouldPruneNode(textNode); // Returns false (has text content)
 *
 * const semantic = { tag: 'nav', children: [...] };
 * shouldPruneNode(semantic); // Returns false (semantic tag)
 */
export function shouldPruneNode(node: Partial<DOMNode>): boolean {
  // Never prune semantic tags, interactive elements, or elements with text
  if (node.text || node.href || node.src || node.placeholder || node.tableHeaders) return false;
  if (['nav', 'main', 'header', 'footer', 'section', 'article', 'aside'].includes(node.tag)) return false;
  if (['button', 'a', 'input', 'textarea', 'select', 'label'].includes(node.tag)) return false;

  // Keep if has meaningful styles (more than just display)
  if (node.styles && Object.keys(node.styles).length > 2) return false;

  // Keep if has layout role
  if (node.layout || node.dimensions) return false;

  // Prune empty divs/spans with minimal styles
  if ((node.tag === 'div' || node.tag === 'span') &&
      (!node.styles || Object.keys(node.styles).length <= 1) &&
      (!node.children || node.children.length === 0)) {
    return true;
  }

  return false;
}

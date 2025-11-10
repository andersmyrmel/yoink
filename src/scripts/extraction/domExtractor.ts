import { isVisible, isInViewport, shouldSkipElement, shouldPruneNode } from '../utils/domFilters';
import type { DOMNode, DOMNodeStyles, DOMTreeExtraction } from '../types/extraction';

/**
 * Recursively extracts a DOM node and its children into a structured format.
 *
 * This function traverses the DOM tree starting from the given element and extracts
 * semantic information including tag names, classes, roles, computed styles, text content,
 * and special attributes (href for links, src for images, etc.). It applies performance
 * optimizations by limiting depth and children, and filtering out non-visible elements.
 *
 * @param el - The DOM element to extract and analyze
 * @param depth - Current depth in the tree (starts at 0 for root)
 * @param maxDepth - Maximum depth to traverse (deeper nodes are pruned)
 * @param maxChildren - Maximum number of direct children to process per node
 * @returns Structured DOMNode representation with semantic information, or null if the element should be skipped (invisible, script tags, etc.)
 *
 * @example
 * ```typescript
 * const node = extractNode(document.body, 0, 12, 15);
 * if (node) {
 *   console.log(`Extracted ${node.tag} with ${node.children?.length ?? 0} children`);
 * }
 * ```
 */
export function extractNode(el: Element, depth: number, maxDepth: number, maxChildren: number): DOMNode | null {
  if (depth > maxDepth || shouldSkipElement(el) || !isVisible(el)) {
    return null;
  }

  // After depth 8, only process viewport elements for performance
  if (depth > 8 && !isInViewport(el)) {
    return null;
  }

  const tagName = el.tagName.toLowerCase();
  const classList = Array.from(el.classList).slice(0, 5); // Limit class list
  const role = el.getAttribute('role') || el.getAttribute('aria-label') || undefined;
  const computed = window.getComputedStyle(el);

  const node: Partial<DOMNode> = {
    tag: tagName,
    ...(classList.length > 0 && { classes: classList }),
    ...(role && { role })
  };

  // Add semantic attributes for better AI understanding
  // Links - capture href
  if (tagName === 'a') {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      node.href = href.length > 100 ? href.substring(0, 100) + '...' : href;
    }
  }

  // Images - capture src and alt
  if (tagName === 'img') {
    const src = el.getAttribute('src');
    if (src) {
      node.src = src.length > 100 ? src.substring(0, 100) + '...' : src;
    }
    const alt = el.getAttribute('alt');
    if (alt) node.alt = alt;
  }

  // Inputs - capture type and placeholder
  if (tagName === 'input') {
    const inputType = el.getAttribute('type') || 'text';
    node.inputType = inputType;
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) node.placeholder = placeholder.substring(0, 50);
  }

  // Textareas - capture placeholder
  if (tagName === 'textarea') {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) node.placeholder = placeholder.substring(0, 50);
  }

  // Buttons - capture type
  if (tagName === 'button') {
    const buttonType = el.getAttribute('type') || 'button';
    node.buttonType = buttonType;
  }

  // Tables - capture structure
  if (tagName === 'table') {
    const headers: string[] = [];
    const headerCells = el.querySelectorAll('thead th, thead td');
    headerCells.forEach(cell => {
      const text = cell.textContent?.trim();
      if (text && text.length < 30) headers.push(text);
    });
    if (headers.length > 0 && headers.length <= 10) {
      node.tableHeaders = headers;
    }

    const rowCount = el.querySelectorAll('tbody tr').length;
    if (rowCount > 0 && rowCount <= 1000) {
      node.tableRows = rowCount;
    }
  }

  // Add layout info for major layout elements
  if (['nav', 'aside', 'main', 'header', 'footer', 'section'].includes(tagName)) {
    const rect = el.getBoundingClientRect();
    node.dimensions = {
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  // Add display type for flex/grid containers
  if (computed.display === 'flex' || computed.display === 'inline-flex') {
    node.layout = 'flexbox';
  } else if (computed.display === 'grid' || computed.display === 'inline-grid') {
    node.layout = 'grid';
  }

  // Extract key computed styles to decode obfuscated class names
  const styles: Partial<DOMNodeStyles> = {};

  // Display (always include)
  styles.display = computed.display;

  // Flexbox properties
  if (computed.display.includes('flex')) {
    if (computed.flexDirection !== 'row') styles.flexDirection = computed.flexDirection;
    if (computed.justifyContent !== 'normal' && computed.justifyContent !== 'flex-start') {
      styles.justifyContent = computed.justifyContent;
    }
    if (computed.alignItems !== 'normal' && computed.alignItems !== 'stretch') {
      styles.alignItems = computed.alignItems;
    }
    if (computed.gap !== '0px' && computed.gap !== 'normal') styles.gap = computed.gap;
  }

  // Grid properties
  if (computed.display.includes('grid')) {
    if (computed.gridTemplateColumns !== 'none') styles.gridTemplateColumns = computed.gridTemplateColumns;
    if (computed.gap !== '0px' && computed.gap !== 'normal') styles.gap = computed.gap;
  }

  // Spacing
  if (computed.padding !== '0px') styles.padding = computed.padding;
  if (computed.margin !== '0px') styles.margin = computed.margin;

  // Visual styles
  const bgColor = computed.backgroundColor;
  if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    styles.background = bgColor;
  }

  if (computed.borderRadius !== '0px') styles.borderRadius = computed.borderRadius;

  const boxShadow = computed.boxShadow;
  if (boxShadow !== 'none') {
    // Truncate long box-shadow values
    styles.boxShadow = boxShadow.length > 80 ? boxShadow.substring(0, 80) + '...' : boxShadow;
  }

  // Typography (for text-heavy elements)
  if (['button', 'a', 'span', 'p', 'label', 'input', 'textarea'].includes(tagName)) {
    if (computed.color !== 'rgb(0, 0, 0)') styles.color = computed.color;
    if (computed.fontSize !== '16px') styles.fontSize = computed.fontSize;
    if (computed.fontWeight !== '400') styles.fontWeight = computed.fontWeight;
  }

  // Only add styles object if we have meaningful styles
  if (Object.keys(styles).length > 1) { // More than just 'display'
    node.styles = styles as DOMNodeStyles;
  }

  // Extract text content - improved to avoid icon duplication
  const interactiveElements = ['button', 'a', 'label'];
  const isInteractive = interactiveElements.includes(tagName);

  if (isInteractive) {
    // For interactive elements, extract text excluding icons/SVGs
    let textContent = '';
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim() || '';
        // Skip single-character text nodes (usually icon letters)
        if (text.length > 2) {
          textContent += text;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as Element;
        const childTag = childEl.tagName.toLowerCase();
        // Skip SVG and elements with icon-related classes
        if (childTag !== 'svg' &&
            !childEl.className.toString().match(/icon|svg|emoji|glyph/i)) {
          const childText = childEl.textContent?.trim();
          // Skip very short text (1-2 chars) as it's usually icon letters/symbols
          if (childText && childText.length > 2) {
            textContent += ' ' + childText;
          }
        }
      }
    }
    textContent = textContent.trim();
    if (textContent.length > 0 && textContent.length < 100) {
      node.text = textContent.substring(0, 80);
    }
  } else if (tagName === 'input' || tagName === 'textarea') {
    // For inputs, use value or placeholder as text
    const value = el.getAttribute('value');
    if (value && value.length > 0) {
      node.text = value.substring(0, 50);
    }
  } else {
    // For other elements, only include direct text (not from children)
    const textContent = el.textContent?.trim();
    if (textContent && textContent.length > 0 && textContent.length < 100) {
      let directText = '';
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          directText += child.textContent?.trim() || '';
        }
      }
      if (directText.length > 0 && directText.length < 50) {
        node.text = directText.substring(0, 50);
      }
    }
  }

  // Recursively extract children
  const children: DOMNode[] = [];
  const childElements = Array.from(el.children).slice(0, maxChildren);

  for (const child of childElements) {
    const childNode = extractNode(child, depth + 1, maxDepth, maxChildren);
    if (childNode && !shouldPruneNode(childNode)) {
      children.push(childNode);
    }
  }

  if (children.length > 0) {
    node.children = children;
  }

  // Final check: Don't return prunable nodes unless they have children
  if (shouldPruneNode(node) && children.length === 0) {
    return null;
  }

  return node as DOMNode;
}

/**
 * Extracts the complete DOM tree from the current page.
 *
 * This function is the main entry point for DOM extraction. It traverses the entire
 * document starting from the body element and builds a structured representation
 * of the page's DOM tree. The extraction includes semantic information, computed
 * styles, layout patterns, and component structures optimized for AI analysis.
 *
 * The function applies performance optimizations including:
 * - Depth limiting (max 12 levels deep)
 * - Children limiting (max 15 children per node)
 * - Viewport-based filtering for deep nodes (depth > 8)
 * - Automatic pruning of invisible and non-semantic elements
 *
 * @returns Complete DOM tree extraction with page metadata including:
 *   - url: Current page URL
 *   - viewport: Window dimensions (width and height)
 *   - tree: Root DOMNode representing the body element and all descendants
 *
 * @example
 * ```typescript
 * // Extract the entire page structure
 * const extraction = extractDOMTree();
 * console.log(`Page: ${extraction.url}`);
 * console.log(`Viewport: ${extraction.viewport.width}x${extraction.viewport.height}`);
 * console.log(`Root element: ${extraction.tree?.tag}`);
 * ```
 */
export function extractDOMTree(): DOMTreeExtraction {
  const maxDepth = 12; // Increased depth for better content coverage
  const maxChildren = 15; // Increased children limit per node

  // Start from body or main content area
  const body = document.body;
  const tree = extractNode(body, 0, maxDepth, maxChildren);

  return {
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    tree
  };
}

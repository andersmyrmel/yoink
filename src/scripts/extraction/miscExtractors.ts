/**
 * Miscellaneous extractors for design system elements
 *
 * Exports functions to extract:
 * - Icons (SVG and font icons)
 * - Gradients (linear, radial, conic)
 * - Responsive breakpoints (media queries)
 * - Scrollbar styles (webkit and standard)
 */

import type {
  IconExtraction,
  SVGIconPattern,
  IconFontUsage,
  Gradient,
  ResponsiveBreakpoints,
  ScrollbarStyle
} from '../types/extraction';
import { getCachedElements } from '../utils/domCache';

/**
 * Extracts icon usage patterns from the current page
 *
 * This function analyzes both SVG icons and icon fonts (Font Awesome, Material Icons, etc.)
 * to identify common sizes, patterns, and usage statistics. It helps understand the icon
 * system being used on the page.
 *
 * Features:
 * - Detects SVG icons with multiple dimension extraction methods (attributes, viewBox, bounding box)
 * - Identifies icon font usage by class patterns (icon-, fa-, material-icons)
 * - Groups SVG patterns by size and viewBox signature
 * - Tracks common icon sizes and their frequencies
 * - Limits results to top 10 SVG patterns and top 5 icon font sizes
 *
 * @returns Icon extraction data including SVG patterns, icon fonts, common sizes, and totals
 *
 * @example
 * const icons = extractIcons();
 * console.log(icons.svgPatterns); // [{ size: "24x24", viewBox: "0 0 24 24", className: "icon", count: 15 }]
 * console.log(icons.commonSizes); // [{ size: "24x24", count: 45 }, { size: "16x16", count: 20 }]
 * console.log(icons.totalSvgs); // 120
 */
export function extractIcons(): IconExtraction {
  const icons: {
    svgIcons: SVGIconPattern[];
    iconFonts: IconFontUsage[];
    sizes: Map<string, number>;
  } = {
    svgIcons: [],
    iconFonts: [],
    sizes: new Map<string, number>()
  };

  // Extract SVG icons - catch ALL svgs, not just ones with specific attributes
  const svgs = document.querySelectorAll('svg');
  const svgPatterns = new Map<string, SVGIconPattern>();

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
      const pattern = svgPatterns.get(signature)!;
      pattern.count++;
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
 * Extracts gradient patterns used in background images across the page
 *
 * This function analyzes the computed styles of elements to identify and catalog
 * gradient usage (linear, radial, and conic gradients). It helps understand the
 * gradient design patterns and their frequency of use.
 *
 * Features:
 * - Scans up to 1000 elements for performance optimization
 * - Detects all three gradient types: linear, radial, and conic
 * - Deduplicates gradient strings and tracks usage counts
 * - Normalizes gradient syntax for consistent comparison
 * - Returns top 10 most common gradients sorted by usage
 *
 * Performance Considerations:
 * - Limits scanning to first 1000 elements to prevent performance issues on large pages
 * - Uses Set for efficient duplicate detection
 *
 * @returns Array of gradient definitions sorted by usage count (most common first), limited to top 10
 *
 * @example
 * const gradients = extractGradients();
 * console.log(gradients);
 * // [
 * //   { type: "linear", value: "linear-gradient(90deg, #fff 0%, #000 100%)", count: 5 },
 * //   { type: "radial", value: "radial-gradient(circle, #ff0 0%, #f00 100%)", count: 2 }
 * // ]
 */
export function extractGradients(): Gradient[] {
  const gradients: Gradient[] = [];
  const seen = new Set<string>();

  const allElements = getCachedElements();
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
        let type: 'linear' | 'radial' | 'conic' = 'linear';
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
 * Extracts responsive design breakpoints from CSS media queries
 *
 * This function analyzes all accessible stylesheets to identify media query breakpoints
 * and categorize them by their pixel values. It recognizes common CSS framework breakpoint
 * standards (Tailwind CSS, Bootstrap) and provides insights into the responsive design system.
 *
 * Features:
 * - Scans all accessible stylesheets for CSSMediaRule instances
 * - Extracts both min-width and max-width breakpoint values
 * - Tracks how many media queries use each breakpoint
 * - Identifies standard framework breakpoints (Tailwind, Bootstrap)
 * - Automatically labels recognized breakpoints with framework names
 * - Handles cross-origin stylesheets gracefully (skips with try-catch)
 *
 * Recognized Framework Breakpoints:
 * - Tailwind: 640px (sm), 768px (md), 1024px (lg), 1280px (xl), 1536px (2xl)
 * - Bootstrap: 576px (sm), 768px (md), 992px (lg), 1200px (xl), 1400px (xxl)
 *
 * @returns Responsive breakpoints analysis including named breakpoints, total media queries, and unique breakpoint count
 *
 * @example
 * const responsive = extractResponsiveBreakpoints();
 * console.log(responsive.breakpoints);
 * // [
 * //   { width: 768, value: "768px", type: "min-width", queryCount: 5, name: "md (Tailwind/Bootstrap)" },
 * //   { width: 1024, value: "1024px", type: "min-width", queryCount: 3, name: "lg (Tailwind)" }
 * // ]
 * console.log(responsive.totalMediaQueries); // 15
 * console.log(responsive.uniqueBreakpoints); // 4
 */
export function extractResponsiveBreakpoints(): ResponsiveBreakpoints {
  const breakpoints = new Map<number, {
    value: string;
    type: 'min-width' | 'max-width';
    queries: string[];
  }>();
  const mediaQueries: string[] = [];

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
      } catch (_e) {
        // Cross-origin stylesheet, skip
      }
    });
  } catch (_e) {
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
 * Extracts custom scrollbar styling rules from CSS stylesheets
 *
 * This function analyzes stylesheet rules to identify custom scrollbar styles,
 * supporting both webkit-specific pseudo-elements and standard CSS scrollbar properties
 * (Firefox). It helps understand the scrollbar design system and customization approach.
 *
 * Features:
 * - Detects webkit scrollbar pseudo-elements (::-webkit-scrollbar, ::-webkit-scrollbar-thumb, etc.)
 * - Captures standard scrollbar properties (scrollbar-width, scrollbar-color for Firefox)
 * - Extracts comprehensive styling properties: width, height, background, border-radius
 * - Handles cross-origin stylesheets gracefully (skips with try-catch)
 * - Returns top 5 most relevant scrollbar style rules
 *
 * Supported Properties:
 * - Webkit: width, height, backgroundColor, borderRadius
 * - Firefox: scrollbarWidth, scrollbarColor
 *
 * Common Webkit Pseudo-elements:
 * - ::-webkit-scrollbar (main scrollbar container)
 * - ::-webkit-scrollbar-thumb (draggable scrolling handle)
 * - ::-webkit-scrollbar-track (track/background of scrollbar)
 *
 * @returns Array of scrollbar style definitions, limited to top 5
 *
 * @example
 * const scrollbars = extractScrollbarStyles();
 * console.log(scrollbars);
 * // [
 * //   {
 * //     selector: "::-webkit-scrollbar",
 * //     styles: { width: "8px", backgroundColor: "#f0f0f0" }
 * //   },
 * //   {
 * //     selector: "::-webkit-scrollbar-thumb",
 * //     styles: { backgroundColor: "#888", borderRadius: "4px" }
 * //   }
 * // ]
 */
export function extractScrollbarStyles(): ScrollbarStyle[] {
  const scrollbars: ScrollbarStyle[] = [];

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
              const scrollbarData: ScrollbarStyle = {
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
      } catch (_e) {
        // Cross-origin stylesheet, skip
      }
    });
  } catch (_e) {
    // Error accessing stylesheets
  }

  return scrollbars.slice(0, 5);
}

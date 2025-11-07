/**
 * Miscellaneous extractors for design system elements
 *
 * Exports functions to extract:
 * - Icons (SVG and font icons)
 * - Gradients (linear, radial, conic)
 * - Responsive breakpoints (media queries)
 * - Scrollbar styles (webkit and standard)
 */

/**
 * Extracts SVG icons and icon fonts from the page
 * Detects icon sizes, patterns, and counts
 */
export function extractIcons(): any {
  const icons: any = {
    svgIcons: [],
    iconFonts: [],
    sizes: new Map<string, number>()
  };

  // Extract SVG icons - catch ALL svgs, not just ones with specific attributes
  const svgs = document.querySelectorAll('svg');
  const svgPatterns = new Map<string, any>();

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
      svgPatterns.get(signature).count++;
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
 * Extracts gradient definitions from page elements
 * Detects linear, radial, and conic gradients
 */
export function extractGradients(): any[] {
  const gradients: any[] = [];
  const seen = new Set<string>();

  const allElements = document.querySelectorAll('*');
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
        let type = 'linear';
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
 * Extracts responsive breakpoints from media queries
 * Identifies common framework standards (Tailwind, Bootstrap)
 */
export function extractResponsiveBreakpoints(): any {
  const breakpoints = new Map<number, any>();
  const mediaQueries: any[] = [];

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
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    });
  } catch (e) {
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
 * Extracts custom scrollbar styles from stylesheets
 * Handles webkit scrollbar pseudo-elements and standard CSS properties
 */
export function extractScrollbarStyles(): any[] {
  const scrollbars: any[] = [];

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
              const scrollbarData: any = {
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
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    });
  } catch (e) {
    // Error accessing stylesheets
  }

  return scrollbars.slice(0, 5);
}

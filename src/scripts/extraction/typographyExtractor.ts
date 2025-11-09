import type { TypographyAnalysis, TypographyStyle } from '../types/extraction';
import {
  detectIfHeading,
  classifyBodyText,
  trackLineHeight,
  analyzeTypeScale,
  analyzeLineHeightPatterns,
  inferHeadingLevelFromSize
} from '../utils/textProcessor';
import { getCachedComputedStyle } from '../utils/domCache';

/**
 * Extracts font family values from elements on the page.
 *
 * Scans up to 100 elements and collects their computed font-family values,
 * filtering out inherited values. Returns the top 10 most unique fonts found.
 *
 * @returns {string[]} Array of font family strings (max 10) found on the page.
 * Font families are returned as computed by the browser, including fallbacks.
 *
 * @example
 * ```typescript
 * const fonts = extractFonts();
 * // Returns: [
 * //   '"Inter", sans-serif',
 * //   '"Roboto Mono", monospace',
 * //   'system-ui, -apple-system, sans-serif'
 * // ]
 * ```
 */
export function extractFonts(): string[] {
  const fonts = new Set<string>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 100);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getCachedComputedStyle(element);
    const fontFamily = styles.fontFamily;

    if (fontFamily && fontFamily !== 'inherit') {
      fonts.add(fontFamily);
    }
  }

  return Array.from(fonts).slice(0, 10);
}

/**
 * Extracts comprehensive typography context from the current page.
 *
 * Performs deep analysis of the page's typography system by scanning semantic headings (h1-h6),
 * body text elements, and inferring heading-like styles from visual characteristics. Also analyzes
 * the type scale (font size progression) and line-height patterns to detect design system patterns.
 *
 * The function:
 * - Extracts semantic headings (h1-h6) with their computed styles and usage examples
 * - Infers additional headings from large, bold text that looks like headings
 * - Classifies body text into categories (body, small, caption, button, label, etc.)
 * - Analyzes the type scale to detect if a consistent ratio is being used
 * - Identifies common line-height patterns and their usage contexts
 *
 * @returns {TypographyAnalysis} Complete typography analysis including:
 *   - `headings`: Record of heading styles keyed by tag or inferred level (e.g., "h1", "h2 (inferred)")
 *   - `body`: Array of body text styles sorted by frequency (top 8 most common)
 *   - `typeScale`: Type scale analysis with base size, ratio, and confidence level
 *   - `lineHeightPatterns`: Common line-height values with their ratios and usage contexts
 *
 * @example
 * ```typescript
 * const typography = extractTypographyContext();
 * // Returns: {
 * //   headings: {
 * //     h1: {
 * //       fontSize: "48px",
 * //       fontWeight: "700",
 * //       lineHeight: "1.2",
 * //       color: "rgb(0, 0, 0)",
 * //       usage: "H1 headings",
 * //       examples: ["Welcome to our site", "Latest Products"],
 * //       tag: "h1",
 * //       count: 3
 * //     },
 * //     "h2 (inferred)": {
 * //       fontSize: "32px",
 * //       fontWeight: "600",
 * //       // ... additional heading-like text detected by visual analysis
 * //     }
 * //   },
 * //   body: [
 * //     {
 * //       fontSize: "16px",
 * //       fontWeight: "400",
 * //       lineHeight: "1.5",
 * //       usage: "Body text",
 * //       count: 45
 * //     }
 * //   ],
 * //   typeScale: {
 * //     baseSize: 16,
 * //     ratio: 1.25,
 * //     ratioName: "Major Third",
 * //     scale: [12, 16, 20, 24, 32, 40],
 * //     confidence: "high"
 * //   },
 * //   lineHeightPatterns: [
 * //     {
 * //       value: "1.5",
 * //       ratio: 1.5,
 * //       count: 32,
 * //       usage: "Body text line height"
 * //     }
 * //   ]
 * // }
 * ```
 */
export function extractTypographyContext(): TypographyAnalysis {
  const headings: Record<string, TypographyStyle> = {};
  const bodyMap = new Map<string, TypographyStyle>();
  const inferredHeadingsMap = new Map<string, TypographyStyle>();
  const allFontSizes: number[] = [];
  const lineHeightMap = new Map<string, { count: number; fontSize: number[] }>();

  // Extract semantic heading styles (h1-h6 tags)
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
    const elements = document.querySelectorAll(tag);
    if (elements.length === 0) return;

    const firstElement = elements[0] as HTMLElement;
    const styles = getCachedComputedStyle(firstElement);
    const actualFontSize = parseFloat(styles.fontSize);

    allFontSizes.push(actualFontSize);
    trackLineHeight(styles.lineHeight, actualFontSize, lineHeightMap);

    headings[tag] = {
      fontSize: `${actualFontSize}px`,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      color: styles.color,
      usage: `${tag.toUpperCase()} headings`,
      examples: Array.from(elements).slice(0, 2).map(el =>
        el.textContent?.substring(0, 50) || ''
      ),
      tag,
      count: elements.length
    };
  });

  // Extract text styles from actual content-bearing elements
  // Scan more elements for comprehensive analysis
  const bodySelectors = 'p, span:not([class*="icon"]), div, a, button, label, li, td, th, figcaption, small, strong, em';
  const bodyElements = document.querySelectorAll(bodySelectors);
  const maxBodyElements = Math.min(bodyElements.length, 500); // Increased for better coverage

  for (let i = 0; i < maxBodyElements; i++) {
    const element = bodyElements[i] as HTMLElement;
    const text = element.textContent?.trim() || '';

    // Skip if no meaningful text
    if (text.length < 2 || text.length > 300) continue;

    // Filter out container elements
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim() || '')
      .join(' ')
      .trim();

    // Skip if it's mainly a container
    if (element.children.length > 2 && directText.length < 10) continue;

    // Skip if it contains structural elements
    const hasStructuralChildren = element.querySelector('div, section, article, aside, main') !== null;
    if (hasStructuralChildren && element.children.length > 0) continue;

    const styles = getCachedComputedStyle(element);
    const actualFontSize = parseFloat(styles.fontSize);
    const weight = parseInt(styles.fontWeight);

    // Track all font sizes for scale detection
    allFontSizes.push(actualFontSize);
    trackLineHeight(styles.lineHeight, actualFontSize, lineHeightMap);

    // Use actual font size in signature
    const signature = `${actualFontSize}px-${weight}-${styles.lineHeight}`;

    // Enhanced heading detection with better heuristics
    const isHeading = detectIfHeading(element, actualFontSize, weight, text);

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
          tag: headingLevel,
          count: 1
        });
      } else {
        inferredHeadingsMap.get(headingKey)!.count++;
      }
    } else {
      // This is body text - classify with enhanced categories
      if (!bodyMap.has(signature)) {
        const usage = classifyBodyText(element, actualFontSize, weight);
        const cleanText = text.replace(/\s+/g, ' ').substring(0, 60);

        bodyMap.set(signature, {
          fontSize: `${actualFontSize}px`,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          color: styles.color,
          usage,
          examples: [cleanText + (text.length > 60 ? '...' : '')],
          tag: element.tagName.toLowerCase(),
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
    .slice(0, 8); // Show top 8 for better coverage

  // Analyze type scale
  const typeScale = analyzeTypeScale(allFontSizes);

  // Analyze line-height patterns
  const lineHeightPatterns = analyzeLineHeightPatterns(lineHeightMap);

  return {
    headings,
    body: sortedBody,
    typeScale,
    lineHeightPatterns
  };
}

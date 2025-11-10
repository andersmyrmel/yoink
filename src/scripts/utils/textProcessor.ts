/**
 * Text Processing Utilities
 *
 * Provides utility functions for analyzing and classifying text elements
 * including heading detection, body text classification, line height tracking,
 * and type scale analysis.
 */

import { TypeScaleAnalysis, LineHeightPattern } from '../types/extraction';

/**
 * Intelligently detects whether an element should be classified as a heading based on multiple heuristics.
 * Combines visual hierarchy (size, weight), text characteristics (length, capitalization),
 * and semantic markers (class names, tag names) to make accurate determinations.
 *
 * @param element - HTML element to analyze
 * @param fontSize - Font size in pixels
 * @param weight - Font weight (numeric value, e.g., 400, 600, 700)
 * @param text - Text content of the element
 * @returns True if element should be classified as a heading, false otherwise
 * @example
 * const el = document.querySelector('.title');
 * const isHeading = detectIfHeading(el, 24, 700, "Welcome to Our Site");
 * // Returns true (large, bold, short, capitalized)
 */
export function detectIfHeading(element: HTMLElement, fontSize: number, weight: number, text: string): boolean {
  const tagName = element.tagName.toLowerCase();

  // Don't classify buttons, links in nav, or form elements as headings
  if (tagName === 'button') return false;
  if (tagName === 'a' && element.closest('nav, header')) return false;
  if (tagName === 'label') return false;

  // Check visual hierarchy
  const isLargeAndBold = fontSize >= 18 && weight >= 600;
  const isVeryLarge = fontSize >= 24;
  const isExtraLarge = fontSize >= 32;

  // Check text characteristics
  const isShortText = text.length < 80; // Headings are typically short
  const isCapitalized = text.length > 0 && text[0] === text[0].toUpperCase();

  // Check semantic markers
  const hasHeadingClass = element.className.toLowerCase().match(/title|heading|headline|display/);

  // Combine heuristics
  if (isExtraLarge) return true; // Very large text is almost always a heading
  if (isVeryLarge && isShortText) return true;
  if (isLargeAndBold && isShortText && isCapitalized) return true;
  if (hasHeadingClass && fontSize >= 16) return true;

  return false;
}

/**
 * Classifies body text elements into specific categories based on context and styling.
 * Distinguishes between UI text (buttons, navigation), captions, labels, content text, and links.
 * Useful for understanding text hierarchy and purpose in design systems.
 *
 * @param element - HTML element containing text to classify
 * @param fontSize - Font size in pixels
 * @param weight - Font weight (numeric value)
 * @returns Classification string describing the text type (e.g., "UI: Button text", "Content: Paragraph", "Caption/Meta text")
 * @example
 * const el = document.querySelector('button');
 * classifyBodyText(el, 14, 500); // Returns "UI: Button text"
 *
 * const p = document.querySelector('p');
 * classifyBodyText(p, 16, 400); // Returns "Content: Paragraph"
 */
export function classifyBodyText(element: HTMLElement, fontSize: number, weight: number): string {
  const tagName = element.tagName.toLowerCase();
  const className = element.className.toLowerCase();

  // UI Text (buttons, menus, nav)
  if (tagName === 'button' || element.getAttribute('role') === 'button') {
    return 'UI: Button text';
  }
  if (tagName === 'a' && element.closest('nav, header')) {
    return 'UI: Navigation';
  }
  if (className.includes('menu') || className.includes('dropdown')) {
    return 'UI: Menu items';
  }

  // Caption/Meta text (small text, usually under 13px)
  if (fontSize < 13 || tagName === 'small' || className.includes('caption')) {
    return 'Caption/Meta text';
  }
  if (tagName === 'figcaption') {
    return 'Caption: Figure caption';
  }
  if (className.includes('meta') || className.includes('timestamp')) {
    return 'Caption: Metadata';
  }

  // Label text
  if (tagName === 'label' || className.includes('label')) {
    return 'Label: Form label';
  }
  if (tagName === 'th') {
    return 'Label: Table header';
  }

  // Content text (paragraphs, articles)
  if (tagName === 'p') {
    return 'Content: Paragraph';
  }
  if (tagName === 'td' || tagName === 'li') {
    return 'Content: Body text';
  }
  if (element.closest('article, main, section')) {
    return 'Content: Article text';
  }

  // Link text
  if (tagName === 'a') {
    return 'Link text';
  }

  // Emphasis
  if (tagName === 'strong' || weight >= 600) {
    return 'Content: Emphasized text';
  }

  return 'Body text';
}

/**
 * Tracks line-height values and their associated font sizes for pattern analysis.
 * Accumulates data in a map to identify common line-height patterns across a document.
 * Skips 'normal' and empty line-height values.
 *
 * @param lineHeight - Computed line-height value as string (e.g., "24px", "1.5")
 * @param fontSize - Font size in pixels associated with this line-height
 * @param lineHeightMap - Map to store accumulated line-height data (mutated by this function)
 * @example
 * const map = new Map();
 * trackLineHeight("24px", 16, map);
 * trackLineHeight("24px", 14, map);
 * // map now has: { "24px": { count: 2, fontSize: [16, 14] } }
 */
export function trackLineHeight(lineHeight: string, fontSize: number, lineHeightMap: Map<string, { count: number; fontSize: number[] }>): void {
  if (!lineHeight || lineHeight === 'normal') return;

  if (!lineHeightMap.has(lineHeight)) {
    lineHeightMap.set(lineHeight, { count: 0, fontSize: [] });
  }

  const entry = lineHeightMap.get(lineHeight)!;
  entry.count++;
  entry.fontSize.push(fontSize);
}

/**
 * Analyzes a collection of font sizes to detect the underlying typographic scale and ratio.
 * Identifies the base font size and calculates the scaling ratio between consecutive sizes.
 * Matches against common typographic scales (Major Second, Perfect Fourth, Golden Ratio, etc.).
 *
 * @param fontSizes - Array of font sizes in pixels collected from the document
 * @returns TypeScaleAnalysis object containing base size, detected ratio, ratio name, scale array, and confidence level
 * @example
 * const sizes = [12, 14, 16, 18, 21, 24, 28, 32];
 * const analysis = analyzeTypeScale(sizes);
 * // Returns: {
 * //   baseSize: 16,
 * //   ratio: 1.2,
 * //   ratioName: "Minor Third (1.2)",
 * //   scale: [12, 14, 16, 18, 21, 24, 28, 32],
 * //   confidence: "high"
 * // }
 */
export function analyzeTypeScale(fontSizes: number[]): TypeScaleAnalysis {
  if (fontSizes.length < 3) {
    return {
      baseSize: 16,
      ratio: 1,
      ratioName: 'Insufficient data',
      scale: [],
      confidence: 'low'
    };
  }

  // Get unique font sizes, sorted
  const uniqueSizes = Array.from(new Set(fontSizes)).sort((a, b) => a - b);

  // Detect base size (most common small-to-medium size)
  const baseCandidates = fontSizes.filter(s => s >= 12 && s <= 18);
  const baseSize = baseCandidates.length > 0
    ? Math.round(baseCandidates.reduce((a, b) => a + b) / baseCandidates.length)
    : 16;

  // Calculate ratios between consecutive sizes
  const ratios: number[] = [];
  for (let i = 1; i < uniqueSizes.length && i < 6; i++) {
    const ratio = uniqueSizes[i] / uniqueSizes[i - 1];
    if (ratio >= 1.1 && ratio <= 2.0) {
      ratios.push(ratio);
    }
  }

  // If we have ratios, calculate average
  const avgRatio = ratios.length > 0
    ? ratios.reduce((a, b) => a + b) / ratios.length
    : 1;

  // Identify common type scale ratios
  const commonRatios = [
    { value: 1.125, name: 'Major Second (1.125)' },
    { value: 1.2, name: 'Minor Third (1.2)' },
    { value: 1.25, name: 'Major Third (1.25)' },
    { value: 1.333, name: 'Perfect Fourth (1.333)' },
    { value: 1.414, name: 'Augmented Fourth (1.414)' },
    { value: 1.5, name: 'Perfect Fifth (1.5)' },
    { value: 1.618, name: 'Golden Ratio (1.618)' },
    { value: 2, name: 'Octave (2.0)' }
  ];

  // Find closest match
  let closestRatio = commonRatios[0];
  let minDiff = Math.abs(avgRatio - closestRatio.value);

  for (const ratio of commonRatios) {
    const diff = Math.abs(avgRatio - ratio.value);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = ratio;
    }
  }

  // Determine confidence
  let confidence = 'low';
  if (minDiff < 0.05 && ratios.length >= 3) confidence = 'high';
  else if (minDiff < 0.1 && ratios.length >= 2) confidence = 'medium';

  return {
    baseSize,
    ratio: closestRatio.value,
    ratioName: closestRatio.name,
    scale: uniqueSizes.slice(0, 8),
    confidence
  };
}

/**
 * Analyzes accumulated line-height data to identify common patterns and their usage.
 * Calculates line-height to font-size ratios and categorizes them by usage context
 * (tight for headings, normal for body, loose for content).
 *
 * @param lineHeightMap - Map of line-height values with their counts and associated font sizes
 * @returns Array of LineHeightPattern objects, sorted by frequency (most common first), limited to top 5
 * @example
 * const map = new Map([
 *   ["24px", { count: 15, fontSize: [16, 16, 14] }],
 *   ["20px", { count: 8, fontSize: [14, 14] }]
 * ]);
 * const patterns = analyzeLineHeightPatterns(map);
 * // Returns: [
 * //   { value: "24px", ratio: 1.5, count: 15, usage: "Normal (body)" },
 * //   { value: "20px", ratio: 1.43, count: 8, usage: "Normal (body)" }
 * // ]
 */
export function analyzeLineHeightPatterns(lineHeightMap: Map<string, { count: number; fontSize: number[] }>): LineHeightPattern[] {
  const patterns: LineHeightPattern[] = [];

  for (const [value, data] of lineHeightMap.entries()) {
    // Calculate average ratio (line-height / font-size)
    const avgFontSize = data.fontSize.reduce((a, b) => a + b, 0) / data.fontSize.length;
    const lineHeightPx = parseFloat(value);
    const ratio = lineHeightPx / avgFontSize;

    // Determine usage category
    let usage = 'Body text';
    if (ratio <= 1.2) usage = 'Tight (headings)';
    else if (ratio >= 1.6) usage = 'Loose (content)';
    else if (ratio >= 1.4 && ratio < 1.6) usage = 'Normal (body)';

    patterns.push({
      value,
      ratio: Math.round(ratio * 100) / 100,
      count: data.count,
      usage
    });
  }

  // Sort by count (most common first)
  patterns.sort((a, b) => b.count - a.count);

  return patterns.slice(0, 5);
}

/**
 * Infers the appropriate semantic heading level (h1-h6) based on font size.
 * Used when elements are visually styled as headings but don't use semantic heading tags.
 * Maps larger sizes to higher-level headings (h1) and smaller sizes to lower levels (h6).
 *
 * @param fontSize - Font size in pixels
 * @returns Heading tag name (h1, h2, h3, h4, h5, or h6)
 * @example
 * inferHeadingLevelFromSize(36); // Returns "h1"
 * inferHeadingLevelFromSize(24); // Returns "h2"
 * inferHeadingLevelFromSize(16); // Returns "h5"
 */
export function inferHeadingLevelFromSize(fontSize: number): string {
  if (fontSize >= 32) return 'h1';
  if (fontSize >= 24) return 'h2';
  if (fontSize >= 20) return 'h3';
  if (fontSize >= 18) return 'h4';
  if (fontSize >= 16) return 'h5';
  return 'h6';
}

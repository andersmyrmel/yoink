/**
 * Font Weight Extractor
 *
 * Extracts font weights used across the site and generates semantic tokens.
 * Maps numeric weights to semantic names (regular, medium, semibold, bold).
 */

import { getCachedElements, getCachedComputedStyle } from '../utils/domCache';

/**
 * Font weight with semantic name and usage
 */
export interface FontWeightToken {
  value: number;
  semanticName: string;
  cssVariable?: string;
  usageCount: number;
  usedIn: string[]; // Component types using this weight
}

/**
 * Complete font weight system
 */
export interface FontWeightSystem {
  weights: FontWeightToken[];
  cssVariableDefinitions: Record<string, number>; // For generating CSS variables
}

/**
 * Maps numeric weight to semantic name
 */
function mapWeightToSemanticName(weight: number): string {
  if (weight <= 100) return 'thin';
  if (weight <= 200) return 'extralight';
  if (weight <= 300) return 'light';
  if (weight <= 400) return 'regular';
  // Special handling for intermediate weights
  if (weight === 450) return 'medium-light';
  if (weight <= 500) return 'medium';
  if (weight <= 600) return 'semibold';
  if (weight <= 700) return 'bold';
  if (weight <= 800) return 'extrabold';
  return 'black';
}

/**
 * Detects component type from element
 */
function detectComponentType(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const className = String(element.className || '').toLowerCase();
  const role = element.getAttribute('role');

  // Heading
  if (tagName.match(/^h[1-6]$/)) return `heading-${tagName}`;

  // Button
  if (tagName === 'button' || role === 'button') return 'button';

  // Navigation
  if (element.closest('nav, [role="navigation"]')) return 'navigation';

  // Card
  if (className.includes('card')) return 'card';

  // Label
  if (tagName === 'label') return 'label';

  // Body text
  if (tagName === 'p' || tagName === 'span' || tagName === 'div') {
    // Check if it's inside a specific component
    if (element.closest('button, [role="button"]')) return 'button-text';
    if (element.closest('nav, [role="navigation"]')) return 'navigation-text';
    return 'body-text';
  }

  return 'text';
}

/**
 * Extracts font weights from the page
 */
export function extractFontWeights(): FontWeightSystem {
  const elements = getCachedElements();
  const weightUsage = new Map<number, { count: number; usedIn: Set<string> }>();

  // PRIORITY 1: Sample text-containing elements (more likely to have varied weights)
  const textElements = elements.filter(el => {
    const tagName = el.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'div', 'label', 'strong', 'b', 'em'].includes(tagName);
  });

  // PRIORITY 2: Sample from different parts of the page (avoid bias toward DOM order)
  const strategicSample: Element[] = [];

  // Take text elements first (up to 800)
  strategicSample.push(...textElements.slice(0, Math.min(800, textElements.length)));

  // Then sample other elements evenly from beginning, middle, end (up to 200)
  if (strategicSample.length < 1000) {
    const remaining = 1000 - strategicSample.length;
    const otherElements = elements.filter(el => !textElements.includes(el));
    const step = Math.max(1, Math.floor(otherElements.length / remaining));
    for (let i = 0; i < otherElements.length && strategicSample.length < 1000; i += step) {
      strategicSample.push(otherElements[i]);
    }
  }

  for (const element of strategicSample) {
    const styles = getCachedComputedStyle(element);
    const fontWeight = styles.fontWeight;

    // Skip if element is hidden
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      continue;
    }

    // Parse font weight (can be numeric like "400" or keyword like "bold")
    let numericWeight: number;
    if (fontWeight === 'normal') {
      numericWeight = 400;
    } else if (fontWeight === 'bold') {
      numericWeight = 700;
    } else if (fontWeight === 'lighter') {
      numericWeight = 300;
    } else if (fontWeight === 'bolder') {
      numericWeight = 700;
    } else {
      // Parse as number, supporting fractional weights like 450
      const parsed = parseFloat(fontWeight);
      numericWeight = isNaN(parsed) ? 400 : Math.round(parsed);
    }

    // Only track valid font weights (100-900 range)
    if (numericWeight < 100 || numericWeight > 900) {
      continue;
    }

    // Track usage
    if (!weightUsage.has(numericWeight)) {
      weightUsage.set(numericWeight, { count: 0, usedIn: new Set() });
    }

    const usage = weightUsage.get(numericWeight)!;
    usage.count++;
    usage.usedIn.add(detectComponentType(element));
  }

  // Check for CSS variables that define font weights
  const cssVariables = new Map<number, string>();

  try {
    const rootStyles = getComputedStyle(document.documentElement);

    // Look for CSS variables that might be font weights
    for (let i = 0; i < rootStyles.length; i++) {
      const prop = rootStyles[i];
      if (prop.startsWith('--') && (
        prop.includes('font-weight') ||
        prop.includes('weight') ||
        prop.includes('fw')
      )) {
        const value = rootStyles.getPropertyValue(prop).trim();
        const numericValue = parseInt(value);
        if (!isNaN(numericValue) && numericValue >= 100 && numericValue <= 900) {
          cssVariables.set(numericValue, prop);
        }
      }
    }
  } catch (e) {
    // Error reading CSS variables
  }

  // Convert to array of tokens
  const weights: FontWeightToken[] = Array.from(weightUsage.entries())
    .map(([weight, usage]) => ({
      value: weight,
      semanticName: mapWeightToSemanticName(weight),
      cssVariable: cssVariables.get(weight),
      usageCount: usage.count,
      usedIn: Array.from(usage.usedIn),
    }))
    .sort((a, b) => a.value - b.value); // Sort by weight value

  // Generate CSS variable definitions (for sites without them)
  const cssVariableDefinitions: Record<string, number> = {};

  // Only include weights that are actually used
  weights.forEach(weight => {
    const varName = `--font-weight-${weight.semanticName}`;
    cssVariableDefinitions[varName] = weight.value;
  });

  return {
    weights,
    cssVariableDefinitions,
  };
}

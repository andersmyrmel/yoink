/**
 * Layout Extraction Module
 *
 * Handles extraction of layout structure, flexbox/grid patterns, spacing scales,
 * z-index hierarchies, color context, and responsive breakpoints.
 */

import type {
  CSSCustomProperties,
  LayoutStructure,
  FlexboxPattern,
  CompositionPattern,
  ZIndexHierarchy,
  ZIndexLayers,
  ColorContext,
  SpacingScale,
  SpacingPattern,
  LayoutPatterns,
  ColorPairing,
  Container
} from '../types/extraction';
import { extractCSSCustomProperties } from './styleExtractor';
import { normalizeColor } from '../utils/styleHelpers';
import { getCachedElements, getCachedComputedStyle } from '../utils/domCache';

// ============================================================================
// Helper Functions for Color Variable Mapping
// ============================================================================

/**
 * Deduplicates array items based on specified object keys.
 *
 * Creates a composite key from the specified property names and filters out
 * duplicate entries, keeping only the first occurrence of each unique combination.
 *
 * @param arr - The array to deduplicate
 * @param keys - Array of property names to use for uniqueness comparison
 * @returns Deduplicated array
 *
 * @example
 * ```typescript
 * const items = [
 *   { width: '100px', height: '50px' },
 *   { width: '100px', height: '50px' },
 *   { width: '200px', height: '50px' }
 * ];
 * deduplicateByKey(items, ['width', 'height']); // Returns 2 unique items
 * ```
 */
function deduplicateByKey<T extends Record<string, any>>(arr: T[], keys: string[]): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keys.map(k => item[k]).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds a map from computed color values to their CSS variable names.
 *
 * Creates a temporary element to compute the actual color values of CSS variables
 * and maps them back to their variable names. This enables replacing raw color
 * values with semantic CSS variable references like var(--primary-color).
 *
 * @param cssVariables - The CSS custom properties object
 * @returns Map of normalized color values to CSS variable names
 */
function buildColorVariableMap(cssVariables: CSSCustomProperties): Map<string, string> {
  const colorVarMap = new Map<string, string>();
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  try {
    for (const [varName, themes] of Object.entries(cssVariables || {})) {
      const lightValue = themes.light || themes[Object.keys(themes)[0]];
      if (!lightValue) continue;

      // Set the variable value and read the computed color
      tempDiv.style.color = `var(${varName})`;
      const computedColor = getCachedComputedStyle(tempDiv).color;

      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
        const normalized = normalizeColor(computedColor);
        colorVarMap.set(normalized, varName);
      }

      // Also try setting the raw value directly to handle all color formats
      tempDiv.style.color = lightValue;
      const directComputed = getCachedComputedStyle(tempDiv).color;

      if (directComputed && directComputed !== computedColor) {
        const directNormalized = normalizeColor(directComputed);
        if (!colorVarMap.has(directNormalized)) {
          colorVarMap.set(directNormalized, varName);
        }
      }
    }
  } finally {
    document.body.removeChild(tempDiv);
  }

  return colorVarMap;
}

/**
 * Maps a computed color value to its CSS variable reference.
 *
 * Attempts to find a CSS variable that matches the given color. Falls back
 * to common color name mappings (#ffffff, #000000, etc.) or returns the
 * original color if no mapping is found.
 *
 * @param computedColor - The computed color value to map
 * @param colorVarMap - Map of color values to CSS variable names
 * @returns CSS variable reference (e.g., 'var(--primary)') or original color
 */
function mapColorToVariable(computedColor: string, colorVarMap: Map<string, string>): string {
  const normalized = normalizeColor(computedColor);

  // Try direct match
  if (colorVarMap.has(normalized)) {
    return `var(${colorVarMap.get(normalized)})`;
  }

  // Try common color names
  const colorNames: { [key: string]: string } = {
    'rgb(255, 255, 255)': '#ffffff',
    'rgb(0, 0, 0)': '#000000',
    'rgb(255, 0, 0)': '#ff0000',
    'rgb(0, 255, 0)': '#00ff00',
    'rgb(0, 0, 255)': '#0000ff',
  };

  if (colorNames[normalized]) {
    return colorNames[normalized];
  }

  // Return original if no mapping found
  return computedColor;
}

// ============================================================================
// Helper Functions for Spacing Analysis
// ============================================================================

/**
 * Infers the semantic context where spacing is being used.
 *
 * Analyzes element tag names and class names to determine the purpose of the
 * spacing (e.g., button-internal, card-spacing, typography-spacing). This helps
 * categorize spacing values by their usage patterns.
 *
 * @param element - The HTML element to analyze
 * @param type - The type of spacing: 'padding' or 'margin'
 * @returns The inferred context category
 */
function inferSpacingContext(element: HTMLElement, type: string): string {
  const tagName = element.tagName.toLowerCase();
  const className = element.className?.toString() || '';

  // Component-level spacing
  if (tagName === 'button' || className.includes('btn')) {
    return type === 'padding' ? 'button-internal' : 'button-spacing';
  }

  if (className.includes('card') || className.includes('panel')) {
    return type === 'padding' ? 'card-internal' : 'card-spacing';
  }

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return type === 'padding' ? 'input-internal' : 'input-spacing';
  }

  // Layout spacing
  if (tagName === 'section' || tagName === 'article') {
    return type === 'padding' ? 'section-padding' : 'section-margin';
  }

  if (className.includes('container') || className.includes('wrapper')) {
    return 'container-spacing';
  }

  // Typography spacing
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
    return 'typography-spacing';
  }

  return 'general';
}

/**
 * Categorizes spacing values into human-readable usage categories.
 *
 * Groups spacing values by their typical use case based on size:
 * - Micro (≤8px): Component internals
 * - Small (≤16px): Component padding, tight layouts
 * - Medium (≤32px): Component margins, content separation
 * - Large (≤64px): Section padding, major separations
 * - Extra large (>64px): Page layout, hero sections
 *
 * @param spacingEntry - The spacing entry with a numeric value property
 * @returns Human-readable category description
 */
function categorizeSpacingUsage(spacingEntry: { value: number }): string {
  const { value } = spacingEntry;

  // Determine primary usage
  if (value <= 8) {
    return 'Micro spacing (component internals)';
  } else if (value <= 16) {
    return 'Small spacing (component padding, tight layouts)';
  } else if (value <= 32) {
    return 'Medium spacing (component margins, content separation)';
  } else if (value <= 64) {
    return 'Large spacing (section padding, major separations)';
  } else {
    return 'Extra large spacing (page layout, hero sections)';
  }
}

/**
 * Finds the base unit for a spacing scale using greatest common divisor (GCD).
 *
 * Calculates the GCD of spacing values to identify the fundamental unit
 * (typically 4px, 8px, or 16px) that the spacing system is built upon.
 * Falls back to analyzing which common base unit most values are divisible by.
 *
 * @param values - Array of spacing values in pixels
 * @returns The calculated base unit in pixels (typically 4, 8, 12, or 16)
 */
function findBaseUnit(values: number[]): number {
  if (values.length === 0) return 8; // Default fallback

  // Filter out values that are too small or too large
  const filtered = values.filter(v => v >= 4 && v <= 100);
  if (filtered.length === 0) return 8;

  // Calculate GCD of all values
  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
  };

  let result = filtered[0];
  for (let i = 1; i < filtered.length; i++) {
    result = gcd(result, filtered[i]);
    if (result <= 1) break; // Stop if GCD becomes 1
  }

  // Common base units in design systems
  const commonBaseUnits = [4, 8, 6, 12, 16];

  // If calculated GCD is too small, find closest common base unit
  if (result <= 2) {
    // Find which base unit most values are divisible by
    let bestBase = 8;
    let bestScore = 0;

    for (const base of commonBaseUnits) {
      const score = filtered.filter(v => v % base === 0).length;
      if (score > bestScore) {
        bestScore = score;
        bestBase = base;
      }
    }

    return bestBase;
  }

  // Return the calculated GCD if it's reasonable
  return result >= 4 && result <= 16 ? result : 8;
}

/**
 * Analyzes the mathematical pattern/progression of a spacing scale.
 *
 * Examines the ratios between consecutive spacing values to identify the
 * progression type (linear, geometric, doubling, or custom). This helps
 * understand the design system's approach to spacing.
 *
 * @param values - Array of spacing values in ascending order
 * @returns Description of the spacing pattern
 */
function analyzeSpacingPattern(values: number[]): string {
  if (values.length < 2) return 'Insufficient data';

  const ratios: number[] = [];
  for (let i = 1; i < Math.min(values.length, 6); i++) {
    const ratio = values[i] / values[i - 1];
    ratios.push(ratio);
  }

  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  // Identify pattern type
  if (avgRatio < 1.3) {
    return 'Linear progression (evenly spaced)';
  } else if (avgRatio >= 1.3 && avgRatio < 1.7) {
    return `Geometric progression (~${avgRatio.toFixed(1)}x multiplier)`;
  } else if (avgRatio >= 1.7 && avgRatio < 2.2) {
    return 'Doubling pattern (2x progression)';
  } else {
    return 'Custom progression';
  }
}

/**
 * Generates recommendations for improving the spacing scale.
 *
 * Evaluates the completeness of the spacing system based on the number of
 * scale values and provides actionable recommendations for standardization.
 *
 * @param scaleLength - Number of values in the spacing scale
 * @param baseUnit - The base unit in pixels
 * @returns Recommendation text for the spacing system
 */
function generateSpacingRecommendation(scaleLength: number, baseUnit: number): string {
  if (scaleLength <= 5) {
    return `Limited spacing scale detected. Consider expanding to 8-10 values based on ${baseUnit}px base unit.`;
  } else if (scaleLength >= 10) {
    return `Good spacing scale coverage with ${baseUnit}px base unit.`;
  } else {
    return `Moderate spacing scale with ${baseUnit}px base unit. Could benefit from standardization.`;
  }
}

// ============================================================================
// Main Extract Functions
// ============================================================================

/**
 * Extracts the overall layout structure from the page.
 *
 * Scans the DOM to identify and categorize layout elements including:
 * - Fixed position elements (headers, footers, floating UI)
 * - Sticky positioned elements (nav bars, table headers)
 * - Main containers with max-width constraints
 * - Grid layout patterns
 * - Sidebars (fixed panels on left/right)
 *
 * Results are deduplicated to show unique patterns.
 *
 * @returns Layout structure containing categorized layout elements
 *
 * @example
 * ```typescript
 * const layout = extractLayoutStructure();
 * console.log(layout.containers); // [{ maxWidth: '1200px', centered: true, ... }]
 * console.log(layout.sidebars); // [{ width: '240px', position: 'left', ... }]
 * ```
 */
export function extractLayoutStructure(): LayoutStructure {
  const layouts: LayoutStructure = {
    fixedElements: [],
    stickyElements: [],
    containers: [],
    grids: [],
    sidebars: []
  };

  const allElements = getCachedElements();
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = getCachedComputedStyle(element);
    const position = styles.position;
    const display = styles.display;

    // Detect fixed positioned elements
    if (position === 'fixed') {
      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const left = parseFloat(styles.left);
      const right = parseFloat(styles.right);
      const top = parseFloat(styles.top);
      const bottom = parseFloat(styles.bottom);

      // Detect sidebars (fixed, tall, on left or right edge)
      const isSidebar = height > window.innerHeight * 0.5 &&
                       width < window.innerWidth * 0.4 &&
                       (left === 0 || right === 0 || left < 50 || right < 50);

      if (isSidebar) {
        layouts.sidebars.push({
          width: `${Math.round(width)}px`,
          position: left === 0 || left < 50 ? 'left' : 'right',
          backgroundColor: styles.backgroundColor,
          zIndex: styles.zIndex
        });
      } else {
        // Filter out tracking pixels and other tiny elements (< 5px in either dimension)
        const isTrackingPixel = width < 5 || height < 5;

        if (!isTrackingPixel) {
          layouts.fixedElements.push({
            position: 'fixed',
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`,
            top: isNaN(top) ? 'auto' : `${Math.round(top)}px`,
            left: isNaN(left) ? 'auto' : `${Math.round(left)}px`,
            right: isNaN(right) ? 'auto' : `${Math.round(right)}px`,
            bottom: isNaN(bottom) ? 'auto' : `${Math.round(bottom)}px`,
            zIndex: styles.zIndex
          });
        }
      }
    }

    // Detect sticky positioned elements
    if (position === 'sticky' || position === '-webkit-sticky') {
      layouts.stickyElements.push({
        position: 'sticky',
        top: styles.top,
        zIndex: styles.zIndex
      });
    }

    // Detect main containers (high-level layout containers)
    const maxWidth = styles.maxWidth;
    if (maxWidth && maxWidth !== 'none' && parseFloat(maxWidth) > 600) {
      const marginLeft = styles.marginLeft;
      const marginRight = styles.marginRight;
      const isCentered = marginLeft === 'auto' && marginRight === 'auto';

      layouts.containers.push({
        maxWidth,
        centered: isCentered,
        padding: styles.padding
      });
    }

    // Detect grid layouts
    if (display === 'grid') {
      const gridTemplateColumns = styles.gridTemplateColumns;
      const gap = styles.gap || styles.gridGap;

      if (gridTemplateColumns && gridTemplateColumns !== 'none') {
        layouts.grids.push({
          columns: gridTemplateColumns,
          gap: gap || '0px',
          alignItems: styles.alignItems,
          justifyItems: styles.justifyItems
        });
      }
    }
  });

  // Deduplicate similar entries
  layouts.sidebars = deduplicateByKey(layouts.sidebars, ['width', 'position']);
  layouts.fixedElements = deduplicateByKey(layouts.fixedElements, ['width', 'height', 'top']);
  layouts.stickyElements = deduplicateByKey(layouts.stickyElements, ['top']);
  layouts.containers = deduplicateByKey(layouts.containers, ['maxWidth']);
  layouts.grids = deduplicateByKey(layouts.grids, ['columns', 'gap']);

  return layouts;
}

/**
 * Extracts flexbox patterns and usage statistics from the page.
 *
 * Scans elements with display: flex or inline-flex and groups them by their
 * configuration (direction, justify-content, align-items, gap, wrap). Counts
 * how frequently each pattern is used to identify common flexbox conventions.
 *
 * @returns Array of flexbox patterns sorted by usage frequency (most common first)
 *
 * @example
 * ```typescript
 * const patterns = extractFlexboxPatterns();
 * // [
 * //   { flexDirection: 'row', justifyContent: 'space-between',
 * //     alignItems: 'center', gap: '8px', count: 42 },
 * //   ...
 * // ]
 * ```
 */
export function extractFlexboxPatterns(): FlexboxPattern[] {
  const flexPatterns = new Map<string, FlexboxPattern>();
  const allElements = getCachedElements();
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = getCachedComputedStyle(element);

    if (styles.display === 'flex' || styles.display === 'inline-flex') {
      const pattern = {
        flexDirection: styles.flexDirection,
        justifyContent: styles.justifyContent,
        alignItems: styles.alignItems,
        gap: styles.gap,
        flexWrap: styles.flexWrap
      };

      const signature = `${pattern.flexDirection}-${pattern.justifyContent}-${pattern.alignItems}-${pattern.gap}`;

      if (flexPatterns.has(signature)) {
        const existing = flexPatterns.get(signature)!;
        existing.count++;
      } else {
        flexPatterns.set(signature, { ...pattern, count: 1 });
      }
    }
  });

  return Array.from(flexPatterns.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Extracts component composition and nesting patterns.
 *
 * Identifies common combinations of components on the page, such as:
 * - Cards with buttons
 * - Cards with images
 * - Modals with forms
 * - Navigation with dropdowns
 * - Tables with action buttons
 * - Buttons with icons
 *
 * Helps understand how components are typically composed together.
 *
 * @returns Array of composition patterns sorted by frequency
 *
 * @example
 * ```typescript
 * const compositions = extractComponentComposition();
 * // [
 * //   { pattern: 'card-with-button', count: 12,
 * //     description: '[class*="card"] containing button' },
 * //   ...
 * // ]
 * ```
 */
export function extractComponentComposition(): CompositionPattern[] {
  const compositions: CompositionPattern[] = [];

  // Look for common composition patterns
  const patterns = [
    {
      name: 'card-with-button',
      selector: '[class*="card"], article',
      childSelector: 'button, [role="button"]'
    },
    {
      name: 'card-with-image',
      selector: '[class*="card"], article',
      childSelector: 'img'
    },
    {
      name: 'modal-with-form',
      selector: '[role="dialog"], [class*="modal"]',
      childSelector: 'form, input, textarea'
    },
    {
      name: 'nav-with-dropdown',
      selector: 'nav, [role="navigation"]',
      childSelector: '[role="menu"], [class*="dropdown"]'
    },
    {
      name: 'table-with-actions',
      selector: 'table, [role="table"]',
      childSelector: 'button, [class*="action"]'
    },
    {
      name: 'form-with-validation',
      selector: 'form',
      childSelector: '[class*="error"], [class*="invalid"], [aria-invalid="true"]'
    },
    {
      name: 'button-with-icon',
      selector: 'button, [role="button"]',
      childSelector: 'svg, [class*="icon"]'
    },
    {
      name: 'input-with-label',
      selector: 'input, textarea, select',
      childSelector: 'label'
    },
    {
      name: 'list-with-avatars',
      selector: 'ul, ol, [role="list"]',
      childSelector: '[class*="avatar"], img[class*="profile"]'
    }
  ];

  patterns.forEach(pattern => {
    const containers = document.querySelectorAll(pattern.selector);
    let count = 0;

    containers.forEach(container => {
      const children = container.querySelectorAll(pattern.childSelector);
      if (children.length > 0) {
        count++;
      }
    });

    if (count > 0) {
      compositions.push({
        pattern: pattern.name,
        count,
        description: `${pattern.selector} containing ${pattern.childSelector}`
      });
    }
  });

  return compositions.sort((a, b) => b.count - a.count);
}

/**
 * Extracts z-index hierarchy and organizes it into semantic layers.
 *
 * Analyzes positioned elements to build a map of z-index values and their usage.
 * Automatically categorizes elements by their context (modal, dropdown, tooltip, etc.)
 * based on class names. Organizes z-index values into semantic layers:
 * - Base (1-10): General stacking
 * - Dropdown (10-100): Dropdown menus
 * - Modal (100-1000): Modal dialogs
 * - Toast (1000+): Toast notifications, tooltips
 *
 * @returns Z-index hierarchy with semantic organization and usage statistics
 *
 * @example
 * ```typescript
 * const zIndex = extractZIndexHierarchy();
 * console.log(zIndex.hierarchy); // All z-index values sorted
 * console.log(zIndex.layers.modal); // Only modal-layer z-indexes
 * console.log(zIndex.range); // { min: 1, max: 9999 }
 * ```
 */
export function extractZIndexHierarchy(): ZIndexHierarchy {
  const zIndexMap = new Map<number, { elements: number; contexts: string[] }>();

  const allElements = getCachedElements();
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = getCachedComputedStyle(element);
    const zIndex = parseInt(styles.zIndex, 10);

    if (!isNaN(zIndex) && zIndex !== 0) {
      const position = styles.position;

      // z-index only works on positioned elements
      if (position !== 'static') {
        const existing = zIndexMap.get(zIndex) || { elements: 0, contexts: [] };
        existing.elements += 1;

        // Detect context by class names
        const className = element.className.toString().toLowerCase();
        if (className.includes('modal') && !existing.contexts.includes('modal')) {
          existing.contexts.push('modal');
        } else if (className.includes('dropdown') && !existing.contexts.includes('dropdown')) {
          existing.contexts.push('dropdown');
        } else if (className.includes('tooltip') && !existing.contexts.includes('tooltip')) {
          existing.contexts.push('tooltip');
        } else if (className.includes('toast') || className.includes('notification')) {
          if (!existing.contexts.includes('toast')) existing.contexts.push('toast');
        } else if (className.includes('header') || className.includes('nav')) {
          if (!existing.contexts.includes('navigation')) existing.contexts.push('navigation');
        } else if (className.includes('sidebar')) {
          if (!existing.contexts.includes('sidebar')) existing.contexts.push('sidebar');
        }

        zIndexMap.set(zIndex, existing);
      }
    }
  });

  // Convert to sorted array
  const hierarchy = Array.from(zIndexMap.entries())
    .map(([zIndex, data]) => ({
      zIndex,
      elements: data.elements,
      contexts: data.contexts.length > 0 ? data.contexts : ['base']
    }))
    .sort((a, b) => a.zIndex - b.zIndex);

  // Organize into semantic layers
  const layers: ZIndexLayers = {
    base: [],      // z-index 1-10
    dropdown: [],  // z-index 10-100
    modal: [],     // z-index 100-1000
    toast: []      // z-index 1000+
  };

  hierarchy.forEach(item => {
    if (item.zIndex < 10) {
      layers.base.push(item);
    } else if (item.zIndex < 100) {
      layers.dropdown.push(item);
    } else if (item.zIndex < 1000) {
      layers.modal.push(item);
    } else {
      layers.toast.push(item);
    }
  });

  return {
    hierarchy,
    layers,
    range: hierarchy.length > 0 ? {
      min: hierarchy[0].zIndex,
      max: hierarchy[hierarchy.length - 1].zIndex
    } : null
  };
}

/**
 * Extracts color usage context with CSS variable mapping.
 *
 * Analyzes how colors are used across the page:
 * - Background colors with usage counts
 * - Text colors with usage counts
 * - Border colors with usage counts
 * - Common color pairings (background + text combinations)
 * - Mapping from computed colors to CSS variable names
 *
 * Attempts to replace raw color values with their semantic CSS variable
 * references (e.g., rgb(0, 102, 204) → var(--primary-color)).
 *
 * @returns Color context with usage statistics and CSS variable mappings
 *
 * @example
 * ```typescript
 * const colors = extractColorContext();
 * console.log(colors.backgrounds); // { 'rgb(255, 255, 255)': 45, ... }
 * console.log(colors.pairings[0]); // { background: 'rgb(0, 0, 0)',
 *                                  //   backgroundVar: 'var(--bg-dark)',
 *                                  //   text: 'rgb(255, 255, 255)',
 *                                  //   textVar: 'var(--text-light)', count: 23 }
 * ```
 */
export function extractColorContext(): ColorContext {
  const colorUsage: ColorContext = {
    backgrounds: {},
    text: {},
    borders: {},
    pairings: [],
    variableMap: {}
  };

  // Get CSS variables for mapping
  const cssVariables = extractCSSCustomProperties();
  const colorVarMap = buildColorVariableMap(cssVariables);

  const pairingMap = new Map<string, any>();
  const elements = getCachedElements();
  const maxElements = Math.min(elements.length, 300);

  for (let i = 0; i < maxElements; i++) {
    const element = elements[i];
    const styles = getCachedComputedStyle(element);

    // Track background colors
    const bg = styles.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const normalized = normalizeColor(bg);
      colorUsage.backgrounds[normalized] = (colorUsage.backgrounds[normalized] || 0) + 1;

      // Map to variable name
      const bgVar = mapColorToVariable(bg, colorVarMap);
      if (bgVar !== bg && bgVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = bgVar;
      }

      // Track color pairings
      const textColor = styles.color;
      if (textColor) {
        const normalizedText = normalizeColor(textColor);
        const pairKey = `${normalized}::${normalizedText}`;

        // Map text color to variable
        const textVar = mapColorToVariable(textColor, colorVarMap);
        if (textVar !== textColor && textVar.startsWith('var(')) {
          colorUsage.variableMap[normalizedText] = textVar;
        }

        if (pairingMap.has(pairKey)) {
          const existing = pairingMap.get(pairKey)!;
          existing.count++;
        } else {
          const pairing: ColorPairing = {
            pair: `${normalized} / ${normalizedText}`,
            background: normalized,
            backgroundVar: bgVar,
            text: normalizedText,
            textVar: textVar,
            count: 1
          };
          pairingMap.set(pairKey, pairing);
        }
      }
    }

    // Track text colors
    const textColor = styles.color;
    if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
      const normalized = normalizeColor(textColor);
      colorUsage.text[normalized] = (colorUsage.text[normalized] || 0) + 1;

      // Map to variable name
      const textVar = mapColorToVariable(textColor, colorVarMap);
      if (textVar !== textColor && textVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = textVar;
      }
    }

    // Track border colors
    const borderColor = styles.borderColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && styles.borderWidth !== '0px') {
      const normalized = normalizeColor(borderColor);
      colorUsage.borders[normalized] = (colorUsage.borders[normalized] || 0) + 1;

      // Map to variable name
      const borderVar = mapColorToVariable(borderColor, colorVarMap);
      if (borderVar !== borderColor && borderVar.startsWith('var(')) {
        colorUsage.variableMap[normalized] = borderVar;
      }
    }
  }

  // Convert pairings map to sorted array
  colorUsage.pairings = Array.from(pairingMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return colorUsage;
}

/**
 * Extracts comprehensive spacing scale from the page.
 *
 * Analyzes padding and margin values across the page to identify:
 * - Common spacing values and their usage frequency
 * - Base unit (fundamental spacing unit like 4px or 8px)
 * - Spacing scale pattern (linear, geometric, doubling, etc.)
 * - Usage contexts (button-internal, card-spacing, typography, etc.)
 * - Recommendations for spacing system improvement
 *
 * Only includes values that are multiples of the base unit (within 2px tolerance).
 *
 * @returns Spacing scale analysis with base unit, pattern, and recommendations
 *
 * @example
 * ```typescript
 * const spacing = extractSpacingScale();
 * console.log(spacing.baseUnit); // '8px'
 * console.log(spacing.pattern); // 'Linear progression (evenly spaced)'
 * console.log(spacing.spacingScale[0]); // { value: '8px', count: 156,
 *                                        //   usage: 'Micro spacing...', contexts: [...] }
 * ```
 */
export function extractSpacingScale(): SpacingScale {
  const spacingValues = new Map<number, {
    value: number;
    count: number;
    usages: { padding: number; margin: number };
    contexts: Set<string>;
  }>();
  const elements = document.querySelectorAll('*');
  const maxElements = Math.min(elements.length, 500);

  // Collect all spacing values from elements
  for (let i = 0; i < maxElements; i++) {
    const el = elements[i] as HTMLElement;
    const styles = getCachedComputedStyle(el);
    const tagName = el.tagName.toLowerCase();

    // Skip script, style, and head elements
    if (tagName === 'script' || tagName === 'style' || tagName === 'head') continue;

    // Extract padding values
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;

    // Extract margin values
    const marginTop = parseFloat(styles.marginTop) || 0;
    const marginRight = parseFloat(styles.marginRight) || 0;
    const marginBottom = parseFloat(styles.marginBottom) || 0;
    const marginLeft = parseFloat(styles.marginLeft) || 0;

    // Track all non-zero spacing values
    const allValues = [
      { value: paddingTop, type: 'padding', side: 'top' },
      { value: paddingRight, type: 'padding', side: 'right' },
      { value: paddingBottom, type: 'padding', side: 'bottom' },
      { value: paddingLeft, type: 'padding', side: 'left' },
      { value: marginTop, type: 'margin', side: 'top' },
      { value: marginRight, type: 'margin', side: 'right' },
      { value: marginBottom, type: 'margin', side: 'bottom' },
      { value: marginLeft, type: 'margin', side: 'left' }
    ];

    for (const item of allValues) {
      if (item.value > 0 && item.value < 1000) { // Filter out extreme values
        const rounded = Math.round(item.value); // Round to nearest pixel

        if (!spacingValues.has(rounded)) {
          spacingValues.set(rounded, {
            value: rounded,
            count: 0,
            usages: { padding: 0, margin: 0 },
            contexts: new Set<string>()
          });
        }

        const entry = spacingValues.get(rounded)!;
        entry.count++;
        entry.usages[item.type as 'padding' | 'margin']++;

        // Track context (what type of element uses this spacing)
        const context = inferSpacingContext(el, item.type);
        entry.contexts.add(context);
      }
    }
  }

  // Convert to sorted array
  const sortedSpacing = Array.from(spacingValues.values())
    .sort((a, b) => b.count - a.count);

  // Identify the base unit (GCD of common spacing values)
  const topValues = sortedSpacing.slice(0, 10).map(s => s.value);
  const baseUnit = findBaseUnit(topValues);

  // Build spacing scale (values that are multiples of base unit or close to it)
  const spacingScale = sortedSpacing
    .filter(s => {
      // Include if it's a multiple of base unit (within 2px tolerance)
      const ratio = s.value / baseUnit;
      const nearestMultiple = Math.round(ratio);
      return Math.abs(s.value - (nearestMultiple * baseUnit)) <= 2;
    })
    .slice(0, 12) // Limit to top 12 scale values
    .map(s => ({
      value: `${s.value}px`,
      count: s.count,
      usage: categorizeSpacingUsage(s),
      contexts: Array.from(s.contexts)
    }));

  // Analyze the scale pattern
  const scalePattern = analyzeSpacingPattern(spacingScale.map(s => parseInt(s.value)));

  return {
    spacingScale,
    baseUnit: `${baseUnit}px`,
    pattern: scalePattern,
    totalUniqueValues: spacingValues.size,
    recommendation: generateSpacingRecommendation(spacingScale.length, baseUnit)
  };
}

/**
 * Extracts comprehensive layout patterns from the page.
 *
 * Aggregates multiple layout-related extraction results:
 * - Container patterns (max-width, padding, centering)
 * - Responsive breakpoints from media queries and Tailwind classes
 * - Spacing scale analysis
 * - Common spacing patterns (padding/margin combinations)
 *
 * This is a high-level extraction that combines multiple sub-analyses.
 *
 * @returns Complete layout patterns including containers, breakpoints, and spacing
 *
 * @example
 * ```typescript
 * const patterns = extractLayoutPatterns();
 * console.log(patterns.containers); // [{ maxWidth: '1200px', padding: '20px', ... }]
 * console.log(patterns.breakpoints); // [640, 768, 1024, 1280, 1536]
 * console.log(patterns.spacingScale.baseUnit); // '8px'
 * ```
 */
export function extractLayoutPatterns(): LayoutPatterns {
  const layout = {
    containers: [] as Container[],
    breakpoints: extractBreakpoints(),
    spacingScale: extractSpacingScale(),
    spacingPatterns: {} as Record<string, SpacingPattern>
  };

  // Find container elements
  const containerSelectors = '[class*="container"], main, section, [class*="wrapper"]';
  const containers = document.querySelectorAll(containerSelectors);
  const containerMap = new Map<string, Container>();

  containers.forEach(el => {
    const styles = getCachedComputedStyle(el);
    const maxWidth = styles.maxWidth;

    if (maxWidth && maxWidth !== 'none') {
      const key = `${maxWidth}-${styles.padding}`;

      if (containerMap.has(key)) {
        containerMap.get(key)!.count++;
      } else {
        const className = (el as HTMLElement).className;
        const firstClass = className ? className.split(' ')[0] : '';

        containerMap.set(key, {
          selector: el.tagName.toLowerCase() + (firstClass ? `.${firstClass}` : ''),
          maxWidth,
          padding: styles.padding,
          count: 1
        });
      }
    }
  });

  layout.containers = Array.from(containerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Extract spacing patterns
  const spacingElements = document.querySelectorAll('section, article, div[class*="card"], [class*="container"]');
  const maxSpacingElements = Math.min(spacingElements.length, 100);

  for (let i = 0; i < maxSpacingElements; i++) {
    const el = spacingElements[i];
    const styles = getCachedComputedStyle(el);

    const padding = styles.padding;
    if (padding && padding !== '0px') {
      const key = `padding:${padding}`;
      if (!layout.spacingPatterns[key]) {
        layout.spacingPatterns[key] = { type: 'padding' as const, count: 0 };
      }
      layout.spacingPatterns[key].count++;
    }

    const margin = styles.margin;
    if (margin && margin !== '0px') {
      const key = `margin:${margin}`;
      if (!layout.spacingPatterns[key]) {
        layout.spacingPatterns[key] = { type: 'margin' as const, count: 0 };
      }
      layout.spacingPatterns[key].count++;
    }
  }

  return layout;
}

/**
 * Extracts responsive breakpoints from stylesheets and Tailwind classes.
 *
 * Scans for breakpoint usage in two ways:
 * 1. Parses @media rules in stylesheets to extract pixel values
 * 2. Detects Tailwind responsive class prefixes (sm:, md:, lg:, xl:, 2xl:)
 *
 * Returns a sorted list of unique breakpoint values commonly used for
 * responsive design (320px - 2560px range).
 *
 * @returns Sorted array of breakpoint values in pixels
 *
 * @example
 * ```typescript
 * const breakpoints = extractBreakpoints();
 * // [640, 768, 1024, 1280, 1536]
 * ```
 */
export function extractBreakpoints(): number[] {
  const breakpoints = new Set<number>();

  // Extract from @media rules in stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.href && (
        sheet.href.includes('chrome-extension://') ||
        sheet.href.includes('moz-extension://') ||
        sheet.href.includes('safari-extension://')
      )) {
        continue;
      }

      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];

        if (rule.constructor.name === 'CSSMediaRule' || rule.type === CSSRule.MEDIA_RULE) {
          const mediaRule = rule as CSSMediaRule;
          const text = mediaRule.conditionText || mediaRule.media.mediaText;

          // Extract pixel values from media queries
          const matches = text.match(/(\d+)px/g);
          if (matches) {
            matches.forEach(match => {
              const value = parseInt(match);
              if (value >= 320 && value <= 2560) {
                breakpoints.add(value);
              }
            });
          }
        }
      }
    } catch (error) {
      // Log for debugging (use console.debug to keep it low-priority)
      console.debug('Failed to access stylesheet for breakpoint extraction (likely CORS):', error);
      // CORS or permission error - skip this stylesheet
    }
  }

  // Extract from Tailwind responsive classes
  const allElements = getCachedElements();
  const maxElements = Math.min(allElements.length, 500);

  for (let i = 0; i < maxElements; i++) {
    const classes = allElements[i].className;
    if (typeof classes !== 'string') continue;

    if (classes.includes('sm:')) breakpoints.add(640);
    if (classes.includes('md:')) breakpoints.add(768);
    if (classes.includes('lg:')) breakpoints.add(1024);
    if (classes.includes('xl:')) breakpoints.add(1280);
    if (classes.includes('2xl:')) breakpoints.add(1536);
  }

  return Array.from(breakpoints).sort((a, b) => a - b);
}

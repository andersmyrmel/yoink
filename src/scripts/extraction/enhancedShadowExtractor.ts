/**
 * Enhanced Shadow Extractor
 *
 * Extends the base shadow extractor to link shadows to the components that use them.
 * This provides context about where each shadow is applied in the design system.
 */

import { getCachedComputedStyle } from '../utils/domCache';
import {
  parseShadow,
  groupShadowsByElevation,
  detectShadowPattern
} from './styleExtractor';
import type { ParsedShadow, EnhancedShadowSystem, ShadowWithUsage } from '../types/extraction';

/**
 * Detects button variant based on visual characteristics
 */
function detectButtonVariant(element: Element): string {
  // Safely handle SVGAnimatedString (SVG elements have non-string className)
  const className = String(element.className || '').toLowerCase();

  // Check for explicit variant hints in class names or data attributes
  if (className.includes('primary')) return 'button-primary';
  if (className.includes('secondary')) return 'button-secondary';
  if (className.includes('outline')) return 'button-outline';
  if (className.includes('ghost') || className.includes('link')) return 'button-ghost';
  if (className.includes('danger') || className.includes('destructive')) return 'button-danger';
  if (className.includes('success')) return 'button-success';

  const dataVariant = element.getAttribute('data-variant') ||
                     element.getAttribute('data-type') ||
                     element.getAttribute('data-kind');
  if (dataVariant) {
    const variant = dataVariant.toLowerCase();
    if (['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'].includes(variant)) {
      return `button-${variant}`;
    }
  }

  // Analyze background color if available (quick heuristic)
  try {
    const styles = getCachedComputedStyle(element);
    const bg = styles.backgroundColor;

    const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
    if (isTransparent) {
      const hasBorder = parseFloat(styles.borderWidth) > 0;
      return hasBorder ? 'button-outline' : 'button-ghost';
    }

    // Check if it's a colored button (likely primary)
    const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      // High saturation = likely primary/accent button
      if (saturation > 50) {
        // Check for specific colors
        const isReddish = r > g + 30 && r > b + 30 && r > 150;
        const isGreenish = g > r + 30 && g > b + 30 && g > 150;
        const isPurplish = (r > 80 && b > 80 && Math.abs(r - b) < 50 && g < r - 20);
        const isBlueish = b > r + 20 && b > g + 20;

        if (isReddish) return 'button-danger';
        if (isGreenish) return 'button-success';
        if (isPurplish || isBlueish) return 'button-primary';
      }

      // Low saturation grayscale = likely default/secondary
      if (saturation < 30) {
        return 'button-secondary';
      }
    }
  } catch (e) {
    // Style access failed, fall back to generic
  }

  return 'button';
}

/**
 * Component type detection heuristics with variant specificity
 */
function detectComponentType(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  // Safely handle SVGAnimatedString (SVG elements have non-string className)
  const className = String(element.className || '').toLowerCase();
  const role = element.getAttribute('role');

  // Button detection with variant
  if (tagName === 'button' || role === 'button') {
    return detectButtonVariant(element);
  }

  // Card detection with variant
  if (className.includes('card') || tagName === 'article') {
    if (className.includes('elevated') || className.includes('raised')) return 'card-elevated';
    if (className.includes('outlined')) return 'card-outlined';
    return 'card';
  }

  // Modal detection
  if (className.includes('modal') || className.includes('dialog') || role === 'dialog') return 'modal';

  // Menu/dropdown detection
  if (className.includes('menu') || className.includes('dropdown') || role === 'menu') return 'menu';

  // Tooltip detection
  if (className.includes('tooltip') || role === 'tooltip') return 'tooltip';

  // Panel/paper detection
  if (className.includes('panel') || className.includes('paper') || className.includes('surface')) return 'panel';

  // Input detection
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return 'input';

  // Navigation detection
  if (tagName === 'nav' || role === 'navigation') return 'navigation';

  // Header/footer detection
  if (tagName === 'header') return 'header';
  if (tagName === 'footer') return 'footer';

  // Image detection
  if (tagName === 'img' || tagName === 'figure') return 'image';

  return 'unknown';
}

/**
 * Generates a simple selector string for an element (for identification)
 */
function generateSelector(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).slice(0, 2).join('.');
  const role = element.getAttribute('role');

  if (role) {
    return `[role="${role}"]`;
  }

  if (classes) {
    return `${tagName}.${classes}`;
  }

  return tagName;
}

/**
 * Extracts shadows with component usage context
 */
export function extractShadowsWithUsage(): EnhancedShadowSystem {
  // Map: shadow value -> array of elements using it
  const shadowToElements = new Map<string, Element[]>();

  // Target elements that commonly have shadows
  const shadowSelectors = [
    '[class*="card"]', '[class*="modal"]', '[class*="dialog"]', '[class*="popup"]',
    '[class*="menu"]', '[class*="dropdown"]', '[class*="tooltip"]', '[class*="popover"]',
    '[class*="panel"]', '[class*="sheet"]', '[class*="paper"]', '[class*="surface"]',
    'button', 'input', 'select', 'textarea',
    'img', 'figure', 'article',
    'header', 'footer', 'aside', 'nav', 'section',
    '[role="dialog"]', '[role="menu"]', '[role="tooltip"]'
  ];

  const shadowElements = document.querySelectorAll(shadowSelectors.join(', '));
  const maxElements = Math.min(shadowElements.length, 1000);

  // Collect all shadows and track which elements use them
  for (let i = 0; i < maxElements; i++) {
    const element = shadowElements[i];
    const styles = getCachedComputedStyle(element);
    const boxShadow = styles.boxShadow;

    if (boxShadow && boxShadow !== 'none') {
      if (!shadowToElements.has(boxShadow)) {
        shadowToElements.set(boxShadow, []);
      }
      shadowToElements.get(boxShadow)!.push(element);
    }

    // Also check ::before and ::after pseudo-elements
    try {
      const beforeStyles = window.getComputedStyle(element, '::before');
      const beforeShadow = beforeStyles.boxShadow;
      if (beforeShadow && beforeShadow !== 'none') {
        if (!shadowToElements.has(beforeShadow)) {
          shadowToElements.set(beforeShadow, []);
        }
        shadowToElements.get(beforeShadow)!.push(element);
      }

      const afterStyles = window.getComputedStyle(element, '::after');
      const afterShadow = afterStyles.boxShadow;
      if (afterShadow && afterShadow !== 'none') {
        if (!shadowToElements.has(afterShadow)) {
          shadowToElements.set(afterShadow, []);
        }
        shadowToElements.get(afterShadow)!.push(element);
      }
    } catch (e) {
      // Pseudo-element access might fail on some elements
    }
  }

  // Parse all unique shadows with usage counts
  const parsedShadows: Array<{ parsed: ParsedShadow; count: number }> = [];
  for (const [shadowStr, elements] of shadowToElements.entries()) {
    const parsed = parseShadow(shadowStr);
    if (parsed) {
      parsedShadows.push({ parsed, count: elements.length });
    }
  }

  // Group similar shadows and assign elevation levels (using existing function)
  const shadowGroups = groupShadowsByElevation(parsedShadows);

  // Enhance groups with component usage information
  const enhancedGroups: ShadowWithUsage[] = shadowGroups.map(group => {
    // For each shadow in this group, find which components use it
    const componentUsage = new Map<string, { selector: string; count: number }>();

    group.shadows.forEach(shadow => {
      const elements = shadowToElements.get(shadow.raw) || [];

      elements.forEach(element => {
        const componentType = detectComponentType(element);
        const selector = generateSelector(element);
        const key = `${componentType}|${selector}`;

        if (componentUsage.has(key)) {
          componentUsage.get(key)!.count++;
        } else {
          componentUsage.set(key, { selector, count: 1 });
        }
      });
    });

    // Convert to array format
    const usedBy = Array.from(componentUsage.entries()).map(([key, data]) => {
      const [componentType] = key.split('|');
      return {
        componentType,
        selector: data.selector,
        count: data.count,
      };
    });

    // Sort by count descending
    usedBy.sort((a, b) => b.count - a.count);

    return {
      ...group,
      usedBy,
    };
  });

  // Build component usage map (componentType -> shadow values)
  const componentUsage = new Map<string, string[]>();
  for (const [shadowStr, elements] of shadowToElements.entries()) {
    elements.forEach(element => {
      const componentType = detectComponentType(element);
      if (!componentUsage.has(componentType)) {
        componentUsage.set(componentType, []);
      }
      if (!componentUsage.get(componentType)!.includes(shadowStr)) {
        componentUsage.get(componentType)!.push(shadowStr);
      }
    });
  }

  // Detect pattern
  const pattern = detectShadowPattern(shadowGroups);

  return {
    elevationLevels: enhancedGroups,
    pattern,
    totalUniqueShadows: shadowToElements.size,
    componentUsage,
  };
}

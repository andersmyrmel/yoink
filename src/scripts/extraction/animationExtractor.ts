import type {
  AnimationExtraction,
  TransitionPattern
} from '../types/extraction';
import { getCachedElements } from '../utils/domCache';

/**
 * Extracts animations and transition patterns from the current document.
 *
 * Analyzes computed styles of DOM elements to identify:
 * - CSS transitions with their properties, durations, easing functions, and delays
 * - CSS animations and their usage frequency
 * - Common animation durations across the page
 * - Common easing functions used in transitions
 *
 * The extraction process:
 * 1. Samples up to 1000 elements from the DOM to avoid performance issues
 * 2. Extracts and parses transition and animation properties from computed styles
 * 3. Deduplicates and aggregates patterns by usage frequency
 * 4. Returns the top 20 transition patterns and top 10 animations
 * 5. Identifies the 5 most common durations and easing functions
 *
 * @returns {AnimationExtraction} Object containing:
 *   - transitions: Array of transition patterns with property, duration, easing, delay, and usage count
 *   - animations: Array of animation patterns with their raw CSS values and usage count
 *   - commonDurations: Top 5 most frequently used animation/transition durations
 *   - commonEasings: Top 5 most frequently used easing functions
 *
 * @example
 * const animations = extractAnimations();
 * console.log(animations.transitions); // [{ property: 'opacity', duration: '300ms', easing: 'ease-in-out', delay: '0s', count: 42 }, ...]
 * console.log(animations.commonDurations); // [{ duration: '300ms', count: 120 }, ...]
 */
export function extractAnimations(): AnimationExtraction {
  const transitions = new Map<string, number>();
  const animations = new Map<string, number>();

  const allElements = getCachedElements();
  const MAX_ELEMENTS = 1000;
  const elementsToCheck = Array.from(allElements).slice(0, MAX_ELEMENTS);

  elementsToCheck.forEach(el => {
    const element = el as HTMLElement;
    const styles = window.getComputedStyle(element);

    // Extract transitions
    const transition = styles.transition;
    if (transition && transition !== 'all 0s ease 0s' && transition !== 'none') {
      const count = transitions.get(transition) || 0;
      transitions.set(transition, count + 1);
    }

    // Extract animations
    const animation = styles.animation;
    if (animation && animation !== 'none') {
      const count = animations.get(animation) || 0;
      animations.set(animation, count + 1);
    }
  });

  // Parse common transition patterns
  const transitionPatterns: TransitionPattern[] = [];
  transitions.forEach((count, transition) => {
    // Parse transition string
    const parts = transition.split(',').map(t => t.trim());
    parts.forEach(part => {
      const match = part.match(/^([\w-]+)\s+([\d.]+m?s)\s+([\w-]+)(?:\s+([\d.]+m?s))?/);
      if (match) {
        transitionPatterns.push({
          property: match[1],
          duration: match[2],
          easing: match[3],
          delay: match[4] || '0s',
          count
        });
      }
    });
  });

  // Deduplicate and sort by count
  const uniqueTransitions = deduplicateByKey(transitionPatterns, ['property', 'duration', 'easing'])
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const uniqueAnimations = Array.from(animations.entries())
    .map(([animation, count]) => ({ animation, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Extract common durations and easings
  const durations = new Map<string, number>();
  const easings = new Map<string, number>();

  uniqueTransitions.forEach(t => {
    const dCount = durations.get(t.duration) || 0;
    durations.set(t.duration, dCount + t.count);

    const eCount = easings.get(t.easing) || 0;
    easings.set(t.easing, eCount + t.count);
  });

  return {
    transitions: uniqueTransitions,
    animations: uniqueAnimations,
    commonDurations: Array.from(durations.entries())
      .map(([duration, count]) => ({ duration, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    commonEasings: Array.from(easings.entries())
      .map(([easing, count]) => ({ easing, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}

/**
 * Deduplicates an array of objects based on specified key properties.
 *
 * Creates a composite key from the specified properties and filters out
 * duplicate entries, keeping only the first occurrence of each unique
 * combination.
 *
 * @template T - The type of objects in the array
 * @param {T[]} arr - The array of objects to deduplicate
 * @param {(keyof T)[]} keys - Array of property names to use for deduplication
 * @returns {T[]} A new array with duplicate entries removed based on the specified keys
 *
 * @example
 * const items = [
 *   { property: 'opacity', duration: '300ms', count: 5 },
 *   { property: 'opacity', duration: '300ms', count: 3 },
 *   { property: 'color', duration: '200ms', count: 2 }
 * ];
 * const unique = deduplicateByKey(items, ['property', 'duration']);
 * // Returns: [
 * //   { property: 'opacity', duration: '300ms', count: 5 },
 * //   { property: 'color', duration: '200ms', count: 2 }
 * // ]
 */
function deduplicateByKey<T>(
  arr: T[],
  keys: (keyof T)[]
): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keys.map(k => String(item[k])).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

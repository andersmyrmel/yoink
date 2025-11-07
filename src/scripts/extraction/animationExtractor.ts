/**
 * Extracts animations and transition patterns
 */
export function extractAnimations(): any {
  const transitions = new Map<string, number>();
  const animations = new Map<string, number>();

  const allElements = document.querySelectorAll('*');
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
  const transitionPatterns: any[] = [];
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
 * Helper function to deduplicate array of objects by specified keys
 */
function deduplicateByKey(arr: any[], keys: string[]): any[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keys.map(k => item[k]).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

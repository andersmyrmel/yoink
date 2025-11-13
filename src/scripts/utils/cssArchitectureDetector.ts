/**
 * CSS Architecture Detector
 *
 * Detects the CSS architecture strategy used by a website:
 * - CSS-in-JS (styled-components, Emotion, etc.)
 * - Utility-first (Tailwind, Twind, UnoCSS)
 * - Traditional CSS (BEM, SMACSS, etc.)
 *
 * This detection helps inform extraction strategies.
 */

export type CSSArchitecture =
  | 'css-in-js'
  | 'utility-first'
  | 'traditional'
  | 'mixed';

export interface CSSArchitectureInfo {
  architecture: CSSArchitecture;
  confidence: number; // 0-1
  indicators: string[];
  framework?: string; // e.g., 'styled-components', 'tailwind', etc.
  recommendation: string;
}

/**
 * Hashed class name patterns used by CSS-in-JS libraries
 */
const CSS_IN_JS_PATTERNS = [
  /^sc-[a-zA-Z0-9]{6,}$/,         // styled-components: sc-dIJnzn
  /^css-[a-zA-Z0-9]{6,}$/,         // Emotion: css-1f2h3g4
  /^jsx-[0-9]+$/,                  // styled-jsx: jsx-123456
  /^makeStyles-[a-zA-Z]+-[0-9]+$/, // Material-UI: makeStyles-root-123
  /^[a-z]+-[A-Z][a-zA-Z0-9]{5,}$/, // Generic pattern: foo-AbCdEf123
  /^[a-zA-Z]{2,}-[a-z]{6,10}$/,    // styled-components variants
];

/**
 * Utility-first framework patterns
 */
const UTILITY_PATTERNS = [
  /^(p|m|w|h|text|bg|border|flex|grid|gap|space)-/, // Tailwind-like
  /^(hover|focus|active|group|peer):/,              // Pseudo-class utilities
  /^(sm|md|lg|xl|2xl):/,                            // Responsive utilities
];

/**
 * Known framework signatures
 */
const FRAMEWORK_SIGNATURES = {
  'styled-components': ['sc-', 'data-styled'],
  'emotion': ['css-', 'emotion-'],
  'tailwind': ['hover:', 'sm:', 'md:', 'lg:', 'xl:'],
  'material-ui': ['makeStyles-', 'MuiButton', 'Mui'],
  'chakra-ui': ['chakra-', 'css-'],
  'styled-jsx': ['jsx-'],
};

/**
 * Samples elements to analyze class name patterns
 */
function sampleClassNames(limit: number = 500): string[] {
  const classNames = new Set<string>();
  const elements = document.querySelectorAll('*');
  const sampleSize = Math.min(elements.length, limit);

  for (let i = 0; i < sampleSize; i++) {
    const element = elements[i];
    const classList = Array.from(element.classList);
    classList.forEach(className => {
      if (className && className.length > 2) {
        classNames.add(className);
      }
    });
  }

  return Array.from(classNames);
}

/**
 * Checks if class names match CSS-in-JS patterns
 */
function detectCSSInJS(classNames: string[]): { score: number; indicators: string[] } {
  let score = 0;
  const indicators: string[] = [];

  // Check for hashed class names
  const hashedClasses = classNames.filter(className =>
    CSS_IN_JS_PATTERNS.some(pattern => pattern.test(className))
  );

  if (hashedClasses.length > 0) {
    score += Math.min(hashedClasses.length / classNames.length, 0.5);
    indicators.push(`Found ${hashedClasses.length} hashed class names`);
  }

  // Check for data attributes common in CSS-in-JS
  const hasDataStyled = document.querySelector('[data-styled]') !== null;
  const hasDataEmotion = document.querySelector('[data-emotion]') !== null;

  if (hasDataStyled) {
    score += 0.2;
    indicators.push('Found data-styled attributes (styled-components)');
  }

  if (hasDataEmotion) {
    score += 0.2;
    indicators.push('Found data-emotion attributes (Emotion)');
  }

  // Check stylesheet count vs element count ratio
  const stylesheetCount = document.styleSheets.length;
  const elementCount = document.querySelectorAll('*').length;

  if (stylesheetCount < 5 && elementCount > 100) {
    score += 0.15;
    indicators.push('Low stylesheet count with many elements (suggests runtime CSS)');
  }

  // Check for injected <style> tags (CSS-in-JS often injects styles)
  const injectedStyles = document.querySelectorAll('style[data-styled], style[data-emotion], style[data-jss]');
  if (injectedStyles.length > 0) {
    score += 0.2;
    indicators.push(`Found ${injectedStyles.length} injected <style> tags`);
  }

  return { score, indicators };
}

/**
 * Checks if class names match utility-first patterns
 */
function detectUtilityFirst(classNames: string[]): { score: number; indicators: string[] } {
  let score = 0;
  const indicators: string[] = [];

  // Check for utility class patterns
  const utilityClasses = classNames.filter(className =>
    UTILITY_PATTERNS.some(pattern => pattern.test(className))
  );

  if (utilityClasses.length > 0) {
    score += Math.min(utilityClasses.length / classNames.length, 0.6);
    indicators.push(`Found ${utilityClasses.length} utility class names`);
  }

  // Check for Tailwind-specific patterns
  const hasTailwindClasses = classNames.some(className =>
    className.includes('hover:') || className.includes('focus:') ||
    className.includes('sm:') || className.includes('md:')
  );

  if (hasTailwindClasses) {
    score += 0.3;
    indicators.push('Found Tailwind-style responsive/state classes');
  }

  // Check for high class count per element (utility-first characteristic)
  const elements = document.querySelectorAll('*');
  let totalClasses = 0;
  let elementCount = 0;

  for (let i = 0; i < Math.min(elements.length, 100); i++) {
    const element = elements[i];
    totalClasses += element.classList.length;
    elementCount++;
  }

  const avgClassesPerElement = totalClasses / elementCount;
  if (avgClassesPerElement > 5) {
    score += 0.2;
    indicators.push(`High average classes per element (${avgClassesPerElement.toFixed(1)})`);
  }

  return { score, indicators };
}

/**
 * Detects framework based on signatures
 */
function detectFramework(classNames: string[]): string | undefined {
  for (const [framework, signatures] of Object.entries(FRAMEWORK_SIGNATURES)) {
    const matchCount = signatures.filter(sig =>
      classNames.some(className => className.includes(sig))
    ).length;

    if (matchCount >= 2 || (matchCount === 1 && signatures.length === 1)) {
      return framework;
    }
  }

  return undefined;
}

/**
 * Checks for traditional CSS patterns
 */
function detectTraditional(classNames: string[]): { score: number; indicators: string[] } {
  let score = 0;
  const indicators: string[] = [];

  // Check for BEM-like patterns (block__element--modifier)
  const bemClasses = classNames.filter(className =>
    className.includes('__') || className.includes('--')
  );

  if (bemClasses.length > 0) {
    score += Math.min(bemClasses.length / classNames.length, 0.4);
    indicators.push(`Found ${bemClasses.length} BEM-style class names`);
  }

  // Check for semantic class names (longer, descriptive)
  const semanticClasses = classNames.filter(className =>
    className.length > 10 &&
    !CSS_IN_JS_PATTERNS.some(pattern => pattern.test(className)) &&
    !UTILITY_PATTERNS.some(pattern => pattern.test(className))
  );

  if (semanticClasses.length > classNames.length * 0.3) {
    score += 0.3;
    indicators.push('Found many semantic class names');
  }

  // Check for external stylesheets
  const externalStylesheets = Array.from(document.styleSheets).filter(sheet =>
    sheet.href &&
    !sheet.href.includes('chrome-extension://') &&
    !sheet.href.includes('moz-extension://')
  );

  if (externalStylesheets.length > 2) {
    score += 0.2;
    indicators.push(`Found ${externalStylesheets.length} external stylesheets`);
  }

  return { score, indicators };
}

/**
 * Main function to detect CSS architecture
 */
export function detectCSSArchitecture(): CSSArchitectureInfo {
  // Sample class names from the page
  const classNames = sampleClassNames(500);

  if (classNames.length === 0) {
    return {
      architecture: 'traditional',
      confidence: 0.3,
      indicators: ['No class names found'],
      recommendation: 'Use computed styles for extraction'
    };
  }

  // Run detection for each architecture
  const cssInJS = detectCSSInJS(classNames);
  const utilityFirst = detectUtilityFirst(classNames);
  const traditional = detectTraditional(classNames);

  // Determine the dominant architecture
  const scores = {
    'css-in-js': cssInJS.score,
    'utility-first': utilityFirst.score,
    'traditional': traditional.score,
  };

  // Sort by score
  const sortedArchitectures = (Object.entries(scores) as [CSSArchitecture, number][])
    .sort((a, b) => b[1] - a[1]);

  const dominantArchitecture = sortedArchitectures[0][0];
  const dominantScore = sortedArchitectures[0][1];
  const secondScore = sortedArchitectures[1][1];

  // Check if it's mixed (multiple architectures with similar scores)
  const isMixed = secondScore > 0.3 && (dominantScore - secondScore) < 0.2;

  const architecture: CSSArchitecture = isMixed ? 'mixed' : dominantArchitecture;

  // Gather all indicators
  const allIndicators = [
    ...cssInJS.indicators,
    ...utilityFirst.indicators,
    ...traditional.indicators,
  ];

  // Detect framework
  const framework = detectFramework(classNames);

  // Generate recommendation
  let recommendation = '';
  if (architecture === 'css-in-js') {
    recommendation = 'Use getComputedStyle() exclusively. Class names are not semantic. ' +
                    'Identify components via semantic HTML, ARIA roles, and data attributes.';
  } else if (architecture === 'utility-first') {
    recommendation = 'Class names are utility classes, not semantic. ' +
                    'Use getComputedStyle() and identify components via structure and ARIA.';
  } else if (architecture === 'traditional') {
    recommendation = 'Can use CSS rules and class names for component identification. ' +
                    'getComputedStyle() is still recommended for accuracy.';
  } else {
    recommendation = 'Mixed architecture detected. Use getComputedStyle() for safety. ' +
                    'Combine class name analysis with semantic HTML detection.';
  }

  return {
    architecture,
    confidence: Math.min(dominantScore, 0.95),
    indicators: allIndicators,
    framework,
    recommendation,
  };
}

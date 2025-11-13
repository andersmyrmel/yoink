/**
 * Component-Specific Color Extractor
 *
 * Extracts colors used by specific component types (buttons, icons, navigation, etc.)
 * This is critical for CSS-in-JS sites where colors are applied via computed styles
 * rather than semantic class names.
 *
 * For each component type, we extract:
 * - Background colors
 * - Text colors
 * - Border colors
 * - Icon fill/stroke colors
 * - State colors (hover, focus, active)
 */

import { getCachedComputedStyle } from '../utils/domCache';
import { normalizeColor } from '../utils/styleHelpers';

/**
 * Color usage for a specific component variant
 */
export interface ComponentColorUsage {
  component: string;
  variant: string;
  count: number;
  colors: {
    background?: string;
    text?: string;
    border?: string;
    iconFill?: string;
    iconStroke?: string;
    hoverBackground?: string;
    hoverText?: string;
    hoverBorder?: string;
    focusBorder?: string;
    focusOutline?: string;
  };
  measurements?: {
    height?: number;
    minWidth?: number;
    padding?: string;
    borderRadius?: string;
    borderWidth?: string;
    fontSize?: string;
    fontWeight?: string;
  };
}

/**
 * Complete component-specific color extraction
 */
export interface ComponentSpecificColors {
  buttons: ComponentColorUsage[];
  navigation: ComponentColorUsage[];
  icons: ComponentColorUsage[];
  inputs: ComponentColorUsage[];
  cards: ComponentColorUsage[];
  allComponentColors: Map<string, number>; // All unique colors across components
}

/**
 * Identifies button elements using multiple strategies
 */
function identifyButtons(): Element[] {
  // Strategy 1: Semantic HTML
  const semanticButtons = Array.from(document.querySelectorAll('button'));

  // Strategy 2: ARIA roles
  const ariaButtons = Array.from(document.querySelectorAll('[role="button"]'));

  // Strategy 3: Data attributes
  const dataButtons = Array.from(document.querySelectorAll(
    '[data-testid*="button"], [data-test*="button"], [data-cy*="button"]'
  ));

  // Strategy 4: Input buttons
  const inputButtons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"]'));

  // Strategy 5: Links styled as buttons (must have button-like styling)
  const linkButtons = Array.from(document.querySelectorAll('a')).filter(link => {
    const styles = getCachedComputedStyle(link);
    const hasBg = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent';
    const hasBorder = parseFloat(styles.borderWidth) > 0;
    const hasPadding = parseFloat(styles.paddingLeft) >= 8 && parseFloat(styles.paddingRight) >= 8;
    const hasRadius = parseFloat(styles.borderRadius) >= 2;

    // Must have at least 2 button-like characteristics
    const buttonFeatures = [hasBg, hasBorder, hasPadding, hasRadius].filter(Boolean).length;
    return buttonFeatures >= 2;
  });

  // Combine and deduplicate
  const allButtons = new Set([
    ...semanticButtons,
    ...ariaButtons,
    ...dataButtons,
    ...inputButtons,
    ...linkButtons,
  ]);

  // Filter out navigation links and hidden elements
  return Array.from(allButtons).filter(btn => {
    // Skip if inside navigation (unless it has button role/tag)
    const isNav = btn.closest('nav, [role="navigation"]');
    if (isNav && btn.tagName !== 'BUTTON' && btn.getAttribute('role') !== 'button') {
      return false;
    }

    // Skip if hidden
    const styles = getCachedComputedStyle(btn);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }

    // Skip if too small (likely not a real button)
    const rect = btn.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 16) {
      return false;
    }

    return true;
  });
}

/**
 * Creates a visual signature for grouping similar components
 */
function createColorSignature(colors: ComponentColorUsage['colors']): string {
  const parts = [
    colors.background || 'none',
    colors.text || 'none',
    colors.border || 'none',
  ];
  return parts.join('|');
}

/**
 * Infers button variant from visual characteristics
 */
function inferButtonVariant(element: Element): string {
  const styles = getCachedComputedStyle(element);
  const bg = styles.backgroundColor;
  const border = styles.borderWidth;

  // Parse colors to detect characteristics
  const bgMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

  const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
  const hasBorder = parseFloat(border) > 0;

  // Ghost/outline buttons
  if (isTransparent) {
    if (hasBorder) {
      return 'outline';
    }
    return 'ghost';
  }

  // Analyze background color for variant
  if (bgMatch) {
    const r = parseInt(bgMatch[1]);
    const g = parseInt(bgMatch[2]);
    const b = parseInt(bgMatch[3]);

    const brightness = (r + g + b) / 3;
    const isReddish = r > g + 30 && r > b + 30;
    const isGreenish = g > r + 30 && g > b + 30;
    const isBlueish = b > r + 20 && b > g + 20;
    const isPurplish = r > 100 && b > 100 && g < r - 30;

    if (isReddish && r > 150) return 'danger';
    if (isGreenish && g > 150) return 'success';
    if (isBlueish || isPurplish) return 'primary';

    // Grayscale buttons
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    if (saturation < 30) {
      if (brightness > 180) return 'secondary';
      if (brightness < 80) return 'dark';
      return 'default';
    }
  }

  return 'default';
}

/**
 * Extracts colors from button elements
 */
function extractButtonColors(buttons: Element[]): ComponentColorUsage[] {
  const buttonVariants = new Map<string, ComponentColorUsage>();

  for (const button of buttons) {
    const styles = getCachedComputedStyle(button);
    const rect = button.getBoundingClientRect();

    // Extract all color properties
    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    // Extract icon colors if button contains SVG
    const svg = button.querySelector('svg');
    if (svg) {
      const svgStyles = getCachedComputedStyle(svg);
      if (svgStyles.fill && svgStyles.fill !== 'none') {
        colors.iconFill = normalizeColor(svgStyles.fill);
      }
      if (svgStyles.stroke && svgStyles.stroke !== 'none') {
        colors.iconStroke = normalizeColor(svgStyles.stroke);
      }
    }

    // Extract measurements - USE ACTUAL RENDERED VALUES
    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      minWidth: rect.width > 0 ? Math.round(rect.width) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
    };

    // Try to extract hover state from CSS rules
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText) {
              // Check if this rule matches our button
              try {
                if (button.matches(rule.selectorText.replace(/:hover.*/, ''))) {
                  if (rule.selectorText.includes(':hover')) {
                    if (rule.style.backgroundColor) {
                      colors.hoverBackground = normalizeColor(rule.style.backgroundColor);
                    }
                    if (rule.style.color) {
                      colors.hoverText = normalizeColor(rule.style.color);
                    }
                    if (rule.style.borderColor) {
                      colors.hoverBorder = normalizeColor(rule.style.borderColor);
                    }
                  }
                  if (rule.selectorText.includes(':focus')) {
                    if (rule.style.borderColor) {
                      colors.focusBorder = normalizeColor(rule.style.borderColor);
                    }
                    if (rule.style.outline) {
                      colors.focusOutline = rule.style.outline;
                    }
                  }
                }
              } catch (e) {
                // Selector matching failed, skip
              }
            }
          }
        } catch (e) {
          // CORS error, skip this sheet
        }
      }
    } catch (e) {
      // Error accessing stylesheets
    }

    // Infer variant
    const variant = inferButtonVariant(button);

    // Create signature for grouping
    const signature = `${variant}|${createColorSignature(colors)}`;

    if (buttonVariants.has(signature)) {
      const existing = buttonVariants.get(signature)!;
      existing.count++;
    } else {
      buttonVariants.set(signature, {
        component: 'button',
        variant,
        count: 1,
        colors,
        measurements,
      });
    }
  }

  // Return sorted by frequency
  return Array.from(buttonVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 button variants
}

/**
 * Identifies navigation elements
 */
function identifyNavigation(): Element[] {
  // Strategy 1: Semantic HTML
  const navLinks = Array.from(document.querySelectorAll('nav a, [role="navigation"] a'));

  // Strategy 2: Data attributes
  const dataNavItems = Array.from(document.querySelectorAll(
    '[data-nav], [data-navigation], [data-sidebar-section-type]'
  ));

  // Strategy 3: Common navigation patterns
  const sidebarItems = Array.from(document.querySelectorAll(
    'aside a, [class*="sidebar"] a, [class*="sidenav"] a'
  ));

  const allNav = new Set([...navLinks, ...dataNavItems, ...sidebarItems]);

  return Array.from(allNav).filter(item => {
    const styles = getCachedComputedStyle(item);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
    const rect = item.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return false;
    }
    return true;
  });
}

/**
 * Extracts colors from navigation elements
 */
function extractNavigationColors(navItems: Element[]): ComponentColorUsage[] {
  const navVariants = new Map<string, ComponentColorUsage>();

  for (const item of navItems) {
    const styles = getCachedComputedStyle(item);
    const rect = item.getBoundingClientRect();

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    // Check for icon
    const svg = item.querySelector('svg');
    if (svg) {
      const svgStyles = getCachedComputedStyle(svg);
      if (svgStyles.fill && svgStyles.fill !== 'none') {
        colors.iconFill = normalizeColor(svgStyles.fill);
      }
    }

    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
    };

    const signature = createColorSignature(colors);

    if (navVariants.has(signature)) {
      const existing = navVariants.get(signature)!;
      existing.count++;
    } else {
      navVariants.set(signature, {
        component: 'navigation',
        variant: 'nav-item',
        count: 1,
        colors,
        measurements,
      });
    }
  }

  return Array.from(navVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Identifies icon elements
 */
function identifyIcons(): Element[] {
  // Strategy 1: SVG elements
  const svgs = Array.from(document.querySelectorAll('svg'));

  // Strategy 2: Icon fonts
  const iconFonts = Array.from(document.querySelectorAll(
    '[class*="icon"], [class*="Icon"], i, [data-icon]'
  ));

  // Strategy 3: ARIA
  const ariaIcons = Array.from(document.querySelectorAll('[role="img"]'));

  const allIcons = new Set([...svgs, ...iconFonts, ...ariaIcons]);

  return Array.from(allIcons).filter(icon => {
    const styles = getCachedComputedStyle(icon);
    if (styles.display === 'none' || styles.visibility === 'hidden') {
      return false;
    }
    const rect = icon.getBoundingClientRect();
    // Icons are typically small
    if (rect.width < 8 || rect.height < 8 || rect.width > 100 || rect.height > 100) {
      return false;
    }
    return true;
  });
}

/**
 * Extracts colors from icon elements
 */
function extractIconColors(icons: Element[]): ComponentColorUsage[] {
  const iconVariants = new Map<string, ComponentColorUsage>();

  for (const icon of icons) {
    const styles = getCachedComputedStyle(icon);

    const colors: ComponentColorUsage['colors'] = {};

    if (icon.tagName.toLowerCase() === 'svg') {
      // SVG icon
      if (styles.fill && styles.fill !== 'none') {
        colors.iconFill = normalizeColor(styles.fill);
      }
      if (styles.stroke && styles.stroke !== 'none') {
        colors.iconStroke = normalizeColor(styles.stroke);
      }

      // Also check path elements
      const paths = icon.querySelectorAll('path');
      paths.forEach(path => {
        const pathStyles = getCachedComputedStyle(path);
        if (pathStyles.fill && pathStyles.fill !== 'none' && !colors.iconFill) {
          colors.iconFill = normalizeColor(pathStyles.fill);
        }
        if (pathStyles.stroke && pathStyles.stroke !== 'none' && !colors.iconStroke) {
          colors.iconStroke = normalizeColor(pathStyles.stroke);
        }
      });
    } else {
      // Icon font
      colors.text = normalizeColor(styles.color);
    }

    const signature = createColorSignature(colors);

    if (iconVariants.has(signature)) {
      const existing = iconVariants.get(signature)!;
      existing.count++;
    } else {
      iconVariants.set(signature, {
        component: 'icon',
        variant: 'icon',
        count: 1,
        colors,
      });
    }
  }

  return Array.from(iconVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Extracts colors from input elements
 */
function extractInputColors(): ComponentColorUsage[] {
  const inputs = Array.from(document.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea, select'));

  const inputVariants = new Map<string, ComponentColorUsage>();

  for (const input of inputs) {
    const styles = getCachedComputedStyle(input);
    const rect = input.getBoundingClientRect();

    if (styles.display === 'none' || styles.visibility === 'hidden') continue;
    if (rect.width < 20 || rect.height < 16) continue;

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      text: normalizeColor(styles.color),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    const measurements: ComponentColorUsage['measurements'] = {
      height: rect.height > 0 ? Math.round(rect.height) : undefined,
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
      fontSize: styles.fontSize,
    };

    const signature = createColorSignature(colors);

    if (inputVariants.has(signature)) {
      const existing = inputVariants.get(signature)!;
      existing.count++;
    } else {
      inputVariants.set(signature, {
        component: 'input',
        variant: 'input',
        count: 1,
        colors,
        measurements,
      });
    }
  }

  return Array.from(inputVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Extracts colors from card elements
 */
function extractCardColors(): ComponentColorUsage[] {
  const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], article'));

  const cardVariants = new Map<string, ComponentColorUsage>();

  for (const card of cards) {
    const styles = getCachedComputedStyle(card);
    const rect = card.getBoundingClientRect();

    if (styles.display === 'none' || styles.visibility === 'hidden') continue;
    // Cards are typically larger
    if (rect.width < 100 || rect.height < 50) continue;

    const colors: ComponentColorUsage['colors'] = {
      background: normalizeColor(styles.backgroundColor),
      border: styles.borderWidth !== '0px' ? normalizeColor(styles.borderColor) : undefined,
    };

    const measurements: ComponentColorUsage['measurements'] = {
      padding: styles.padding,
      borderRadius: styles.borderRadius !== '0px' ? styles.borderRadius : undefined,
      borderWidth: styles.borderWidth !== '0px' ? styles.borderWidth : undefined,
    };

    const signature = createColorSignature(colors);

    if (cardVariants.has(signature)) {
      const existing = cardVariants.get(signature)!;
      existing.count++;
    } else {
      cardVariants.set(signature, {
        component: 'card',
        variant: 'card',
        count: 1,
        colors,
        measurements,
      });
    }
  }

  return Array.from(cardVariants.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Main function to extract component-specific colors
 */
export function extractComponentSpecificColors(): ComponentSpecificColors {
  // Identify and extract colors from each component type
  const buttons = identifyButtons();
  const buttonColors = extractButtonColors(buttons);

  const navigation = identifyNavigation();
  const navigationColors = extractNavigationColors(navigation);

  const icons = identifyIcons();
  const iconColors = extractIconColors(icons);

  const inputColors = extractInputColors();
  const cardColors = extractCardColors();

  // Collect all unique colors across all components
  const allColors = new Map<string, number>();

  const addColors = (componentColors: ComponentColorUsage[]) => {
    componentColors.forEach(comp => {
      Object.values(comp.colors).forEach(color => {
        if (color && color !== 'none' && color !== 'rgba(0, 0, 0, 0)') {
          allColors.set(color, (allColors.get(color) || 0) + comp.count);
        }
      });
    });
  };

  addColors(buttonColors);
  addColors(navigationColors);
  addColors(iconColors);
  addColors(inputColors);
  addColors(cardColors);

  return {
    buttons: buttonColors,
    navigation: navigationColors,
    icons: iconColors,
    inputs: inputColors,
    cards: cardColors,
    allComponentColors: allColors,
  };
}

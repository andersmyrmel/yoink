/**
 * Component Extraction Orchestrator
 *
 * This module serves as the main entry point for extracting all UI components
 * from the DOM. It aggregates extractors from specialized modules and provides
 * a unified interface for component detection and extraction.
 */

import { ComponentExtraction } from '../../types/extraction';
import { normalizeAllColors } from '../../utils/componentHelpers';

// Import form component extractors
import {
  extractInputs,
  extractDropdowns,
  extractSearchBars,
  extractToggles,
  extractDatePickers,
  extractColorPickers,
  extractRichTextEditors,
  extractSliders,
  extractComboboxes
} from './formComponents';

// Import navigation component extractors
import {
  extractNavigation,
  extractBreadcrumbs,
  extractPagination,
  extractTabs
} from './navigationComponents';

// Import feedback component extractors
import {
  extractAlerts,
  extractModals,
  extractTooltips,
  extractBadges,
  extractSkeletonStates,
  extractEmptyStates
} from './feedbackComponents';

// Import interaction component extractors
import {
  extractButtons,
  extractAccordions,
  extractProgress
} from './interactionComponents';

// Import content component extractors
import {
  extractCards,
  extractHeadings,
  extractTables,
  extractAvatars,
  extractDividers
} from './contentComponents';

// Import layout component extractors
import {
  extractSidebars,
  extractTopbars,
  extractNavigationMenus
} from './layoutComponents';

/**
 * Extracts all UI components from the current page.
 *
 * This function orchestrates the extraction of various UI component types from the DOM,
 * including interactive elements (buttons, inputs, toggles), navigation components
 * (tabs, breadcrumbs, pagination), feedback components (alerts, modals, tooltips),
 * and content components (cards, tables, headings).
 *
 * Each extractor searches for elements matching specific selectors and patterns,
 * analyzes their computed styles, and groups similar components together by visual
 * characteristics. The extraction process:
 *
 * 1. Identifies component elements using CSS selectors, ARIA roles, and class patterns
 * 2. Extracts computed styles including colors, spacing, typography, and borders
 * 3. Captures interactive state styles (hover, focus, active, disabled)
 * 4. Groups visually similar components to reduce noise and duplication
 * 5. Returns the most frequently occurring variants for each component type
 *
 * @returns {ComponentExtraction} A complete snapshot of all UI components found on the page,
 * organized by component type. Each component includes HTML markup, CSS classes, computed
 * styles, variant classification, usage count, and interactive state styles.
 *
 * @example
 * ```typescript
 * const components = extractComponents();
 * console.log(`Found ${components.buttons.length} button variants`);
 * console.log(`Primary button styles:`, components.buttons[0].styles);
 * ```
 *
 * @remarks
 * - Components are sorted by frequency (most common first)
 * - Each component type has a maximum number of variants returned
 * - Interactive state styles are captured when available via CSS rules
 * - Extraction respects ARIA attributes for semantic understanding
 * - Custom component implementations are detected alongside native elements
 */
export function extractComponents(): ComponentExtraction {
  const components = {
    // Interactive form components
    buttons: extractButtons(),
    inputs: extractInputs(),
    dropdowns: extractDropdowns(),
    searchBars: extractSearchBars(),
    toggles: extractToggles(),
    datePickers: extractDatePickers(),
    colorPickers: extractColorPickers(),
    richTextEditors: extractRichTextEditors(),
    sliders: extractSliders(),
    comboboxes: extractComboboxes(),

    // Navigation components
    navigation: extractNavigation(),
    breadcrumbs: extractBreadcrumbs(),
    pagination: extractPagination(),
    tabs: extractTabs(),

    // Feedback & notification components
    alerts: extractAlerts(),
    modals: extractModals(),
    tooltips: extractTooltips(),
    badges: extractBadges(),
    skeletons: extractSkeletonStates(),
    emptyStates: extractEmptyStates(),

    // Content & layout components
    cards: extractCards(),
    headings: extractHeadings(),
    tables: extractTables(),
    avatars: extractAvatars(),
    accordions: extractAccordions(),
    progress: extractProgress(),
    dividers: extractDividers(),

    // High-level layout components
    sidebars: extractSidebars(),
    topbars: extractTopbars(),
    navigationMenus: extractNavigationMenus()
  };

  // Normalize all colors in all components to RGB format
  return normalizeAllColors(components) as ComponentExtraction;
}

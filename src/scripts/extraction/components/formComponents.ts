/**
 * Form Component Extractors
 *
 * This module contains functions for extracting various form components from the DOM,
 * including inputs, dropdowns, search bars, toggles, date pickers, color pickers,
 * rich text editors, sliders, and comboboxes.
 */

import {
  ComponentVariant,
  InputComponent,
  ComponentStyles
} from '../../types/extraction';
import { getCleanHTML, getClassName } from '../../utils/styleHelpers';
import { extractStateStyles, createStyleSignature } from '../../utils/componentHelpers';

/**
 * Infers input variant from type and classes.
 *
 * Analyzes the input element's type attribute and class names to determine
 * its semantic variant (e.g., checkbox, radio, select, textarea, search, text-error, etc.).
 *
 * @param input - The HTML input element to analyze
 * @param type - The input type or tag name
 * @returns The inferred variant name as a string
 *
 * @example
 * inferInputVariant(inputElement, 'text');
 * // Returns: "text" or "text-error" if error class is present
 */
export function inferInputVariant(input: HTMLElement, type: string): string {
  const className = getClassName(input).toLowerCase();

  // Handle specific input types
  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio';
  if (type === 'select' || input.tagName.toLowerCase() === 'select') return 'select';
  if (type === 'textarea' || input.tagName.toLowerCase() === 'textarea') return 'textarea';
  if (type === 'search') return 'search';
  if (type === 'range') return 'range';
  if (type === 'number') return 'number';
  if (type === 'email') return 'email';
  if (type === 'password') return 'password';
  if (type === 'date' || type === 'datetime-local') return 'date';
  if (type === 'tel') return 'tel';
  if (type === 'url') return 'url';
  if (type === 'file') return 'file';

  // Check for error/success states
  if (className.includes('error') || className.includes('invalid')) return 'text-error';
  if (className.includes('success') || className.includes('valid')) return 'text-success';

  return 'text';
}

/**
 * Extracts form input components with states and types.
 *
 * Searches for all input, textarea, select, and custom input implementations
 * (contenteditable, role="textbox", etc.) and extracts their styles, types, and
 * interactive states. Groups similar inputs together and returns the most common
 * variants.
 *
 * @returns Array of InputComponent objects sorted by usage frequency (top 5)
 *
 * @remarks
 * - Excludes hidden, submit, and button type inputs
 * - Captures both native and custom input implementations
 * - Includes state styles (hover, focus, disabled)
 * - Deduplicates similar inputs using style signatures
 *
 * @example
 * const inputs = extractInputs();
 * // Returns: [{ html: '<input...>', type: 'text', variant: 'text', count: 15, ... }, ...]
 */
export function extractInputs(): InputComponent[] {
  const inputs: InputComponent[] = [];
  const seen = new Map<string, InputComponent>();

  // Expanded to catch custom input implementations (contenteditable, role="textbox", etc.)
  const inputSelectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"]';
  const elements = document.querySelectorAll(inputSelectors);

  elements.forEach(input => {
    const styles = getComputedStyle(input);
    const el = input as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Skip elements that are clearly not inputs (divs, labels, spans, etc.)
    // Only include actual input elements, textareas, selects, and semantic input roles
    const isActualInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    const hasInputRole = el.hasAttribute('role') && ['textbox', 'searchbox', 'combobox'].includes(el.getAttribute('role') || '');
    const isContentEditable = el.getAttribute('contenteditable') === 'true';

    if (!isActualInput && !hasInputRole && !isContentEditable) {
      return; // Skip non-input elements
    }

    const inputType = (input as HTMLInputElement).type || tagName;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height,
        width: styles.width
      };

      const variant: InputComponent = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        type: inputType,
        variant: inferInputVariant(el, inputType) as 'checkbox' | 'radio' | 'select' | 'textarea' | 'search' | 'text-error' | 'text-success' | 'text',
        count: 1,
        states: extractStateStyles(el)
      };

      inputs.push(variant);
      seen.set(signature, variant);
    }
  });

  return inputs.sort((a, b) => b.count - a.count).slice(0, 5);
}

/**
 * Extracts dropdown/menu components.
 *
 * Searches for dropdown menus, listboxes, select elements, and custom dropdown
 * implementations. Captures their styles including shadows, borders, and positioning.
 * Groups similar dropdowns together and returns the most common variants.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 10)
 *
 * @remarks
 * - Captures both native selects and custom dropdown implementations
 * - Includes role-based components (menu, listbox, select)
 * - Tracks z-index and positioning for overlay management
 * - Expanded selectors to catch more dropdown patterns
 *
 * @example
 * const dropdowns = extractDropdowns();
 * // Returns: [{ html: '<div role="menu">...</div>', variant: 'dropdown', count: 8, ... }, ...]
 */
export function extractDropdowns(): ComponentVariant[] {
  const dropdowns: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  // Expanded to catch more dropdown patterns and custom implementations
  const dropdownSelectors = '[role="menu"], [role="listbox"], [role="select"], [class*="dropdown"], [class*="menu"][class*="list"], [class*="popover"], [class*="select"]:not(select), [data-dropdown], [data-menu]';
  const elements = document.querySelectorAll(dropdownSelectors);

  elements.forEach(dropdown => {
    const styles = getComputedStyle(dropdown);
    const el = dropdown as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        boxShadow: styles.boxShadow,
        minWidth: styles.minWidth,
        zIndex: styles.zIndex
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'dropdown',
        count: 1
      };

      dropdowns.push(variant);
      seen.set(signature, variant);
    }
  });

  return dropdowns.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Extracts search bar components.
 *
 * Searches for search inputs and custom search implementations, capturing their
 * styles and interactive states. Groups similar search bars together and returns
 * the most common variants.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures native search inputs and custom implementations
 * - Includes role-based search components
 * - Tracks interactive states (hover, focus, active)
 * - Useful for identifying search UI patterns
 *
 * @example
 * const searchBars = extractSearchBars();
 * // Returns: [{ html: '<input type="search"...>', variant: 'search', count: 2, ... }, ...]
 */
export function extractSearchBars(): ComponentVariant[] {
  const searches: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const searchSelectors = 'input[type="search"], [role="search"], [class*="search"] input';
  const elements = document.querySelectorAll(searchSelectors);

  elements.forEach(search => {
    const styles = getComputedStyle(search);
    const el = search as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height,
        width: styles.width
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'search',
        count: 1,
        states: extractStateStyles(el)
      };

      searches.push(variant);
      seen.set(signature, variant);
    }
  });

  return searches.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts toggle switch components.
 *
 * Searches for toggle switches, switch-styled checkboxes, and custom toggle
 * implementations. Captures their styles and interactive states.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures role="switch" elements
 * - Includes checkbox inputs styled as toggles
 * - Tracks interactive states for on/off styling
 * - Useful for identifying toggle patterns in design systems
 *
 * @example
 * const toggles = extractToggles();
 * // Returns: [{ html: '<input role="switch"...>', variant: 'toggle', count: 4, ... }, ...]
 */
export function extractToggles(): ComponentVariant[] {
  const toggles: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const toggleSelectors = '[role="switch"], input[type="checkbox"][class*="toggle"], input[type="checkbox"][class*="switch"], [class*="toggle"]:not(button)';
  const elements = document.querySelectorAll(toggleSelectors);

  elements.forEach(toggle => {
    const styles = getComputedStyle(toggle);
    const el = toggle as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        width: styles.width,
        height: styles.height
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'toggle',
        count: 1,
        states: extractStateStyles(el)
      };

      toggles.push(variant);
      seen.set(signature, variant);
    }
  });

  return toggles.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts date picker components.
 *
 * Searches for date and datetime inputs, calendar components, and custom date
 * picker implementations. Captures their styles and appearance patterns.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures native date/datetime-local inputs
 * - Includes custom calendar and date picker implementations
 * - Tracks dialog-based date pickers via aria-label
 * - Useful for identifying date selection patterns
 *
 * @example
 * const datePickers = extractDatePickers();
 * // Returns: [{ html: '<input type="date"...>', variant: 'date-picker', count: 3, ... }, ...]
 */
export function extractDatePickers(): ComponentVariant[] {
  const datePickers: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const dateSelectors = 'input[type="date"], input[type="datetime-local"], [class*="date-picker"], [class*="calendar"], [role="dialog"][aria-label*="date"]';
  const elements = document.querySelectorAll(dateSelectors);

  elements.forEach(picker => {
    const styles = getComputedStyle(picker);
    const el = picker as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'date-picker',
        count: 1
      };

      datePickers.push(variant);
      seen.set(signature, variant);
    }
  });

  return datePickers.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts color picker components.
 *
 * Searches for color inputs and custom color picker implementations.
 * Captures their styles and dimensions.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures native color inputs
 * - Includes custom color picker implementations
 * - Tracks dimensions and border styling
 * - Useful for identifying color selection patterns
 *
 * @example
 * const colorPickers = extractColorPickers();
 * // Returns: [{ html: '<input type="color"...>', variant: 'color-picker', count: 1, ... }, ...]
 */
export function extractColorPickers(): ComponentVariant[] {
  const colorPickers: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const colorSelectors = 'input[type="color"], [class*="color-picker"], [class*="colour-picker"]';
  const elements = document.querySelectorAll(colorSelectors);

  elements.forEach(picker => {
    const styles = getComputedStyle(picker);
    const el = picker as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        width: styles.width,
        height: styles.height,
        border: styles.border,
        borderRadius: styles.borderRadius
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'color-picker',
        count: 1
      };

      colorPickers.push(variant);
      seen.set(signature, variant);
    }
  });

  return colorPickers.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts rich text editor components.
 *
 * Searches for contenteditable elements, custom editors, and WYSIWYG implementations.
 * Filters by minimum height (50px) to exclude inline editable text.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures contenteditable="true" elements
 * - Includes custom editor implementations by class name
 * - Filters by minimum height to focus on actual editors
 * - Tracks multiline text input styling patterns
 *
 * @example
 * const editors = extractRichTextEditors();
 * // Returns: [{ html: '<div contenteditable="true">...</div>', variant: 'rich-text-editor', ... }, ...]
 */
export function extractRichTextEditors(): ComponentVariant[] {
  const editors: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const editorSelectors = '[contenteditable="true"], [class*="editor"], [class*="rich-text"], [role="textbox"][aria-multiline="true"]';
  const elements = document.querySelectorAll(editorSelectors);

  elements.forEach(editor => {
    const styles = getComputedStyle(editor);
    const el = editor as HTMLElement;

    // Should be reasonably sized
    const rect = el.getBoundingClientRect();
    if (rect.height < 50) return;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        height: styles.height
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'rich-text-editor',
        count: 1
      };

      editors.push(variant);
      seen.set(signature, variant);
    }
  });

  return editors.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts slider/range input components.
 *
 * Searches for range inputs, slider role elements, and custom slider implementations.
 * Captures their styles and dimensions.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures native range inputs
 * - Includes role="slider" elements
 * - Tracks slider dimensions and background styling
 * - Useful for identifying range input patterns
 *
 * @example
 * const sliders = extractSliders();
 * // Returns: [{ html: '<input type="range"...>', variant: 'slider', count: 2, ... }, ...]
 */
export function extractSliders(): ComponentVariant[] {
  const sliders: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const sliderSelectors = 'input[type="range"], [role="slider"], [class*="slider"]';
  const elements = document.querySelectorAll(sliderSelectors);

  elements.forEach(slider => {
    const styles = getComputedStyle(slider);
    const el = slider as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        width: styles.width,
        height: styles.height,
        background: styles.backgroundColor
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'slider',
        count: 1
      };

      sliders.push(variant);
      seen.set(signature, variant);
    }
  });

  return sliders.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Extracts advanced select/combobox components.
 *
 * Searches for combobox role elements, autocomplete inputs, and typeahead
 * implementations. Captures their styles and interactive states.
 *
 * @returns Array of ComponentVariant objects sorted by usage frequency (top 3)
 *
 * @remarks
 * - Captures role="combobox" elements
 * - Includes autocomplete and typeahead implementations
 * - Tracks interactive states for dropdown integration
 * - Useful for identifying advanced select patterns
 *
 * @example
 * const comboboxes = extractComboboxes();
 * // Returns: [{ html: '<div role="combobox">...</div>', variant: 'combobox', count: 3, ... }, ...]
 */
export function extractComboboxes(): ComponentVariant[] {
  const comboboxes: ComponentVariant[] = [];
  const seen = new Map<string, ComponentVariant>();

  const comboSelectors = '[role="combobox"], [class*="combobox"], [class*="autocomplete"], [class*="typeahead"]';
  const elements = document.querySelectorAll(comboSelectors);

  elements.forEach(combo => {
    const styles = getComputedStyle(combo);
    const el = combo as HTMLElement;

    const signature = createStyleSignature(el);

    if (seen.has(signature)) {
      const existing = seen.get(signature)!;
      existing.count++;
    } else {
      const componentStyles: ComponentStyles = {
        background: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        height: styles.height
      };

      const variant: ComponentVariant = {
        html: getCleanHTML(el),
        classes: el.className || '',
        styles: componentStyles,
        variant: 'combobox',
        count: 1,
        states: extractStateStyles(el)
      };

      comboboxes.push(variant);
      seen.set(signature, variant);
    }
  });

  return comboboxes.sort((a, b) => b.count - a.count).slice(0, 3);
}

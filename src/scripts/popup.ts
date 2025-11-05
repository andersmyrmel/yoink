/**
 * Yoink Popup Script
 *
 * Handles the popup UI and markdown generation
 */

const scanButton = document.getElementById('scanBtn') as HTMLButtonElement;
const copyButton = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadButton = document.getElementById('downloadBtn') as HTMLButtonElement;
const includeComponentsCheckbox = document.getElementById('includeComponentsCheckbox') as HTMLInputElement;
const loadingState = document.getElementById('loadingState') as HTMLDivElement;
const resultsSection = document.getElementById('resultsSection') as HTMLDivElement;
const errorState = document.getElementById('errorState') as HTMLDivElement;
const markdownPreview = document.getElementById('markdownPreview') as HTMLDivElement;
const successMessage = document.getElementById('successMessage') as HTMLDivElement;

let currentMarkdown = '';

// Scan button click handler
scanButton.addEventListener('click', async () => {
  showLoading();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab found');
    }

    const includeComponents = includeComponentsCheckbox.checked;

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'scanStyles', includeComponents },
      (response: { success: boolean; data?: any; error?: string }) => {
        hideLoading();

        if (chrome.runtime.lastError) {
          showError('Extension not loaded on this page. Try refreshing the page.');
          return;
        }

        if (response.success && response.data) {
          const markdown = generateMarkdown(response.data);
          displayMarkdown(markdown);
        } else {
          showError(response.error || 'Failed to extract styles');
        }
      }
    );
  } catch (error) {
    hideLoading();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showError(errorMessage);
  }
});

// Copy button click handler
copyButton.addEventListener('click', () => {
  navigator.clipboard.writeText(currentMarkdown).then(() => {
    showSuccess('Copied to clipboard!');
  });
});

// Download button click handler
downloadButton.addEventListener('click', () => {
  const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'design-system.md';
  a.click();
  URL.revokeObjectURL(url);
  showSuccess('Downloaded!');
});

/**
 * Shows loading state
 */
function showLoading(): void {
  loadingState.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  errorState.classList.add('hidden');
  scanButton.disabled = true;
}

/**
 * Hides loading state
 */
function hideLoading(): void {
  loadingState.classList.add('hidden');
  scanButton.disabled = false;
}

/**
 * Displays markdown output
 */
function displayMarkdown(markdown: string): void {
  currentMarkdown = markdown;
  markdownPreview.textContent = markdown;
  resultsSection.classList.remove('hidden');
  errorState.classList.add('hidden');
}

/**
 * Shows error message
 */
function showError(message: string): void {
  errorState.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  const errorDetail = errorState.querySelector('.error-detail') as HTMLElement;
  if (errorDetail) {
    errorDetail.textContent = message;
  }
}

/**
 * Shows success status
 */
function showSuccess(message: string): void {
  successMessage.textContent = message;
  successMessage.classList.remove('hidden');
  setTimeout(() => {
    successMessage.classList.add('hidden');
  }, 2000);
}

/**
 * Generates complete markdown documentation
 */
function generateMarkdown(styles: any): string {
  const now = new Date().toLocaleDateString();

  let markdown = `# Design System Extraction\n\n`;
  markdown += `**Extracted:** ${now}\n\n`;
  markdown += `---\n\n`;

  // Component patterns section (if available)
  if (styles.components) {
    markdown += generateComponentsSection(styles.components);
  }

  // Typography context section (if available)
  if (styles.typographyContext) {
    markdown += generateTypographyContextSection(styles.typographyContext);
  }

  markdown += generateColorSection(styles);

  // Color usage context section (if available)
  if (styles.colorContext) {
    markdown += generateColorContextSection(styles.colorContext);
  }

  // Layout patterns section (if available)
  if (styles.layoutPatterns) {
    markdown += generateLayoutPatternsSection(styles.layoutPatterns);
  }

  // Border radius is already shown in CSS Variables section, no need to duplicate
  // if (styles.borderRadius.length > 0) {
  //   markdown += generateBorderRadiusSection(styles.borderRadius);
  // }

  if (styles.fonts.length > 0) {
    markdown += generateFontsSection(styles.fonts);
  }

  if (styles.shadows.length > 0) {
    markdown += generateShadowsSection(styles.shadows);
  }

  markdown += `\n---\n\n## 📋 Usage Notes\n\n`;
  markdown += `1. Copy CSS variables from sections above into your design system\n`;
  markdown += `2. Review and consolidate duplicate semantic names\n`;
  markdown += `3. Verify theme variants work correctly in light/dark modes\n`;
  markdown += `4. Integrate into your design system or component library\n`;

  return markdown;
}

/**
 * Generates color section with CSS variables
 */
function generateColorSection(styles: any): string {
  let section = `## 🎨 Colors\n\n`;

  const groupedVars = groupCSSVariablesByPrefix(styles.cssVariables);
  const colorMap = buildColorToVariablesMap(styles.cssVariables);

  const displayOrder = ['brand', 'sidebar', 'chart', 'semantic', 'other'];

  for (const prefix of displayOrder) {
    const vars = groupedVars[prefix as any];
    if (vars && vars.length > 0) {
      section += generatePrefixSection(prefix, vars, styles, colorMap);
    }
  }

  // Computed colors section
  const computedColors = findUnmappedColors(styles);
  if (computedColors.length > 0) {
    section += `### 🎯 Computed Values (hardcoded, not using CSS variables)\n\n`;
    section += `_These colors are hardcoded. Consider refactoring to use CSS variables._\n\n`;

    computedColors.forEach(({ color, usage }) => {
      section += `- \`${color}\` - Used in ${usage} element${usage !== 1 ? 's' : ''}\n`;
    });
    section += `\n`;
  }

  // Tailwind section (collapsed)
  if (groupedVars.tailwind && groupedVars.tailwind.length > 0) {
    section += `<details>\n`;
    section += `<summary>📦 Tailwind Default Palette (${groupedVars.tailwind.length} colors - click to expand)</summary>\n\n`;

    groupedVars.tailwind.forEach(({ name, themes }) => {
      const cleanName = name.replace('--', '');
      const value = themes.light || themes[Object.keys(themes)[0]];
      section += `- **${cleanName}**: \`${value}\`\n`;
    });

    section += `\n</details>\n\n`;
  }

  // Radius section
  if (groupedVars.radius && groupedVars.radius.length > 0) {
    section += `## 🔲 Border Radius\n\n`;

    groupedVars.radius.forEach(({ name, themes }) => {
      const cleanName = name.replace('--', '');
      const value = themes.light || themes[Object.keys(themes)[0]];
      section += `- **${cleanName}**: \`${value}\`\n`;
    });

    section += `\n`;
  }

  return section;
}

/**
 * Groups CSS variables by prefix pattern
 */
function groupCSSVariablesByPrefix(cssVars: any): any {
  const groups: any = {
    brand: [],
    sidebar: [],
    chart: [],
    semantic: [],
    radius: [],
    tailwind: [],
    other: []
  };

  for (const [varName, themes] of Object.entries(cssVars || {})) {
    const cleanName = varName.replace('--', '');
    const lower = cleanName.toLowerCase();

    // Tailwind colors
    if (lower.startsWith('color-') || lower.startsWith('tw-')) {
      groups.tailwind!.push({ name: varName, themes });
      continue;
    }

    // Radius variables
    if (lower.includes('radius') || lower.includes('rounded')) {
      groups.radius!.push({ name: varName, themes });
      continue;
    }

    // Categorize by prefix
    if (lower.startsWith('medical-') || lower.startsWith('brand-') || lower.startsWith('company-')) {
      groups.brand!.push({ name: varName, themes });
    } else if (lower.startsWith('sidebar-')) {
      groups.sidebar!.push({ name: varName, themes });
    } else if (lower.startsWith('chart-') || lower.startsWith('graph-') || lower.startsWith('data-')) {
      groups.chart!.push({ name: varName, themes });
    } else if (['background', 'foreground', 'primary', 'secondary', 'accent', 'muted', 'input', 'ring', 'destructive', 'card', 'popover'].some(s => lower.includes(s))) {
      groups.semantic!.push({ name: varName, themes });
    } else if (lower === 'border' || (lower.startsWith('border-') && !lower.includes('radius'))) {
      groups.semantic!.push({ name: varName, themes });
    } else {
      groups.other!.push({ name: varName, themes });
    }
  }

  // Remove empty groups
  const filtered: any = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value && (value as any).length > 0) {
      filtered[key as any] = value;
    }
  }

  return filtered;
}

/**
 * Checks if value looks like a color
 */
function looksLikeColor(value: string): boolean {
  if (!value) return false;

  const lower = value.toLowerCase().trim();

  return (
    lower.startsWith('#') ||
    lower.startsWith('rgb') ||
    lower.startsWith('hsl') ||
    lower.startsWith('oklch') ||
    lower.startsWith('lch') ||
    lower.startsWith('lab') ||
    lower === 'transparent' ||
    lower === 'currentcolor'
  );
}

/**
 * Builds color-to-variables map for deduplication
 */
function buildColorToVariablesMap(cssVars: any): Map<string, string[]> {
  const colorMap = new Map<string, string[]>();

  for (const [varName, themes] of Object.entries(cssVars || {})) {
    const lightValue = (themes as any).light || (themes as any)[Object.keys(themes as any)[0]];
    if (!lightValue) continue;

    const normalized = normalizeToRGB(lightValue);
    const key = normalized || lightValue;

    if (!colorMap.has(key)) {
      colorMap.set(key, []);
    }
    colorMap.get(key)!.push(varName.replace('--', ''));
  }

  return colorMap;
}

/**
 * Generates section for specific variable prefix group
 */
function generatePrefixSection(
  prefix: string,
  variables: any[],
  styles: any,
  colorMap: Map<string, string[]> | null = null
): string {
  const titles: Record<string, string> = {
    brand: '🏥 Brand Colors',
    sidebar: '📊 Sidebar Colors',
    chart: '📈 Chart Colors',
    semantic: '🎨 Semantic UI Colors',
    radius: '🔲 Border Radius',
    other: 'Other CSS Variables'
  };

  const emojis: Record<string, string> = {
    brand: '(brand-*, medical-*, company-*)',
    sidebar: '(sidebar-*)',
    chart: '(chart-*, graph-*, data-*)',
    semantic: '(background, foreground, primary, etc.)',
    radius: '(radius, rounded, etc.)'
  };

  let section = `### ${titles[prefix] || prefix}`;
  if (emojis[prefix]) {
    section += ` ${emojis[prefix]}`;
  }
  section += `\n\n`;

  variables.forEach(({ name, themes }) => {
    const cleanName = name.replace('--', '');

    const themeKeys = Object.keys(themes);
    const lightValue = themes.light || (themeKeys.length > 0 ? themes[themeKeys[0]] : undefined);
    const darkValue = themes.dark;

    if (!lightValue) return;

    const hasBothModes = darkValue && darkValue !== lightValue;
    const normalizedLight = normalizeToRGB(lightValue);

    // Get usage count
    let usage = 0;
    if (styles.colorUsage && lightValue) {
      if (normalizedLight) {
        usage = styles.colorUsage[normalizedLight] || 0;

        if (usage === 0 && normalizedLight.includes(', ')) {
          const noSpaces = normalizedLight.replace(/, /g, ',');
          usage = styles.colorUsage[noSpaces] || 0;
        }
      }

      if (usage === 0) {
        usage = styles.colorUsage[lightValue] || 0;
      }
    }

    if (hasBothModes) {
      section += `- **${cleanName}**:\n`;
      section += `  - Light: \`${lightValue}\``;

      if (normalizedLight && normalizedLight !== lightValue) {
        section += ` → ${normalizedLight}`;
      }

      if (usage > 0) {
        section += `\n    _Used in ${usage} element${usage !== 1 ? 's' : ''}_`;
      }

      // Duplicate detection
      if (colorMap) {
        const colorKey = normalizedLight || lightValue;
        const duplicates = colorMap.get(colorKey);
        if (duplicates && duplicates.length > 1) {
          const others = duplicates.filter(v => v !== cleanName);
          if (others.length > 0) {
            if (others.length <= 2) {
              section += `\n    💡 _Same as: ${others.map(v => `\`--${v}\``).join(', ')}_`;
            } else {
              const shown = others.slice(0, 2);
              const remaining = others.length - 2;
              section += `\n    💡 _Same as: ${shown.map(v => `\`--${v}\``).join(', ')}, +${remaining} more_`;
            }
          }
        }
      }

      section += `\n`;

      section += `  - Dark: \`${darkValue}\``;

      const normalizedDark = normalizeToRGB(darkValue);
      if (normalizedDark && normalizedDark !== darkValue) {
        section += ` → ${normalizedDark}`;
      }
      section += `\n`;
    } else {
      section += `- **${cleanName}**: \`${lightValue}\``;

      if (normalizedLight && normalizedLight !== lightValue) {
        section += ` → ${normalizedLight}`;
      }

      if (usage > 0) {
        section += `\n  _Used in ${usage} element${usage !== 1 ? 's' : ''}_`;
      }

      // Duplicate detection
      if (colorMap) {
        const colorKey = normalizedLight || lightValue;
        const duplicates = colorMap.get(colorKey);
        if (duplicates && duplicates.length > 1) {
          const others = duplicates.filter(v => v !== cleanName);
          if (others.length > 0) {
            if (others.length <= 2) {
              section += `\n  💡 _Same as: ${others.map(v => `\`--${v}\``).join(', ')}_`;
            } else {
              const shown = others.slice(0, 2);
              const remaining = others.length - 2;
              section += `\n  💡 _Same as: ${shown.map(v => `\`--${v}\``).join(', ')}, +${remaining} more_`;
            }
          }
        }
      }

      section += `\n`;
    }
  });

  section += `\n`;
  return section;
}

/**
 * Normalizes color to RGB format
 */
function normalizeToRGB(color: string): string | null {
  if (!color || !looksLikeColor(color)) return null;

  if (color.startsWith('rgb')) return color;

  // For oklch/lch/lab - use browser conversion
  if (color.startsWith('oklch(') || color.startsWith('lch(') ||
      color.startsWith('lab(') || color.startsWith('oklab(')) {
    try {
      const temp = document.createElement('div');
      temp.style.color = color;
      document.body.appendChild(temp);
      const computed = window.getComputedStyle(temp).color;
      document.body.removeChild(temp);

      if (computed && computed.startsWith('rgb')) {
        return computed;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  // Convert hex
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');

    if (hex.length === 6) {
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (hex.length === 8) {
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const a = parseInt(hex.substr(6, 2), 16) / 255;
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
  }

  return null;
}

/**
 * Finds colors that aren't mapped to CSS variables
 */
function findUnmappedColors(styles: any): Array<{ color: string; usage: number }> {
  const unmapped: Array<{ color: string; usage: number }> = [];

  const colorMap = buildColorToVariablesMap(styles.cssVariables);

  for (const [color, usage] of Object.entries(styles.colorUsage)) {
    if (!colorMap.has(color)) {
      unmapped.push({ color, usage: usage as number });
    }
  }

  return unmapped.sort((a, b) => b.usage - a.usage).slice(0, 10);
}

/**
 * Generates border radius section
 */
function generateBorderRadiusSection(radiusValues: string[]): string {
  let section = `## 🔲 Border Radius\n\n`;

  radiusValues.forEach(value => {
    section += `- \`${value}\`\n`;
  });

  section += `\n`;
  return section;
}

/**
 * Generates fonts section
 */
function generateFontsSection(fonts: string[]): string {
  let section = `## 🔤 Typography\n\n`;
  section += `### Font Families\n\n`;

  fonts.forEach(font => {
    section += `- ${font}\n`;
  });

  section += `\n`;
  return section;
}

/**
 * Generates shadows section
 */
function generateShadowsSection(shadows: string[]): string {
  let section = `## 🌑 Shadows\n\n`;

  shadows.forEach((shadow, index) => {
    section += `- **Shadow ${index + 1}**: \`${shadow}\`\n`;
  });

  section += `\n`;
  return section;
}

/**
 * Generates component patterns section
 */
function generateComponentsSection(components: any): string {
  let section = `## 🧩 Component Patterns\n\n`;

  // Buttons
  if (components.buttons && components.buttons.length > 0) {
    section += `### Buttons (${components.buttons.length} variant${components.buttons.length !== 1 ? 's' : ''} found)\n\n`;

    components.buttons.forEach((btn) => {
      const variantName = btn.variant.charAt(0).toUpperCase() + btn.variant.slice(1);
      section += `#### ${variantName} Button (${btn.count} instance${btn.count !== 1 ? 's' : ''})\n\n`;
      section += `\`\`\`html\n${btn.html}\n\`\`\`\n\n`;
      section += `**Base Styles:**\n`;
      if (btn.styles.background) section += `- Background: \`${btn.styles.background}\`\n`;
      if (btn.styles.color) section += `- Text color: \`${btn.styles.color}\`\n`;
      if (btn.styles.padding) section += `- Padding: \`${btn.styles.padding}\`\n`;
      if (btn.styles.borderRadius) section += `- Border radius: \`${btn.styles.borderRadius}\`\n`;
      if (btn.styles.fontSize) section += `- Font: \`${btn.styles.fontSize}\`, weight \`${btn.styles.fontWeight || 'normal'}\`\n`;
      if (btn.styles.border && btn.styles.border !== 'none' && btn.styles.border !== '0px none rgb(0, 0, 0)') {
        section += `- Border: \`${btn.styles.border}\`\n`;
      }

      // Show state styles if available
      if (btn.stateStyles) {
        if (btn.stateStyles.hover) {
          section += `\n**Hover State:**\n`;
          Object.entries(btn.stateStyles.hover).forEach(([key, value]) => {
            section += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: \`${value}\`\n`;
          });
        }
        if (btn.stateStyles.focus) {
          section += `\n**Focus State:**\n`;
          Object.entries(btn.stateStyles.focus).forEach(([key, value]) => {
            section += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: \`${value}\`\n`;
          });
        }
        if (btn.stateStyles.disabled) {
          section += `\n**Disabled State:**\n`;
          Object.keys(btn.stateStyles.disabled).forEach((key) => {
            section += `- ${key}\n`;
          });
        }
      }

      section += `\n`;
    });
  }

  // Cards
  if (components.cards && components.cards.length > 0) {
    section += `### Cards (${components.cards.length} variant${components.cards.length !== 1 ? 's' : ''} found)\n\n`;

    components.cards.forEach((card, index) => {
      section += `#### Card Variant ${index + 1} (${card.count} instance${card.count !== 1 ? 's' : ''})\n\n`;
      section += `\`\`\`html\n${card.html}\n\`\`\`\n\n`;
      section += `**Styles:**\n`;
      if (card.styles.background) section += `- Background: \`${card.styles.background}\`\n`;
      if (card.styles.border) section += `- Border: \`${card.styles.border}\`\n`;
      if (card.styles.borderRadius) section += `- Border radius: \`${card.styles.borderRadius}\`\n`;
      if (card.styles.padding) section += `- Padding: \`${card.styles.padding}\`\n`;
      if (card.styles.boxShadow && card.styles.boxShadow !== 'none') {
        section += `- Shadow: \`${card.styles.boxShadow}\`\n`;
      }
      section += `\n`;
    });
  }

  // Inputs
  if (components.inputs && components.inputs.length > 0) {
    section += `### Form Inputs (${components.inputs.length} variant${components.inputs.length !== 1 ? 's' : ''} found)\n\n`;

    components.inputs.forEach((input) => {
      const typeName = input.variant.charAt(0).toUpperCase() + input.variant.slice(1);
      section += `#### ${typeName} (${input.count} instance${input.count !== 1 ? 's' : ''})\n\n`;
      section += `\`\`\`html\n${input.html}\n\`\`\`\n\n`;
      section += `**Styles:**\n`;
      if (input.styles.background) section += `- Background: \`${input.styles.background}\`\n`;
      if (input.styles.color) section += `- Text color: \`${input.styles.color}\`\n`;
      if (input.styles.border) section += `- Border: \`${input.styles.border}\`\n`;
      if (input.styles.borderRadius) section += `- Border radius: \`${input.styles.borderRadius}\`\n`;
      if (input.styles.padding) section += `- Padding: \`${input.styles.padding}\`\n`;
      if (input.styles.fontSize) section += `- Font size: \`${input.styles.fontSize}\`\n`;
      section += `\n`;
    });
  }

  section += `---\n\n`;
  return section;
}

/**
 * Generates typography context section
 */
function generateTypographyContextSection(typography: any): string {
  let section = `## 📐 Typography Usage\n\n`;

  section += `### Heading Hierarchy\n\n`;

  // Check both semantic headings (h1-h6) and inferred headings
  const headingOrder = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const inferredOrder = ['h1 (inferred)', 'h2 (inferred)', 'h3 (inferred)', 'h4 (inferred)', 'h5 (inferred)', 'h6 (inferred)'];
  const allHeadings = [...headingOrder, ...inferredOrder];

  let headingsFound = false;
  for (const tag of allHeadings) {
    const heading = typography.headings[tag];
    if (heading) {
      headingsFound = true;
      const displayName = tag.includes('inferred') ? tag.toUpperCase() : tag.toUpperCase();
      section += `- **${displayName}**: \`${heading.fontSize}\` / \`${heading.fontWeight}\` weight / \`${heading.lineHeight}\` line-height\n`;
      if (heading.examples && heading.examples.length > 0) {
        section += `  - Example: "${heading.examples[0]}"\n`;
      }
      section += `  - Color: \`${heading.color}\`\n`;
    }
  }

  if (!headingsFound) {
    section += `_No headings detected on this page._\n`;
  }

  if (typography.body && typography.body.length > 0) {
    section += `\n### Body Text\n\n`;
    typography.body.forEach((bodyStyle) => {
      const label = bodyStyle.usage || 'Body text';
      const instanceText = bodyStyle.count ? ` (${bodyStyle.count} instance${bodyStyle.count !== 1 ? 's' : ''})` : '';
      section += `- **${label}**: \`${bodyStyle.fontSize}\` / \`${bodyStyle.fontWeight}\` weight / \`${bodyStyle.lineHeight}\` line-height${instanceText}\n`;
      section += `  - Color: \`${bodyStyle.color}\`\n`;
      if (bodyStyle.tag) {
        section += `  - Element: \`<${bodyStyle.tag}>\`\n`;
      }
      if (bodyStyle.examples && bodyStyle.examples.length > 0) {
        section += `  - Example: "${bodyStyle.examples[0]}"\n`;
      }
    });
  }

  section += `\n---\n\n`;
  return section;
}

/**
 * Generates color usage context section
 */
function generateColorContextSection(colorContext: any): string {
  let section = `## 🎨 Color Usage Patterns\n\n`;

  section += `### Common Color Pairings\n\n`;
  if (colorContext.pairings && colorContext.pairings.length > 0) {
    colorContext.pairings.slice(0, 5).forEach(pairing => {
      // Build a readable pairing name with variable names if available
      const bgDisplay = pairing.backgroundVar && pairing.backgroundVar.startsWith('var(')
        ? pairing.backgroundVar
        : pairing.background;
      const textDisplay = pairing.textVar && pairing.textVar.startsWith('var(')
        ? pairing.textVar
        : pairing.textVar === '#ffffff' ? '#ffffff (white)' : pairing.text;

      section += `- **${bgDisplay} / ${textDisplay}** (${pairing.count} instance${pairing.count !== 1 ? 's' : ''})\n`;

      // Show computed values if using variables
      if (pairing.backgroundVar && pairing.backgroundVar.startsWith('var(')) {
        section += `  - Background: ${pairing.backgroundVar} → \`${pairing.background}\`\n`;
      } else {
        section += `  - Background: \`${pairing.background}\` (hardcoded, no CSS variable)\n`;
      }

      if (pairing.textVar && pairing.textVar.startsWith('var(')) {
        section += `  - Text: ${pairing.textVar} → \`${pairing.text}\`\n`;
      } else if (pairing.textVar === '#ffffff') {
        section += `  - Text: \`#ffffff\` (white, hardcoded)\n`;
      } else {
        section += `  - Text: \`${pairing.text}\` (hardcoded, no CSS variable)\n`;
      }
    });
    section += `\n`;
  }

  section += `### Color Usage by Purpose\n\n`;

  // Top backgrounds
  const topBackgrounds = Object.entries(colorContext.backgrounds)
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  if (topBackgrounds.length > 0) {
    section += `**Backgrounds:**\n`;
    topBackgrounds.forEach(([color, count]) => {
      const varName = colorContext.variableMap?.[color];
      if (varName) {
        section += `- ${varName} → \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      } else {
        section += `- \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      }
    });
    section += `\n`;
  }

  // Top text colors
  const topText = Object.entries(colorContext.text)
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  if (topText.length > 0) {
    section += `**Text:**\n`;
    topText.forEach(([color, count]) => {
      const varName = colorContext.variableMap?.[color];
      if (varName) {
        section += `- ${varName} → \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      } else {
        section += `- \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      }
    });
    section += `\n`;
  }

  // Top border colors
  const topBorders = Object.entries(colorContext.borders)
    .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  if (topBorders.length > 0) {
    section += `**Borders:**\n`;
    topBorders.forEach(([color, count]) => {
      const varName = colorContext.variableMap?.[color];
      if (varName) {
        section += `- ${varName} → \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      } else {
        section += `- \`${color}\` (${count} instance${count !== 1 ? 's' : ''})\n`;
      }
    });
    section += `\n`;
  }

  section += `---\n\n`;
  return section;
}

/**
 * Generates layout patterns section
 */
function generateLayoutPatternsSection(layout: any): string {
  let section = `## 📏 Layout System\n\n`;

  // Containers
  if (layout.containers && layout.containers.length > 0) {
    section += `### Containers\n\n`;
    layout.containers.forEach(container => {
      section += `- **${container.selector}**: max-width \`${container.maxWidth}\``;
      if (container.padding && container.padding !== '0px') {
        section += `, padding \`${container.padding}\``;
      }
      section += ` (${container.count} instance${container.count !== 1 ? 's' : ''})\n`;
    });
    section += `\n`;
  }

  // Breakpoints
  if (layout.breakpoints && layout.breakpoints.length > 0) {
    section += `### Breakpoints\n\n`;
    layout.breakpoints.forEach(bp => {
      section += `- \`${bp}px\`\n`;
    });
    section += `\n`;
  }

  // Common spacing patterns
  const spacingEntries = Object.entries(layout.spacingPatterns)
    .sort((a: any, b: any) => (b[1] as any).count - (a[1] as any).count)
    .slice(0, 10);

  if (spacingEntries.length > 0) {
    section += `### Common Spacing Patterns\n\n`;
    spacingEntries.forEach(([spacing, pattern]: [string, any]) => {
      const [type, value] = spacing.split(':');
      section += `- ${type.charAt(0).toUpperCase() + type.slice(1)}: \`${value}\` (${pattern.count} instance${pattern.count !== 1 ? 's' : ''})\n`;
    });
    section += `\n`;
  }

  section += `---\n\n`;
  return section;
}

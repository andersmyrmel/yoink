/**
 * Yoink Popup Script
 *
 * Handles the popup UI and markdown generation
 */

import type { StyleData, CSSVariables, GroupedVariables, VariableEntry } from '../types';

const scanButton = document.getElementById('scanButton') as HTMLButtonElement;
const copyButton = document.getElementById('copyButton') as HTMLButtonElement;
const downloadButton = document.getElementById('downloadButton') as HTMLButtonElement;
const loadingDiv = document.getElementById('loading') as HTMLDivElement;
const outputDiv = document.getElementById('output') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

let currentMarkdown = '';

// Scan button click handler
scanButton.addEventListener('click', async () => {
  showLoading('Scanning page styles...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab found');
    }

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'scanStyles' },
      (response: { success: boolean; data?: StyleData; error?: string }) => {
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
    showStatus('Copied to clipboard!');
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
  showStatus('Downloaded!');
});

/**
 * Shows loading state
 */
function showLoading(message: string): void {
  loadingDiv.textContent = message;
  loadingDiv.style.display = 'block';
  outputDiv.style.display = 'none';
  statusDiv.style.display = 'none';
  copyButton.style.display = 'none';
  downloadButton.style.display = 'none';
}

/**
 * Hides loading state
 */
function hideLoading(): void {
  loadingDiv.style.display = 'none';
}

/**
 * Displays markdown output
 */
function displayMarkdown(markdown: string): void {
  currentMarkdown = markdown;
  outputDiv.textContent = markdown;
  outputDiv.style.display = 'block';
  copyButton.style.display = 'inline-block';
  downloadButton.style.display = 'inline-block';
}

/**
 * Shows error message
 */
function showError(message: string): void {
  statusDiv.textContent = `❌ ${message}`;
  statusDiv.className = 'error';
  statusDiv.style.display = 'block';
}

/**
 * Shows success status
 */
function showStatus(message: string): void {
  statusDiv.textContent = `✅ ${message}`;
  statusDiv.className = 'success';
  statusDiv.style.display = 'block';
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 2000);
}

/**
 * Generates complete markdown documentation
 */
function generateMarkdown(styles: StyleData): string {
  const now = new Date().toLocaleDateString();

  let markdown = `# Design System Extraction\n\n`;
  markdown += `**Extracted:** ${now}\n\n`;
  markdown += `---\n\n`;

  markdown += generateColorSection(styles);

  if (styles.borderRadius.length > 0) {
    markdown += generateBorderRadiusSection(styles.borderRadius);
  }

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
function generateColorSection(styles: StyleData): string {
  let section = `## 🎨 Colors\n\n`;

  const groupedVars = groupCSSVariablesByPrefix(styles.cssVariables);
  const colorMap = buildColorToVariablesMap(styles.cssVariables);

  const displayOrder = ['brand', 'sidebar', 'chart', 'semantic', 'other'];

  for (const prefix of displayOrder) {
    const vars = groupedVars[prefix as keyof GroupedVariables];
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
function groupCSSVariablesByPrefix(cssVars: CSSVariables): GroupedVariables {
  const groups: GroupedVariables = {
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
  const filtered: GroupedVariables = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value && value.length > 0) {
      filtered[key as keyof GroupedVariables] = value;
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
function buildColorToVariablesMap(cssVars: CSSVariables): Map<string, string[]> {
  const colorMap = new Map<string, string[]>();

  for (const [varName, themes] of Object.entries(cssVars || {})) {
    const lightValue = themes.light || themes[Object.keys(themes)[0]];
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
  variables: VariableEntry[],
  styles: StyleData,
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
function findUnmappedColors(styles: StyleData): Array<{ color: string; usage: number }> {
  const unmapped: Array<{ color: string; usage: number }> = [];

  const colorMap = buildColorToVariablesMap(styles.cssVariables);

  for (const [color, usage] of Object.entries(styles.colorUsage)) {
    if (!colorMap.has(color)) {
      unmapped.push({ color, usage });
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

console.log('🎨 Yoink popup loaded');

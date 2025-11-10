/**
 * Yoink Popup Script
 *
 * Handles the popup UI and YAML generation
 */

const scanButton = document.getElementById('scanBtn') as HTMLButtonElement;
const copyButton = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadButton = document.getElementById('downloadBtn') as HTMLButtonElement;
const includeComponentsCheckbox = document.getElementById('includeComponentsCheckbox') as HTMLInputElement;
const loadingState = document.getElementById('loadingState') as HTMLDivElement;
const resultsSection = document.getElementById('resultsSection') as HTMLDivElement;
const errorState = document.getElementById('errorState') as HTMLDivElement;
const yamlPreview = document.getElementById('yamlPreview') as HTMLDivElement;
const successMessage = document.getElementById('successMessage') as HTMLDivElement;

let currentYAML = '';

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
          const yaml = generateYAML(response.data);
          displayYAML(yaml);
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
  navigator.clipboard.writeText(currentYAML).then(() => {
    showSuccess('Copied to clipboard!');
  });
});

// Download button click handler
downloadButton.addEventListener('click', () => {
  const blob = new Blob([currentYAML], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'design-system.yaml';
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
 * Displays YAML output
 */
function displayYAML(yaml: string): void {
  currentYAML = yaml;
  yamlPreview.textContent = yaml;
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
 * Recursively generates YAML for DOM tree structure
 */
function generateDOMYAML(node: any, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel);
  let yaml = '';

  yaml += `${indent}tag: ${node.tag}\n`;

  if (node.classes && node.classes.length > 0) {
    yaml += `${indent}classes: [${node.classes.join(', ')}]\n`;
  }

  if (node.role) {
    yaml += `${indent}role: ${node.role}\n`;
  }

  if (node.layout) {
    yaml += `${indent}layout: ${node.layout}\n`;
  }

  if (node.dimensions) {
    yaml += `${indent}dimensions: { width: ${node.dimensions.width}px, height: ${node.dimensions.height}px }\n`;
  }

  // Semantic attributes
  if (node.href) {
    yaml += `${indent}href: "${node.href}"\n`;
  }

  if (node.src) {
    yaml += `${indent}src: "${node.src}"\n`;
  }

  if (node.alt) {
    yaml += `${indent}alt: "${node.alt}"\n`;
  }

  if (node.inputType) {
    yaml += `${indent}inputType: ${node.inputType}\n`;
  }

  if (node.placeholder) {
    yaml += `${indent}placeholder: "${node.placeholder}"\n`;
  }

  if (node.buttonType) {
    yaml += `${indent}buttonType: ${node.buttonType}\n`;
  }

  if (node.tableHeaders) {
    yaml += `${indent}tableHeaders: [${node.tableHeaders.join(', ')}]\n`;
  }

  if (node.tableRows) {
    yaml += `${indent}tableRows: ${node.tableRows}\n`;
  }

  if (node.text) {
    yaml += `${indent}text: "${node.text}"\n`;
  }

  if (node.styles) {
    yaml += `${indent}styles:\n`;
    for (const [key, value] of Object.entries(node.styles)) {
      yaml += `${indent}  ${key}: ${value}\n`;
    }
  }

  if (node.children && node.children.length > 0) {
    yaml += `${indent}children:\n`;
    node.children.forEach((child: any) => {
      yaml += `${indent}  -\n`;
      yaml += generateDOMYAML(child, indentLevel + 2);
    });
  }

  return yaml;
}

/**
 * Generates YAML format optimized for AI processing
 * Raw extraction data with usage statistics for AI enhancement
 */
function generateYAML(styles: any): string {
  const now = new Date().toISOString().split('T')[0];
  let yaml = `# Design System Extraction (Raw Data)\n`;
  yaml += `# Extracted: ${now}\n`;
  yaml += `# Format: YAML (AI-optimized)\n`;
  yaml += `# Purpose: Pass to AI for semantic enhancement\n\n`;

  yaml += `metadata:\n`;
  yaml += `  extraction-date: ${now}\n`;
  if (styles.domStructure) {
    yaml += `  url: "${styles.domStructure.url}"\n`;
    yaml += `  viewport: "${styles.domStructure.viewport.width}x${styles.domStructure.viewport.height}"\n`;
  }
  if (styles.typographyContext?.typeScale) {
    yaml += `  detected-pattern: "${styles.typographyContext.typeScale.ratioName}"\n`;
    yaml += `  confidence: ${styles.typographyContext.typeScale.confidence}\n`;
  }
  yaml += `\n`;

  // DOM Structure - hierarchical component tree
  if (styles.domStructure?.tree) {
    yaml += `dom-structure:\n`;
    yaml += generateDOMYAML(styles.domStructure.tree, 1);
    yaml += `\n`;
  }

  // Colors - with usage data
  yaml += `colors:\n`;
  yaml += `  extracted:\n`;
  if (styles.colors && styles.colorUsage) {
    const topColors = styles.colors.slice(0, 15);
    topColors.forEach((color: string) => {
      const usage = styles.colorUsage[color] || 0;
      yaml += `    - value: "${color}"\n`;
      yaml += `      usage-count: ${usage}\n`;
    });
  }

  // CSS Variables (if any colors)
  if (styles.cssVariables) {
    yaml += `\n  css-variables:\n`;
    for (const [varName, themes] of Object.entries(styles.cssVariables || {})) {
      const lightValue = (themes as any).light || (themes as any)[Object.keys(themes as any)[0]];
      if (lightValue && looksLikeColor(lightValue)) {
        yaml += `    ${varName.replace('--', '')}: "${lightValue}"\n`;
      }
    }
  }
  yaml += `\n`;

  // Typography
  yaml += `typography:\n`;
  if (styles.typographyContext?.typeScale) {
    const scale = styles.typographyContext.typeScale;
    yaml += `  detected-scale: [${scale.scale.join(', ')}]\n`;
    yaml += `  base-size: ${scale.baseSize}\n`;
    yaml += `  scale-ratio: ${scale.ratio}\n`;
    yaml += `  ratio-name: "${scale.ratioName}"\n`;
    yaml += `  confidence: ${scale.confidence}\n`;
  }

  // Fonts
  if (styles.fonts && styles.fonts.length > 0) {
    yaml += `\n  fonts:\n`;
    styles.fonts.forEach((font: string) => {
      yaml += `    - "${font}"\n`;
    });
  }

  // Headings
  if (styles.typographyContext?.headings) {
    yaml += `\n  headings:\n`;
    for (const [tag, data] of Object.entries(styles.typographyContext.headings)) {
      const heading = data as any;
      yaml += `    ${tag}:\n`;
      yaml += `      size: ${heading.fontSize}\n`;
      yaml += `      weight: ${heading.fontWeight}\n`;
      yaml += `      line-height: ${heading.lineHeight}\n`;
      if (heading.count) yaml += `      count: ${heading.count}\n`;
      if (heading.examples && heading.examples[0]) {
        yaml += `      example: "${heading.examples[0].substring(0, 50)}"\n`;
      }
    }
  }

  // Body text
  if (styles.typographyContext?.body && styles.typographyContext.body.length > 0) {
    yaml += `\n  body-text:\n`;
    styles.typographyContext.body.slice(0, 5).forEach((bodyStyle: any) => {
      yaml += `    - usage: "${bodyStyle.usage}"\n`;
      yaml += `      size: ${bodyStyle.fontSize}\n`;
      yaml += `      weight: ${bodyStyle.fontWeight}\n`;
      yaml += `      line-height: ${bodyStyle.lineHeight}\n`;
      yaml += `      count: ${bodyStyle.count}\n`;
    });
  }

  // Line height patterns
  if (styles.typographyContext?.lineHeightPatterns) {
    yaml += `\n  line-height-patterns:\n`;
    styles.typographyContext.lineHeightPatterns.forEach((pattern: any) => {
      yaml += `    - value: ${pattern.value}\n`;
      yaml += `      ratio: ${pattern.ratio}\n`;
      yaml += `      usage: "${pattern.usage}"\n`;
      yaml += `      count: ${pattern.count}\n`;
    });
  }
  yaml += `\n`;

  // Spacing
  yaml += `spacing:\n`;
  if (styles.layoutPatterns?.spacingScale) {
    const spacing = styles.layoutPatterns.spacingScale;
    yaml += `  base-unit: ${spacing.baseUnit}\n`;
    yaml += `  pattern: "${spacing.pattern}"\n`;
    yaml += `  scale: [${spacing.spacingScale.slice(0, 10).map((s: any) => s.value).join(', ')}]\n`;
    yaml += `\n  usage:\n`;
    spacing.spacingScale.slice(0, 8).forEach((s: any) => {
      yaml += `    ${s.value}: ${s.count}  # ${s.usage}\n`;
    });
  }
  yaml += `\n`;

  // Shadows
  yaml += `shadows:\n`;
  if (styles.shadows?.elevationLevels) {
    yaml += `  pattern: "${styles.shadows.pattern}"\n`;
    yaml += `  levels:\n`;
    styles.shadows.elevationLevels.forEach((level: any) => {
      yaml += `    - name: ${level.name.toLowerCase()}\n`;
      yaml += `      elevation: ${level.elevationLevel}\n`;
      yaml += `      blur: ${level.shadows[0].blur}px\n`;
      yaml += `      offset: [${level.shadows[0].offsetX}, ${level.shadows[0].offsetY}]\n`;
      yaml += `      usage-count: ${level.count}\n`;
      yaml += `      value: "${level.representative}"\n`;
    });
  }
  yaml += `\n`;

  // Layout Structure
  if (styles.layout) {
    yaml += `layout:\n`;

    // Sidebars
    if (styles.layout.sidebars && styles.layout.sidebars.length > 0) {
      yaml += `  sidebars:\n`;
      styles.layout.sidebars.forEach((sidebar: any) => {
        yaml += `    - position: ${sidebar.position}\n`;
        yaml += `      width: ${sidebar.width}\n`;
        yaml += `      background: "${sidebar.backgroundColor}"\n`;
        if (sidebar.zIndex) yaml += `      z-index: ${sidebar.zIndex}\n`;
      });
    }

    // Fixed Elements
    if (styles.layout.fixedElements && styles.layout.fixedElements.length > 0) {
      yaml += `  fixed-elements:\n`;
      styles.layout.fixedElements.slice(0, 3).forEach((el: any) => {
        yaml += `    - width: ${el.width}\n`;
        yaml += `      height: ${el.height}\n`;
        yaml += `      position: { top: ${el.top}, left: ${el.left}, right: ${el.right}, bottom: ${el.bottom} }\n`;
      });
    }

    // Containers
    if (styles.layout.containers && styles.layout.containers.length > 0) {
      yaml += `  containers:\n`;
      styles.layout.containers.slice(0, 5).forEach((container: any) => {
        yaml += `    - max-width: ${container.maxWidth}\n`;
        yaml += `      centered: ${container.centered}\n`;
        yaml += `      padding: ${container.padding}\n`;
      });
    }

    // Grids
    if (styles.layout.grids && styles.layout.grids.length > 0) {
      yaml += `  grids:\n`;
      styles.layout.grids.slice(0, 5).forEach((grid: any) => {
        yaml += `    - columns: "${grid.columns}"\n`;
        yaml += `      gap: ${grid.gap}\n`;
        if (grid.alignItems !== 'normal') yaml += `      align-items: ${grid.alignItems}\n`;
      });
    }

    yaml += `\n`;
  }

  // Z-Index Hierarchy
  if (styles.zIndex) {
    yaml += `z-index:\n`;
    if (styles.zIndex.range) {
      yaml += `  range: [${styles.zIndex.range.min}, ${styles.zIndex.range.max}]\n`;
    }

    if (styles.zIndex.layers) {
      yaml += `  layers:\n`;

      if (styles.zIndex.layers.base && styles.zIndex.layers.base.length > 0) {
        yaml += `    base:  # z-index 1-10\n`;
        styles.zIndex.layers.base.forEach((item: any) => {
          yaml += `      - z-index: ${item.zIndex}\n`;
          yaml += `        contexts: [${item.contexts.join(', ')}]\n`;
        });
      }

      if (styles.zIndex.layers.dropdown && styles.zIndex.layers.dropdown.length > 0) {
        yaml += `    dropdown:  # z-index 10-100\n`;
        styles.zIndex.layers.dropdown.forEach((item: any) => {
          yaml += `      - z-index: ${item.zIndex}\n`;
          yaml += `        contexts: [${item.contexts.join(', ')}]\n`;
        });
      }

      if (styles.zIndex.layers.modal && styles.zIndex.layers.modal.length > 0) {
        yaml += `    modal:  # z-index 100-1000\n`;
        styles.zIndex.layers.modal.forEach((item: any) => {
          yaml += `      - z-index: ${item.zIndex}\n`;
          yaml += `        contexts: [${item.contexts.join(', ')}]\n`;
        });
      }

      if (styles.zIndex.layers.toast && styles.zIndex.layers.toast.length > 0) {
        yaml += `    toast:  # z-index 1000+\n`;
        styles.zIndex.layers.toast.forEach((item: any) => {
          yaml += `      - z-index: ${item.zIndex}\n`;
          yaml += `        contexts: [${item.contexts.join(', ')}]\n`;
        });
      }
    }

    yaml += `\n`;
  }

  // Animations & Transitions
  if (styles.animations) {
    yaml += `animations:\n`;

    // Common durations
    if (styles.animations.commonDurations && styles.animations.commonDurations.length > 0) {
      yaml += `  durations:\n`;
      styles.animations.commonDurations.forEach((d: any) => {
        yaml += `    - value: ${d.duration}\n`;
        yaml += `      usage-count: ${d.count}\n`;
      });
    }

    // Common easings
    if (styles.animations.commonEasings && styles.animations.commonEasings.length > 0) {
      yaml += `  easings:\n`;
      styles.animations.commonEasings.forEach((e: any) => {
        yaml += `    - value: "${e.easing}"\n`;
        yaml += `      usage-count: ${e.count}\n`;
      });
    }

    // Transition patterns
    if (styles.animations.transitions && styles.animations.transitions.length > 0) {
      yaml += `  transitions:\n`;
      styles.animations.transitions.slice(0, 10).forEach((t: any) => {
        yaml += `    - property: ${t.property}\n`;
        yaml += `      duration: ${t.duration}\n`;
        yaml += `      easing: "${t.easing}"\n`;
        if (t.delay !== '0s') yaml += `      delay: ${t.delay}\n`;
        yaml += `      usage-count: ${t.count}\n`;
      });
    }

    yaml += `\n`;
  }

  // Icon System
  if (styles.icons) {
    yaml += `icons:\n`;
    if (styles.icons.commonSizes && styles.icons.commonSizes.length > 0) {
      yaml += `  common-sizes:\n`;
      styles.icons.commonSizes.forEach((s: any) => {
        yaml += `    - size: ${s.size}\n`;
        yaml += `      count: ${s.count}\n`;
      });
    }

    if (styles.icons.svgPatterns && styles.icons.svgPatterns.length > 0) {
      yaml += `  svg-patterns:\n`;
      styles.icons.svgPatterns.slice(0, 5).forEach((pattern: any) => {
        yaml += `    - size: ${pattern.size}\n`;
        if (pattern.viewBox) yaml += `      viewBox: "${pattern.viewBox}"\n`;
        yaml += `      count: ${pattern.count}\n`;
      });
    }

    if (styles.icons.iconFonts && styles.icons.iconFonts.length > 0) {
      yaml += `  icon-font-sizes:\n`;
      styles.icons.iconFonts.forEach((font: any) => {
        yaml += `    - size: ${font.size}\n`;
        yaml += `      count: ${font.count}\n`;
      });
    }

    yaml += `  totals:\n`;
    yaml += `    svg-icons: ${styles.icons.totalSvgs || 0}\n`;
    yaml += `    icon-fonts: ${styles.icons.totalIconFonts || 0}\n`;
    yaml += `\n`;
  }

  // Components (with enhanced states)
  if (styles.components) {
    yaml += `components:\n`;

    // Buttons
    if (styles.components.buttons && styles.components.buttons.length > 0) {
      yaml += `  buttons:\n`;
      styles.components.buttons.slice(0, 3).forEach((btn: any) => {
        yaml += `    - variant: ${btn.variant}\n`;
        yaml += `      count: ${btn.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${btn.styles.background}"\n`;
        yaml += `        color: "${btn.styles.color}"\n`;
        yaml += `        padding: "${btn.styles.padding}"\n`;
        yaml += `        border-radius: ${btn.styles.borderRadius}\n`;
        yaml += `        font-size: ${btn.styles.fontSize}\n`;

        // Interactive states
        if (btn.states || btn.stateStyles) {
          const states = btn.states || btn.stateStyles;
          yaml += `      states:\n`;

          if (states.hover) {
            yaml += `        hover:\n`;
            Object.entries(states.hover).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }

          if (states.focus) {
            yaml += `        focus:\n`;
            Object.entries(states.focus).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }

          if (states.active) {
            yaml += `        active:\n`;
            Object.entries(states.active).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }

          if (states.disabled) {
            yaml += `        disabled:\n`;
            Object.entries(states.disabled).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }
        }
      });
    }

    // Cards
    if (styles.components.cards && styles.components.cards.length > 0) {
      yaml += `\n  cards:\n`;
      styles.components.cards.slice(0, 3).forEach((card: any) => {
        yaml += `    - variant: ${card.variant}\n`;
        yaml += `      count: ${card.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${card.styles.background}"\n`;
        yaml += `        border: "${card.styles.border}"\n`;
        yaml += `        border-radius: ${card.styles.borderRadius}\n`;
        yaml += `        padding: ${card.styles.padding}\n`;
        yaml += `        box-shadow: "${card.styles.boxShadow}"\n`;
        if (card.states) {
          yaml += `      states:\n`;
          if (card.states.hover) {
            yaml += `        hover:\n`;
            Object.entries(card.states.hover).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }
        }
      });
    }

    // Inputs
    if (styles.components.inputs && styles.components.inputs.length > 0) {
      yaml += `\n  inputs:\n`;
      styles.components.inputs.slice(0, 5).forEach((input: any) => {
        yaml += `    - type: ${input.type}\n`;
        yaml += `      variant: ${input.variant}\n`;
        yaml += `      count: ${input.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${input.styles.background}"\n`;
        yaml += `        border: "${input.styles.border}"\n`;
        yaml += `        border-radius: ${input.styles.borderRadius}\n`;
        yaml += `        padding: ${input.styles.padding}\n`;
        yaml += `        height: ${input.styles.height}\n`;
        if (input.states) {
          yaml += `      states:\n`;
          if (input.states.focus) {
            yaml += `        focus:\n`;
            Object.entries(input.states.focus).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }
          if (input.states.disabled) {
            yaml += `        disabled:\n`;
            Object.entries(input.states.disabled).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }
        }
      });
    }

    // Navigation
    if (styles.components.navigation && styles.components.navigation.length > 0) {
      yaml += `\n  navigation:\n`;
      styles.components.navigation.slice(0, 3).forEach((nav: any) => {
        yaml += `    - variant: ${nav.variant}\n`;
        yaml += `      count: ${nav.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        color: "${nav.styles.color}"\n`;
        yaml += `        font-size: ${nav.styles.fontSize}\n`;
        yaml += `        font-weight: ${nav.styles.fontWeight}\n`;
        yaml += `        padding: ${nav.styles.padding}\n`;
        if (nav.states) {
          yaml += `      states:\n`;
          if (nav.states.hover) {
            yaml += `        hover:\n`;
            Object.entries(nav.states.hover).forEach(([key, value]) => {
              yaml += `          ${key}: "${value}"\n`;
            });
          }
        }
      });
    }

    // Dropdowns
    if (styles.components.dropdowns && styles.components.dropdowns.length > 0) {
      yaml += `\n  dropdowns:\n`;
      styles.components.dropdowns.forEach((dropdown: any) => {
        yaml += `    - count: ${dropdown.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${dropdown.styles.background}"\n`;
        yaml += `        border: "${dropdown.styles.border}"\n`;
        yaml += `        border-radius: ${dropdown.styles.borderRadius}\n`;
        yaml += `        box-shadow: "${dropdown.styles.boxShadow}"\n`;
        yaml += `        min-width: ${dropdown.styles.minWidth}\n`;
      });
    }

    // Tables
    if (styles.components.tables && styles.components.tables.length > 0) {
      yaml += `\n  tables:\n`;
      styles.components.tables.forEach((table: any) => {
        yaml += `    - count: ${table.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${table.styles.background}"\n`;
        yaml += `        border: "${table.styles.border}"\n`;
        if (table.styles.header) {
          yaml += `        header:\n`;
          yaml += `          background: "${table.styles.header.background}"\n`;
          yaml += `          color: "${table.styles.header.color}"\n`;
          yaml += `          font-weight: ${table.styles.header.fontWeight}\n`;
        }
        if (table.styles.cell) {
          yaml += `        cell:\n`;
          yaml += `          padding: ${table.styles.cell.padding}\n`;
          yaml += `          border-bottom: "${table.styles.cell.borderBottom}"\n`;
        }
      });
    }

    // Modals
    if (styles.components.modals && styles.components.modals.length > 0) {
      yaml += `\n  modals:\n`;
      styles.components.modals.forEach((modal: any) => {
        yaml += `    - count: ${modal.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${modal.styles.background}"\n`;
        yaml += `        border-radius: ${modal.styles.borderRadius}\n`;
        yaml += `        padding: ${modal.styles.padding}\n`;
        yaml += `        box-shadow: "${modal.styles.boxShadow}"\n`;
        yaml += `        max-width: ${modal.styles.maxWidth}\n`;
        yaml += `        z-index: ${modal.styles.zIndex}\n`;
      });
    }

    // Tooltips
    if (styles.components.tooltips && styles.components.tooltips.length > 0) {
      yaml += `\n  tooltips:\n`;
      styles.components.tooltips.forEach((tooltip: any) => {
        yaml += `    - count: ${tooltip.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${tooltip.styles.background}"\n`;
        yaml += `        color: "${tooltip.styles.color}"\n`;
        yaml += `        border-radius: ${tooltip.styles.borderRadius}\n`;
        yaml += `        padding: ${tooltip.styles.padding}\n`;
        yaml += `        font-size: ${tooltip.styles.fontSize}\n`;
      });
    }

    // Badges
    if (styles.components.badges && styles.components.badges.length > 0) {
      yaml += `\n  badges:\n`;
      styles.components.badges.slice(0, 5).forEach((badge: any) => {
        yaml += `    - variant: ${badge.variant}\n`;
        yaml += `      count: ${badge.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${badge.styles.background}"\n`;
        yaml += `        color: "${badge.styles.color}"\n`;
        yaml += `        padding: ${badge.styles.padding}\n`;
        yaml += `        border-radius: ${badge.styles.borderRadius}\n`;
        yaml += `        font-size: ${badge.styles.fontSize}\n`;
      });
    }

    // Avatars
    if (styles.components.avatars && styles.components.avatars.length > 0) {
      yaml += `\n  avatars:\n`;
      styles.components.avatars.forEach((avatar: any) => {
        yaml += `    - variant: ${avatar.variant}\n`;
        yaml += `      count: ${avatar.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        size: ${avatar.styles.width} x ${avatar.styles.height}\n`;
        yaml += `        border-radius: ${avatar.styles.borderRadius}\n`;
        if (avatar.styles.border !== 'none') yaml += `        border: "${avatar.styles.border}"\n`;
      });
    }

    // Tabs
    if (styles.components.tabs && styles.components.tabs.length > 0) {
      yaml += `\n  tabs:\n`;
      styles.components.tabs.forEach((tab: any) => {
        yaml += `    - variant: ${tab.variant}\n`;
        yaml += `      count: ${tab.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        color: "${tab.styles.color}"\n`;
        yaml += `        background: "${tab.styles.background}"\n`;
        yaml += `        border-bottom: "${tab.styles.borderBottom}"\n`;
        yaml += `        padding: ${tab.styles.padding}\n`;
        if (tab.states && tab.states.hover) {
          yaml += `      states:\n`;
          yaml += `        hover:\n`;
          Object.entries(tab.states.hover).forEach(([key, value]) => {
            yaml += `          ${key}: "${value}"\n`;
          });
        }
      });
    }

    // Accordions
    if (styles.components.accordions && styles.components.accordions.length > 0) {
      yaml += `\n  accordions:\n`;
      styles.components.accordions.forEach((accordion: any) => {
        yaml += `    - count: ${accordion.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${accordion.styles.background}"\n`;
        yaml += `        border: "${accordion.styles.border}"\n`;
        yaml += `        padding: ${accordion.styles.padding}\n`;
      });
    }

    // Progress
    if (styles.components.progress && styles.components.progress.length > 0) {
      yaml += `\n  progress:\n`;
      styles.components.progress.forEach((prog: any) => {
        yaml += `    - variant: ${prog.variant}\n`;
        yaml += `      count: ${prog.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        height: ${prog.styles.height}\n`;
        yaml += `        background: "${prog.styles.background}"\n`;
        yaml += `        border-radius: ${prog.styles.borderRadius}\n`;
      });
    }

    // Breadcrumbs
    if (styles.components.breadcrumbs && styles.components.breadcrumbs.length > 0) {
      yaml += `\n  breadcrumbs:\n`;
      styles.components.breadcrumbs.forEach((breadcrumb: any) => {
        yaml += `    - count: ${breadcrumb.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        font-size: ${breadcrumb.styles.fontSize}\n`;
        yaml += `        color: "${breadcrumb.styles.color}"\n`;
      });
    }

    // Pagination
    if (styles.components.pagination && styles.components.pagination.length > 0) {
      yaml += `\n  pagination:\n`;
      styles.components.pagination.forEach((pagination: any) => {
        yaml += `    - count: ${pagination.count}\n`;
        if (pagination.styles.item) {
          yaml += `      item-styles:\n`;
          yaml += `        padding: ${pagination.styles.item.padding}\n`;
          yaml += `        background: "${pagination.styles.item.background}"\n`;
          yaml += `        border: "${pagination.styles.item.border}"\n`;
          yaml += `        border-radius: ${pagination.styles.item.borderRadius}\n`;
        }
      });
    }

    // Alerts
    if (styles.components.alerts && styles.components.alerts.length > 0) {
      yaml += `\n  alerts:\n`;
      styles.components.alerts.forEach((alert: any) => {
        yaml += `    - variant: ${alert.variant}\n`;
        yaml += `      count: ${alert.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${alert.styles.background}"\n`;
        yaml += `        color: "${alert.styles.color}"\n`;
        yaml += `        border: "${alert.styles.border}"\n`;
        yaml += `        padding: ${alert.styles.padding}\n`;
      });
    }

    // Search Bars
    if (styles.components.searchBars && styles.components.searchBars.length > 0) {
      yaml += `\n  search-bars:\n`;
      styles.components.searchBars.forEach((search: any) => {
        yaml += `    - count: ${search.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${search.styles.background}"\n`;
        yaml += `        border: "${search.styles.border}"\n`;
        yaml += `        border-radius: ${search.styles.borderRadius}\n`;
        yaml += `        height: ${search.styles.height}\n`;
        if (search.states && search.states.focus) {
          yaml += `      states:\n`;
          yaml += `        focus:\n`;
          Object.entries(search.states.focus).forEach(([key, value]) => {
            yaml += `          ${key}: "${value}"\n`;
          });
        }
      });
    }

    // Toggles
    if (styles.components.toggles && styles.components.toggles.length > 0) {
      yaml += `\n  toggles:\n`;
      styles.components.toggles.forEach((toggle: any) => {
        yaml += `    - count: ${toggle.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        width: ${toggle.styles.width}\n`;
        yaml += `        height: ${toggle.styles.height}\n`;
        yaml += `        border-radius: ${toggle.styles.borderRadius}\n`;
        yaml += `        background: "${toggle.styles.background}"\n`;
      });
    }

    // Dividers
    if (styles.components.dividers && styles.components.dividers.length > 0) {
      yaml += `\n  dividers:\n`;
      styles.components.dividers.forEach((divider: any) => {
        yaml += `    - count: ${divider.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        border-top: "${divider.styles.borderTop}"\n`;
        yaml += `        height: ${divider.styles.height}\n`;
        yaml += `        margin: ${divider.styles.margin}\n`;
      });
    }
  }

  // Gradients
  if (styles.gradients && styles.gradients.length > 0) {
    yaml += `\ngradients:\n`;
    styles.gradients.slice(0, 5).forEach((gradient: any) => {
      yaml += `  - type: ${gradient.type}\n`;
      yaml += `    count: ${gradient.count}\n`;
      yaml += `    value: "${gradient.value.substring(0, 100)}${gradient.value.length > 100 ? '...' : ''}"\n`;
    });
    yaml += `\n`;
  }

  // Flexbox Patterns
  if (styles.flexboxPatterns && styles.flexboxPatterns.length > 0) {
    yaml += `flexbox-patterns:\n`;
    styles.flexboxPatterns.slice(0, 10).forEach((pattern: any) => {
      yaml += `  - flex-direction: ${pattern.flexDirection}\n`;
      yaml += `    justify-content: ${pattern.justifyContent}\n`;
      yaml += `    align-items: ${pattern.alignItems}\n`;
      yaml += `    gap: ${pattern.gap || '0px'}\n`;
      yaml += `    flex-wrap: ${pattern.flexWrap}\n`;
      yaml += `    usage-count: ${pattern.count}\n`;
    });
    yaml += `\n`;
  }

  // Component Composition
  if (styles.componentComposition && styles.componentComposition.length > 0) {
    yaml += `component-composition:\n`;
    yaml += `  # Common nesting patterns found in the UI\n`;
    styles.componentComposition.forEach((comp: any) => {
      yaml += `  - pattern: ${comp.pattern}\n`;
      yaml += `    count: ${comp.count}\n`;
      yaml += `    description: "${comp.description}"\n`;
    });
    yaml += `\n`;
  }

  // Specialized Components
  if (styles.components) {
    let hasSpecialized = false;

    // Skeletons
    if (styles.components.skeletons && styles.components.skeletons.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  skeletons:\n`;
      styles.components.skeletons.forEach((skeleton: any) => {
        yaml += `    - variant: ${skeleton.variant}\n`;
        yaml += `      count: ${skeleton.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${skeleton.styles.background}"\n`;
        yaml += `        height: ${skeleton.styles.height}\n`;
        yaml += `        border-radius: ${skeleton.styles.borderRadius}\n`;
        if (skeleton.styles.animation !== 'none') yaml += `        animation: "${skeleton.styles.animation}"\n`;
      });
    }

    // Empty States
    if (styles.components.emptyStates && styles.components.emptyStates.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  empty-states:\n`;
      styles.components.emptyStates.forEach((empty: any) => {
        yaml += `    - count: ${empty.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        text-align: ${empty.styles.textAlign}\n`;
        yaml += `        padding: ${empty.styles.padding}\n`;
        yaml += `        color: "${empty.styles.color}"\n`;
      });
    }

    // Date Pickers
    if (styles.components.datePickers && styles.components.datePickers.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  date-pickers:\n`;
      styles.components.datePickers.forEach((picker: any) => {
        yaml += `    - count: ${picker.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${picker.styles.background}"\n`;
        yaml += `        border: "${picker.styles.border}"\n`;
        yaml += `        height: ${picker.styles.height}\n`;
      });
    }

    // Color Pickers
    if (styles.components.colorPickers && styles.components.colorPickers.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  color-pickers:\n`;
      styles.components.colorPickers.forEach((picker: any) => {
        yaml += `    - count: ${picker.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        width: ${picker.styles.width}\n`;
        yaml += `        height: ${picker.styles.height}\n`;
      });
    }

    // Rich Text Editors
    if (styles.components.richTextEditors && styles.components.richTextEditors.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  rich-text-editors:\n`;
      styles.components.richTextEditors.forEach((editor: any) => {
        yaml += `    - count: ${editor.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${editor.styles.background}"\n`;
        yaml += `        border: "${editor.styles.border}"\n`;
        yaml += `        padding: ${editor.styles.padding}\n`;
        yaml += `        min-height: ${editor.styles.minHeight}\n`;
      });
    }

    // Sliders
    if (styles.components.sliders && styles.components.sliders.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  sliders:\n`;
      styles.components.sliders.forEach((slider: any) => {
        yaml += `    - count: ${slider.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        width: ${slider.styles.width}\n`;
        yaml += `        height: ${slider.styles.height}\n`;
        yaml += `        background: "${slider.styles.background}"\n`;
      });
    }

    // Comboboxes
    if (styles.components.comboboxes && styles.components.comboboxes.length > 0) {
      if (!hasSpecialized) {
        yaml += `specialized-components:\n`;
        hasSpecialized = true;
      }
      yaml += `  comboboxes:\n`;
      styles.components.comboboxes.forEach((combo: any) => {
        yaml += `    - count: ${combo.count}\n`;
        yaml += `      styles:\n`;
        yaml += `        background: "${combo.styles.background}"\n`;
        yaml += `        border: "${combo.styles.border}"\n`;
        yaml += `        height: ${combo.styles.height}\n`;
        if (combo.states && combo.states.focus) {
          yaml += `      states:\n`;
          yaml += `        focus:\n`;
          Object.entries(combo.states.focus).forEach(([key, value]) => {
            yaml += `          ${key}: "${value}"\n`;
          });
        }
      });
    }

    if (hasSpecialized) yaml += `\n`;
  }

  // Responsive Breakpoints
  if (styles.responsive && styles.responsive.breakpoints && styles.responsive.breakpoints.length > 0) {
    yaml += `responsive:\n`;
    yaml += `  breakpoints:\n`;
    styles.responsive.breakpoints.forEach((bp: any) => {
      yaml += `    - width: ${bp.width}px\n`;
      yaml += `      name: "${bp.name}"\n`;
      yaml += `      type: ${bp.type}\n`;
      yaml += `      usage-count: ${bp.queryCount}\n`;
    });
    yaml += `  total-media-queries: ${styles.responsive.totalMediaQueries}\n`;
    yaml += `\n`;
  }

  // Scrollbar Styles
  if (styles.scrollbars && styles.scrollbars.length > 0) {
    yaml += `scrollbars:\n`;
    styles.scrollbars.forEach((scrollbar: any) => {
      yaml += `  - selector: "${scrollbar.selector}"\n`;
      yaml += `    styles:\n`;
      Object.entries(scrollbar.styles).forEach(([key, value]) => {
        yaml += `      ${key}: "${value}"\n`;
      });
    });
    yaml += `\n`;
  }

  return yaml;
}

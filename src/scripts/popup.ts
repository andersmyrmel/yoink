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
  markdownPreview.textContent = yaml;
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
  if (styles.typographyContext?.typeScale) {
    yaml += `  detected-pattern: "${styles.typographyContext.typeScale.ratioName}"\n`;
    yaml += `  confidence: ${styles.typographyContext.typeScale.confidence}\n`;
  }
  yaml += `\n`;

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

  // Handle both old (array) and new (ShadowSystem object) shadow formats
  if (styles.shadows) {
    if (Array.isArray(styles.shadows) && styles.shadows.length > 0) {
      markdown += generateShadowsSection(styles.shadows);
    } else if (typeof styles.shadows === 'object' && !Array.isArray(styles.shadows)) {
      // New ShadowSystem format
      markdown += generateShadowsSection(styles.shadows);
    }
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
 * Generates elevation/shadow system section
 */
function generateShadowsSection(shadowSystem: any): string {
  let section = `## 🌑 Elevation Scale (Shadows)\n\n`;

  // Check if we have the new shadow system structure
  if (!shadowSystem || typeof shadowSystem === 'string' || Array.isArray(shadowSystem)) {
    // Fallback for old format (array of shadow strings)
    const shadows = Array.isArray(shadowSystem) ? shadowSystem : [];
    if (shadows.length === 0) {
      section += `_No shadows detected on this page._\n\n`;
      return section;
    }

    shadows.forEach((shadow, index) => {
      section += `- **Shadow ${index + 1}**: \`${shadow}\`\n`;
    });
    section += `\n`;
    return section;
  }

  // New shadow system format
  const { elevationLevels, pattern, totalUniqueShadows } = shadowSystem;

  if (!elevationLevels || elevationLevels.length === 0) {
    section += `_No shadows detected on this page._\n\n`;
    return section;
  }

  // System overview
  section += `**Pattern Detected:** ${pattern}\n`;
  section += `**Total Unique Shadows:** ${totalUniqueShadows}\n`;
  section += `**Elevation Levels:** ${elevationLevels.length}\n\n`;

  section += `### Elevation Levels\n\n`;

  // Display each elevation level
  elevationLevels.forEach((level: any) => {
    const emoji = getElevationEmoji(level.elevationLevel);
    section += `#### ${emoji} Level ${level.elevationLevel}: ${level.name}\n\n`;

    section += `**Usage:** ${level.count} element${level.count !== 1 ? 's' : ''}\n\n`;

    // Show representative shadow
    section += `**CSS:**\n\`\`\`css\n`;
    section += `box-shadow: ${level.representative};\n`;
    section += `\`\`\`\n\n`;

    // Show parsed details
    if (level.shadows && level.shadows.length > 0) {
      const shadow = level.shadows[0];
      section += `**Details:**\n`;
      section += `- Blur: \`${shadow.blur}px\`\n`;
      section += `- Offset: \`${shadow.offsetX}px ${shadow.offsetY}px\`\n`;
      if (shadow.spread !== 0) {
        section += `- Spread: \`${shadow.spread}px\`\n`;
      }
      section += `- Color: \`${shadow.color}\`\n`;
      if (shadow.inset) {
        section += `- Inset: Yes\n`;
      }
      section += `\n`;
    }

    // Show variants if multiple similar shadows exist
    if (level.shadows.length > 1) {
      section += `<details>\n`;
      section += `<summary>📊 ${level.shadows.length - 1} similar variant${level.shadows.length > 2 ? 's' : ''} (click to expand)</summary>\n\n`;

      level.shadows.slice(1).forEach((shadow: any, idx: number) => {
        section += `**Variant ${idx + 1}:**\n`;
        section += `\`\`\`css\nbox-shadow: ${shadow.raw};\n\`\`\`\n`;
      });

      section += `</details>\n\n`;
    }
  });

  // Usage recommendations
  section += `### 💡 Usage Recommendations\n\n`;
  section += `- **Level 0 (None)**: Default state, flat elements\n`;
  section += `- **Level 1 (Subtle)**: Hover states, slight elevation\n`;
  section += `- **Level 2 (Moderate)**: Cards, buttons, raised elements\n`;
  section += `- **Level 3 (Strong)**: Dropdowns, popovers, floating panels\n`;
  section += `- **Level 4 (Heavy)**: Modals, dialogs, important overlays\n`;
  section += `- **Level 5 (Extra Heavy)**: Full-page overlays, high-priority alerts\n\n`;

  section += `---\n\n`;
  return section;
}

/**
 * Gets emoji for elevation level
 */
function getElevationEmoji(level: number): string {
  const emojis = ['⚪', '🔵', '🟢', '🟡', '🟠', '🔴'];
  return emojis[level] || '⚫';
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
 * Generates enhanced typography context section
 */
function generateTypographyContextSection(typography: any): string {
  let section = `## 📐 Typography System\n\n`;

  // Type Scale Analysis (NEW!)
  if (typography.typeScale) {
    const scale = typography.typeScale;
    section += `### 📊 Type Scale Analysis\n\n`;
    section += `**Base Size:** \`${scale.baseSize}px\`\n`;
    section += `**Scale Ratio:** ${scale.ratioName}\n`;
    section += `**Confidence:** ${scale.confidence.charAt(0).toUpperCase() + scale.confidence.slice(1)}\n\n`;

    if (scale.scale && scale.scale.length > 0) {
      section += `**Detected Scale:**\n`;
      scale.scale.forEach((size: number) => {
        const multiplier = (size / scale.baseSize).toFixed(2);
        section += `- ${size}px (${multiplier}x base)\n`;
      });
      section += `\n`;
    }
  }

  // Line-Height Patterns (NEW!)
  if (typography.lineHeightPatterns && typography.lineHeightPatterns.length > 0) {
    section += `### 📏 Line-Height Patterns\n\n`;
    typography.lineHeightPatterns.forEach((pattern: any) => {
      section += `- **${pattern.value}** (ratio: ${pattern.ratio}) - ${pattern.usage}\n`;
      section += `  - Used ${pattern.count} time${pattern.count !== 1 ? 's' : ''}\n`;
    });
    section += `\n`;
  }

  // Heading Hierarchy
  section += `### 🔠 Heading Hierarchy\n\n`;

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
      const countText = heading.count ? ` (${heading.count} instance${heading.count !== 1 ? 's' : ''})` : '';

      section += `#### ${displayName}${countText}\n\n`;
      section += `- **Size:** \`${heading.fontSize}\`\n`;
      section += `- **Weight:** \`${heading.fontWeight}\`\n`;
      section += `- **Line Height:** \`${heading.lineHeight}\`\n`;
      section += `- **Color:** \`${heading.color}\`\n`;
      if (heading.examples && heading.examples.length > 0) {
        section += `- **Example:** "${heading.examples[0]}"\n`;
      }
      section += `\n`;
    }
  }

  if (!headingsFound) {
    section += `_No headings detected on this page._\n\n`;
  }

  // Body Text - Organized by Category (IMPROVED!)
  if (typography.body && typography.body.length > 0) {
    section += `### 📝 Body Text Styles\n\n`;

    // Group body text by category
    const categories = {
      'UI': [] as any[],
      'Content': [] as any[],
      'Caption': [] as any[],
      'Label': [] as any[],
      'Other': [] as any[]
    };

    typography.body.forEach((bodyStyle: any) => {
      const usage = bodyStyle.usage || 'Body text';
      if (usage.startsWith('UI:')) categories.UI.push(bodyStyle);
      else if (usage.startsWith('Content:')) categories.Content.push(bodyStyle);
      else if (usage.startsWith('Caption:') || usage.includes('Caption/Meta')) categories.Caption.push(bodyStyle);
      else if (usage.startsWith('Label:')) categories.Label.push(bodyStyle);
      else categories.Other.push(bodyStyle);
    });

    // Display each category
    for (const [category, styles] of Object.entries(categories)) {
      if (styles.length === 0) continue;

      section += `#### ${category} Text\n\n`;
      styles.forEach((bodyStyle: any) => {
        const label = bodyStyle.usage || 'Body text';
        const instanceText = bodyStyle.count ? ` (${bodyStyle.count} instance${bodyStyle.count !== 1 ? 's' : ''})` : '';

        section += `**${label}:**${instanceText}\n`;
        section += `- Size: \`${bodyStyle.fontSize}\`, Weight: \`${bodyStyle.fontWeight}\`, Line Height: \`${bodyStyle.lineHeight}\`\n`;
        section += `- Color: \`${bodyStyle.color}\`\n`;
        if (bodyStyle.tag) {
          section += `- Element: \`<${bodyStyle.tag}>\`\n`;
        }
        if (bodyStyle.examples && bodyStyle.examples.length > 0) {
          section += `- Example: "${bodyStyle.examples[0]}"\n`;
        }
        section += `\n`;
      });
    }
  }

  section += `---\n\n`;
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

  // Spacing Scale (NEW!)
  if (layout.spacingScale) {
    const scale = layout.spacingScale;
    section += `### 📐 Spacing Scale\n\n`;
    section += `**Base Unit:** \`${scale.baseUnit}\`\n`;
    section += `**Pattern:** ${scale.pattern}\n`;
    section += `**Unique Values Found:** ${scale.totalUniqueValues}\n\n`;

    if (scale.recommendation) {
      section += `💡 *${scale.recommendation}*\n\n`;
    }

    section += `**Scale Values:**\n\n`;
    scale.spacingScale.forEach((spacing: any) => {
      section += `- **${spacing.value}** (${spacing.count} uses) - ${spacing.usage}\n`;

      // Show contexts if available and not too many
      if (spacing.contexts && spacing.contexts.length > 0 && spacing.contexts.length <= 3) {
        const contextStr = spacing.contexts.join(', ');
        section += `  *Used in: ${contextStr}*\n`;
      }
    });
    section += `\n`;
  }

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

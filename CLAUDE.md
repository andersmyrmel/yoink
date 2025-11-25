# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Yoink is a cross-browser extension for Chrome and Firefox that extracts design systems from websites and outputs them as structured YAML. The YAML is optimised for AI coding assistants like Claude to understand and replicate design patterns.

**Core Purpose**: Allow users to "yoink" a website's design system (colors, typography, spacing, components, animations, etc.) and paste it into Claude to build matching UIs.

**Privacy First**: All processing happens locally in the browser. Zero network requests, no data collection, no analytics.

**Browser Support**: The extension uses Manifest V3 and is fully compatible with both Chrome and Firefox (109+). All browser APIs used (`chrome.runtime`, `chrome.tabs`, `chrome.scripting`) are supported identically by both browsers, requiring no compatibility layer. However, Firefox requires a different manifest format for background scripts (using `scripts` array instead of `service_worker`), so separate manifests are maintained for each browser.

## Build Commands

```bash
# Development
npm install             # Install dependencies
npm run build           # Full build for Chrome (compile TS → bundle with esbuild → copy assets)
npm run build:firefox   # Full build for Firefox (uses Firefox-specific manifest)
npm run dev             # Clean + build + watch mode (Chrome)
npm run dev:firefox     # Clean + build:firefox + watch mode (Firefox)
npm run watch           # Watch TypeScript files for changes

# Quality checks
npm run typecheck       # Type check without emitting files
npm run lint            # Lint TypeScript files
npm run lint:fix        # Auto-fix linting issues
npm run check           # Run both typecheck and lint

# Production
npm run clean            # Remove dist directory
npm run package          # Build and create zip for Chrome Web Store
npm run package:firefox  # Build and create zip for Firefox Add-ons

# Individual build steps (usually not needed directly)
npm run compile      # TypeScript compilation only
npm run bundle       # esbuild bundling only
npm run copy-assets  # Copy HTML, CSS, icons, Chrome manifest
npm run copy-assets-firefox  # Copy HTML, CSS, icons, Firefox manifest
```

**Important:** Use `build:firefox` (not `build`) when developing for Firefox, as it uses a different manifest format.

## Architecture

### Extension Structure

The extension follows Manifest V3 architecture (compatible with both Chrome and Firefox) with three main contexts:

1. **Content Script** (`src/scripts/contentScript.ts`)
   - Injected into web pages at `document_idle`
   - Orchestrates all extraction modules
   - Listens for `scanStyles` messages from popup
   - Returns extracted design system data
   - Uses DOM caching to scan page only once per extraction

2. **Background Service Worker** (`src/scripts/background.ts`)
   - Minimal implementation (MV3 requirement)
   - Currently handles installation events and basic messaging
   - Runs as ES module

3. **Popup UI** (`src/scripts/popup.ts`, `src/popup.html`, `src/styles/popup.css`)
   - Compact single-page interface
   - "Scan Page" button triggers extraction
   - Checkbox to include/exclude component detection (faster without)
   - Displays YAML preview
   - Copy to clipboard and download buttons
   - Generates YAML from extracted data using `generateYAML()`

### Extraction Module System

All extraction logic is modular and located in `src/scripts/extraction/`:

**Core Extractors:**
- `styleExtractor.ts` - CSS custom properties, colors, border radius, shadows
- `typographyExtractor.ts` - Fonts, type scales, headings, body text, line heights
- `layoutExtractor.ts` - Containers, grids, flexbox, z-index, spacing patterns
- `animationExtractor.ts` - Transitions, durations, easing functions
- `domExtractor.ts` - Hierarchical DOM tree with semantic attributes
- `miscExtractors.ts` - Icons, gradients, responsive breakpoints, scrollbars

**Component Detection** (`src/scripts/extraction/components/`):
- `index.ts` - Main entry point that aggregates all component types
- `interactionComponents.ts` - Buttons, tabs, accordions, toggles
- `formComponents.ts` - Inputs, search bars, date/color pickers, comboboxes
- `contentComponents.ts` - Cards, badges, avatars, dividers, skeletons
- `feedbackComponents.ts` - Modals, tooltips, alerts, progress bars
- `navigationComponents.ts` - Navigation menus, breadcrumbs, pagination

Each component extractor detects variants, counts occurrences, extracts styles, and captures interactive states (hover, focus, active, disabled).

**Utilities** (`src/scripts/utils/`):
- `domCache.ts` - Performance optimization: scan DOM once, reuse results
- `domFilters.ts` - Filter out noise (browser extensions, Tailwind utilities)
- `componentHelpers.ts` - Shared logic for component detection
- `styleHelpers.ts` - Style computation and comparison utilities
- `textProcessor.ts` - Text content extraction and sanitization

### Data Flow

1. User clicks "Scan Page" in popup
2. Popup sends `scanStyles` message to content script via `chrome.tabs.sendMessage`
3. Content script calls `extractStyles(includeComponents)`
4. Content script clears caches and initializes DOM cache
5. All extractors run in parallel, using cached DOM elements
6. Content script returns `StyleExtraction` object
7. Popup receives data and calls `generateYAML()`
8. YAML is displayed, ready to copy or download

### YAML Generation Philosophy

The YAML output is designed for AI comprehension:
- **Hierarchical structure**: Follows design system mental models
- **Usage statistics**: Includes counts to show importance/frequency
- **Semantic naming**: Uses terms like "elevation levels" not just "shadows"
- **Pattern detection**: Identifies scales, ratios, and systems (e.g., "Golden Ratio typography scale")
- **Context preservation**: Shows how elements relate (color pairings, component composition)
- **Compact but complete**: Balances detail with readability

Key sections in YAML output:
- `metadata` - URL, viewport, detected patterns
- `dom-structure` - Hierarchical component tree (if components enabled)
- `colors` - Extracted colors with usage counts + CSS variables
- `typography` - Type scale, fonts, headings, body text, line heights
- `spacing` - Base unit, scale pattern, usage stats
- `shadows` - Elevation system (subtle to extra heavy)
- `layout` - Containers, grids, sidebars, fixed elements
- `z-index` - Layered by purpose (base, dropdown, modal, toast)
- `animations` - Durations, easings, transition patterns
- `icons` - SVG patterns, icon fonts, sizes
- `components` - 30+ component types with variants and states
- `flexbox-patterns` - Common flex configurations
- `component-composition` - Nesting patterns
- `responsive` - Breakpoints and media queries

## TypeScript Configuration

- **Target**: ES2020 (modern browser features)
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Partially enabled (strict function types, no unused vars/params, no implicit returns)
- **Notable**: `noImplicitAny` and `strictNullChecks` are disabled for flexibility
- **Types**: Uses `@types/chrome` for extension APIs

## Build Process Details

### Browser-Specific Manifests

The project maintains two separate manifest files:

- **`manifest.json`** - Chrome manifest using `service_worker` for background scripts
- **`manifest.firefox.json`** - Firefox manifest using `scripts` array for background scripts

This is necessary because Firefox's Manifest V3 implementation still requires the `background.scripts` array format, while Chrome requires `background.service_worker`. The build process automatically copies the correct manifest based on the target browser.

### Build Steps

1. **Compile** (`tsc`): TypeScript → JavaScript in `dist/`
2. **Bundle** (`esbuild`): Three separate bundles to handle different contexts
   - `contentScript.js` - IIFE format (browser environment)
   - `background.js` - IIFE format (service worker compatible with both browsers)
   - `popup.js` - IIFE format (browser environment)
3. **Copy Assets**: HTML, CSS, icons, logo, and browser-specific manifest to `dist/`

The bundling step is critical because it resolves imports and creates single-file bundles that Chrome can load.

## Development Notes

### Loading Extension in Chrome

After building:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

When developing, run `npm run dev` and reload the extension in Chrome after code changes.

### Performance Considerations

- **DOM Cache**: `domCache.ts` scans the page once and stores results. All extractors reuse this cache.
- **Lazy Evaluation**: Component detection is optional (checkbox) because it's more expensive
- **Filtering**: Aggressively filters noise (Tailwind utilities, browser extension CSS vars, generic values)
- **Thresholds**: Uses constants in `src/scripts/constants/thresholds.ts` to limit result sizes

### Extension Permissions

Minimal permissions required:
- `activeTab` - Access current tab content only when extension is clicked
- `scripting` - Inject content script to extract styles
- `clipboardWrite` - Copy YAML to clipboard

### Common Patterns

**Adding a new extractor:**
1. Create function in appropriate file under `src/scripts/extraction/`
2. Import and call from `contentScript.ts` in `extractStyles()`
3. Add return type to `StyleExtraction` interface in `src/scripts/types/extraction.ts`
4. Update `generateYAML()` in `popup.ts` to format the new data

**Adding a new component type:**
1. Add detector function in appropriate file under `src/scripts/extraction/components/`
2. Export from `components/index.ts`
3. Call from `extractComponents()` in `components/index.ts`
4. Add to `ComponentPatterns` type
5. Add YAML formatting in `generateYAML()`

**Modifying YAML output:**
- All YAML generation happens in `popup.ts` in the `generateYAML()` function
- Use consistent indentation (2 spaces)
- Include usage counts for prioritization
- Limit array lengths to avoid overwhelming output (typically 3-10 items)

### Testing in Production

When testing on real websites:
- Check Console for errors (F12 → Console)
- Test on various sites (marketing sites, web apps, design system docs)
- Verify filtering works (no Tailwind utilities, no extension CSS)
- Confirm component detection accuracy
- Check YAML validity (paste into YAML parser if unsure)

### Type Safety

Types are defined in:
- `src/types/index.ts` - Legacy types (mostly unused)
- `src/scripts/types/extraction.ts` - Main extraction types

The codebase uses TypeScript but with relaxed settings for rapid development. Focus on adding types for new public APIs and exported functions.

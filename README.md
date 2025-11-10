# Yoink

Extract any website's design system into structured YAML that you can feed directly to AI coding assistants like Claude.

## Why?

You see a website with great design. You want your AI coding assistant to build something that matches it. But describing colors, spacing, and component styles in words is tedious and error-prone.

**Yoink solves this:** Scan any page, get a complete design system in YAML format, paste it into Claude or your AI assistant, and tell it "build this but make it match this design system."

## How it works

1. Visit any website (Stripe, Linear, GitHub, etc.)
2. Click the Yoink extension
3. Click "Scan Page Styles"
4. Copy the YAML output
5. Paste into Claude: "Build a dashboard using this design system..."

Your AI assistant now has exact colors, spacing, shadows, typography - everything it needs to match the design.

## What it extracts

- **Colors** - Full palette with CSS variables and usage counts
- **Typography** - Fonts, sizes, weights, line heights
- **Spacing** - Padding/margin scale (4px, 8px systems, etc.)
- **Shadows** - Complete elevation system
- **Components** - Buttons, inputs, cards, modals, etc. with all their states
- **Layout** - Grids, containers, breakpoints
- **Animations** - Transitions and timing functions

Everything in clean YAML that AI assistants understand perfectly.

## Installation

### Chrome Web Store (coming soon)

Will be available with one-click install once published.

### From source

```bash
git clone https://github.com/andersmyrmel/yoink
cd yoink
npm install
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## Features

- Extracts 30+ component types with interactive states (hover, focus, disabled)
- Detects light/dark theme variants automatically
- Identifies Material Design patterns and elevation systems
- Smart filtering (removes browser extension and utility CSS noise)
- 100% private - runs entirely in your browser, no network requests
- Fast extraction with DOM caching (~300ms on most sites)

## Privacy

- Zero network requests
- No data collection or tracking
- No analytics
- All processing happens locally
- Minimal permissions (only activeTab, scripting, clipboardWrite)
- Open source - audit the code yourself

## Development

```bash
npm run build     # Production build
npm run watch     # Development mode with auto-rebuild
npm run package   # Create distribution ZIP for Chrome Web Store
```

## Tech Stack

- TypeScript for type safety
- Chrome Extension Manifest V3
- esbuild for fast bundling
- Zero runtime dependencies

## License

MIT - See LICENSE file

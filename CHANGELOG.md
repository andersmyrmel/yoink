# Changelog

## [1.0.0] - 2025-11-10

Initial release of Yoink - Design System Extractor

### Features

- Extract design systems from any website into YAML format
- CSS variable extraction with light/dark theme detection
- Color palette extraction with usage tracking
- Typography analysis (fonts, scales, headings, line heights)
- Spacing scale detection with base unit identification
- Shadow elevation system (6 levels from subtle to extra heavy)
- Layout pattern detection (grids, containers, breakpoints, flexbox)
- Component detection (30+ types: buttons, inputs, cards, modals, etc.)
- Component state extraction (hover, focus, active, disabled)
- Icon system analysis (SVG patterns, sizes, icon fonts)
- Animation extraction (transitions, durations, easing functions)
- Z-index hierarchy mapping
- Responsive breakpoint detection
- Material Design pattern recognition
- DOM structure extraction with semantic analysis

### Technical

- Built with TypeScript for type safety
- Chrome Extension Manifest V3
- Modular architecture with 26 source files
- Performance optimized with DOM caching
- Zero network requests - 100% local processing
- No data collection or tracking
- CORS-safe with graceful error handling
- Smart filtering (removes Tailwind utilities and browser extension variables)

### Privacy & Security

- Minimal permissions (activeTab, scripting, clipboardWrite)
- No external dependencies at runtime
- Open source for security auditing
- All processing happens in your browser

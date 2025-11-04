# Yoink - Design System Extractor

**Yoink** is a Chrome extension that scans any web page and extracts its design styles (colors, fonts, spacing) into a clean, organized Markdown design system document.

## Features

- 🎨 **One-Click Style Extraction**: Click a button to scan the current page for design tokens
- 📋 **Copy to Clipboard**: Instantly copy the generated Markdown to your clipboard
- 💾 **Download as .md**: Save the design system as a Markdown file
- 🚀 **No Network Calls**: Everything runs locally in your browser

## Installation

1. **Clone or download this repository** to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable "Developer mode"** using the toggle in the top-right corner
4. **Click "Load unpacked"** button
5. **Select the `yoink` folder** from your local machine
6. The Yoink extension icon should now appear in your Chrome toolbar

## Usage

1. **Navigate to any website** you want to extract styles from
2. **Click the Yoink extension icon** in your Chrome toolbar
3. **Click "Scan Page Styles"** button in the popup
4. Wait a moment while the extension analyzes the page
5. **Review the extracted design system** in the popup
6. Choose to either:
   - **Copy to Clipboard**: Click the "📋 Copy" button
   - **Download .md File**: Click the "💾 Download" button

## Project Structure

```
yoink/
├── manifest.json          # Extension configuration (Chrome MV3)
├── popup.html             # Extension popup UI
├── popup.css              # Popup styling
├── popup.js               # Popup logic (triggers scan, handles copy/download)
├── contentScript.js       # Injected script that extracts page styles
├── background.js          # Service worker for message passing
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## How It Works

1. **User clicks "Scan Page Styles"** in the popup
2. **popup.js sends a message** to the content script via Chrome's messaging API
3. **contentScript.js analyzes the page**:
   - Extracts colors from computed styles
   - Identifies font families and sizes
   - Detects spacing patterns (margins, padding)
   - Captures border radius values
   - Identifies box shadows
4. **Results are sent back** to the popup
5. **popup.js generates a Markdown document** with organized design tokens
6. **User can copy or download** the generated Markdown

## Future Enhancements (Part 2+)

- AI-powered component code generation
- More sophisticated style extraction algorithms
- CSS variable detection
- Component library generation
- Export to other formats (JSON, CSS, Tailwind config)

## Development

This extension uses vanilla JavaScript, HTML, and CSS with no external dependencies.

To modify the extension:
1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Yoink extension card
4. Test your changes

## License

MIT License - Feel free to use and modify as needed!

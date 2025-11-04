# Yoink - Design System Extractor

**Yoink** is a Chrome extension that scans any web page and extracts its design system tokens into a clean, organized Markdown document.

## ✨ Features

- 🎨 **CSS Variable Extraction**: Captures semantic CSS custom properties with theme variants
- 🌓 **Dark Mode Detection**: Automatically detects and shows light/dark theme values
- 📊 **Usage Tracking**: Shows how many elements use each color
- 🔍 **Duplicate Detection**: Identifies CSS variables with the same color values
- 📋 **Copy to Clipboard**: Instantly copy the generated Markdown
- 💾 **Download as .md**: Save the design system as a Markdown file
- 🚀 **No Network Calls**: Everything runs locally in your browser

## 🚀 Installation

### From Source

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd yoink
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist/` folder

## 📖 Usage

1. Navigate to any website (e.g., https://ui.shadcn.com)
2. Click the Yoink extension icon in your toolbar
3. Click "Scan Page Styles"
4. Review the extracted design tokens
5. Copy or download the Markdown output

## 🏗️ Project Structure

```
yoink/
├── src/
│   ├── scripts/
│   │   ├── background.ts      # Service worker
│   │   ├── contentScript.ts   # Page style extraction
│   │   └── popup.ts           # UI and markdown generation
│   ├── styles/
│   │   └── popup.css          # Popup styling
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   └── popup.html             # Popup UI
├── dist/                      # Compiled extension (generated)
├── icons/                     # Extension icons
├── manifest.json              # Chrome extension manifest
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🛠️ Development

### Scripts

- `npm run build` - Build the extension (TypeScript → JavaScript + copy assets)
- `npm run watch` - Watch mode for development
- `npm run clean` - Clean the dist folder
- `npm run package` - Create a zip file for distribution

### Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run build` (or `npm run watch` for auto-rebuild)
3. Go to `chrome://extensions/` and click refresh on the Yoink extension
4. Test your changes

### Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Chrome Extension Manifest V3** - Latest extension format
- **Vanilla JS/HTML/CSS** - No framework dependencies

## 📝 What It Extracts

### CSS Variables
- Brand colors (medical-*, brand-*, company-*)
- Sidebar colors (sidebar-*)
- Chart colors (chart-*, graph-*, data-*)
- Semantic UI colors (background, foreground, primary, etc.)
- Border radius values
- Filters out Tailwind utility variables and browser extension variables

### Computed Values
- Hardcoded colors with usage counts
- Font families
- Box shadows

### Features
- ✅ Light/dark theme detection
- ✅ Usage statistics ("Used in X elements")
- ✅ Duplicate color detection
- ✅ OKLCH/LAB color format support with RGB conversion
- ✅ Alpha channel handling (#rrggbbaa format)

## 📦 Building for Production

```bash
npm run package
```

This creates `yoink-extension.zip` in the root directory, ready for Chrome Web Store submission.

## 🔄 Version History

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.

## 📄 License

MIT License - Feel free to use and modify as needed!

## 🙏 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

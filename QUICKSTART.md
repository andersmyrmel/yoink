# Quick Start Guide

## 🚀 Get Started in 3 Minutes

### Step 1: Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `/Users/anders/Documents/code/yoink` folder
5. You should see the Yoink extension appear with a purple "Y" icon

### Step 2: Test the Extension

1. Navigate to any website (try https://github.com or https://stripe.com for good examples)
2. Click the **Yoink extension icon** in your Chrome toolbar
3. Click the **"Scan Page Styles"** button
4. Wait 1-2 seconds for the scan to complete

### Step 3: Export Your Design System

After scanning, you can:

- **📋 Click "Copy to Clipboard"** - Instantly copy the Markdown
- **💾 Click "Download .md"** - Save as a file (e.g., `design-system-2025-11-04.md`)

## 📁 Project Structure

```
yoink/
├── manifest.json          # Extension config
├── popup.html             # Extension UI
├── popup.css              # UI styles
├── popup.js               # UI logic
├── contentScript.js       # Page analysis
├── background.js          # Service worker
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # Full documentation
```

## 🎯 What Gets Extracted

The extension currently extracts:

- **🎨 Colors**: Background, text, and border colors
- **📝 Typography**: Font families and sizes
- **📏 Spacing**: Margin and padding values
- **🔲 Border Radius**: Rounded corner values
- **🌓 Shadows**: Box shadow effects

## 🛠️ Troubleshooting

### Extension not appearing?
- Make sure Developer mode is enabled
- Try refreshing the extensions page
- Check that you selected the correct folder

### Scan button not working?
- Refresh the web page and try again
- Check the Chrome DevTools console for errors
- Some sites with strict CSP may block content scripts

### No styles showing up?
- Wait a moment for the scan to complete
- Try on a different website
- Open DevTools (F12) > Console to see debug logs

## 🔄 Making Changes

After modifying any files:

1. Go to `chrome://extensions/`
2. Click the **refresh icon** on the Yoink extension card
3. Reload any open web pages
4. Test your changes

## 🎨 Customizing Icons

The default icons are simple placeholders. To replace them:

1. Create your own 16x16, 48x48, and 128x128 PNG images
2. Save them in the `icons/` folder as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
3. Refresh the extension

Or use the included `icons/generate-icons.html` helper:
1. Open `icons/generate-icons.html` in your browser
2. Right-click each canvas and "Save image as..."
3. Save with the correct filenames

## ✨ Next Steps

The extension is ready for Part 2 enhancements:

- Add AI-powered code generation
- Implement more sophisticated style extraction
- Add CSS variable detection
- Generate component code snippets
- Export to different formats (JSON, CSS, Tailwind)

## 📖 Full Documentation

See [README.md](README.md) for complete documentation.

---

**Happy designing! 🎨**

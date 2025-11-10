<p align="center">
  <img src="logo.png" alt="Yoink" width="120">
</p>

<h1 align="center">Yoink</h1>

<p align="center">Extract any website's design system into structured YAML that you can feed directly to AI coding assistants like Claude.</p>

## Why?

You see a website with great design and want your AI coding assistant to build something that matches it. But describing colors, spacing, and component styles in words is tedious and error-prone. Yoink solves this by extracting complete design systems into YAML format that you can paste directly into Claude or your AI assistant.

## How it works

1. Visit any website (Stripe, Linear, GitHub, etc.)
2. Click the Yoink extension
3. Click "Scan Page Styles"
4. Copy the YAML output
5. Paste into Claude: "Build a dashboard using this design system..."

Yoink extracts colors, typography, spacing, shadows, components, layouts, and animations into clean YAML that AI assistants understand perfectly.

## Privacy

Yoink is 100% private. All processing happens locally in your browser with zero network requests, no data collection, and no analytics. It only requires minimal permissions (activeTab, scripting, clipboardWrite) to function. The code is open source so you can audit it yourself.

## Installation

**Chrome Web Store:** Coming soon

**From source:**

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

## License

MIT - See LICENSE file

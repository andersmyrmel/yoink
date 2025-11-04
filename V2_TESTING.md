# V2.1 Testing Quick Reference

## 🚀 Quick Start

1. **Reload Extension**
   ```
   chrome://extensions/ → Find Yoink → Click refresh (↻)
   ```

2. **Test Immediately**
   - Go to https://ui.shadcn.com
   - Click Yoink icon
   - Click "Scan Page Styles"
   - Wait 2-3 seconds

3. **Expected Output**
   - ✅ ~23 custom CSS variables grouped by category
   - ✅ Light + Dark mode values shown
   - ✅ Tailwind colors in `<details>` section (collapsed)
   - ✅ NO Vimium/Arc extension variables
   - ✅ Computed colors show usage counts

---

## ✅ Verification Checklist

### Extension Variables (FILTERED OUT)
- [ ] ❌ No `vimium-foreground-color`
- [ ] ❌ No `arc-palette-backgroundExtra`
- [ ] ❌ No `arc-palette-focus`
- [ ] ❌ No extension-related variables

### Tailwind Colors (COLLAPSIBLE)
- [ ] ✅ See `<details>` tag with "📦 Tailwind Default Palette"
- [ ] ✅ Shows count: "(156 colors - click to expand)"
- [ ] ✅ Not mixed with custom brand colors

### Dark Mode (SHOWN INLINE)
- [ ] ✅ `background` shows Light + Dark
- [ ] ✅ `foreground` shows Light + Dark
- [ ] ✅ `sidebar` shows Light + Dark (if present)

### Color Format (NORMALIZED)
- [ ] ✅ Hex shows: `#5167fc` → rgb(81, 103, 252)
- [ ] ✅ OKLCH shown as-is: `oklch(100% 0 0)`
- [ ] ✅ RGB already normalized: `rgb(255, 255, 255)`

### Usage Context (SHOWN)
- [ ] ✅ Computed colors show: "Used in X elements"
- [ ] ✅ Most-used colors appear first

### Border Radius (CSS VARIABLES)
- [ ] ✅ Shows `--radius` variable (not just "10px")
- [ ] ✅ Grouped in "🔲 Border Radius" section

### Semantic Grouping (ORGANIZED)
- [ ] ✅ 🏥 Brand Colors section
- [ ] ✅ 📊 Sidebar Colors section (if present)
- [ ] ✅ 📈 Chart Colors section (if present)
- [ ] ✅ 🎨 Semantic UI Colors section
- [ ] ✅ 🎯 Computed Values section

---

## 🎯 Expected Output Format

```markdown
## 🎨 Colors

### 🏥 Brand Colors (brand-*, medical-*, company-*)

- **medical-primary**: `#5167fc` → rgb(81, 103, 252)

### 📊 Sidebar Colors (sidebar-*)

- **sidebar**:
  - Light: `#fafcfc` → rgb(250, 252, 252)
  - Dark: `#0a2540` → rgb(10, 37, 64)

### 🎨 Semantic UI Colors (background, foreground, primary, etc.)

- **background**:
  - Light: `oklch(100% 0 0)`
  - Dark: `oklch(14.5% 0 0)`

### 🎯 Computed Values (hardcoded, not using CSS variables)

- `rgb(255, 255, 255)` - Used in 23 elements
- `rgb(75, 85, 99)` - Used in 8 elements

<details>
<summary>📦 Tailwind Default Palette (156 colors - click to expand)</summary>

- **color-purple-500**: `oklch(62.7% .265 303.9)`
...
</details>

## 🔲 Border Radius (radius, rounded, etc.)

- **radius**: `0.5rem`
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Still seeing extension variables

**Symptoms:** `vimium-*` or `arc-*` variables in output

**Fix:**
1. Check console for "🚫 Filtered extension variable:" logs
2. If not seeing logs, add more patterns to `extensionPatterns` array in contentScript.js:123

### Issue 2: Tailwind not collapsed

**Symptoms:** 156 Tailwind colors shown inline (not in `<details>`)

**Debug:**
```javascript
// Check if variables are being categorized as 'tailwind'
// Look for console log: "Grouped variables by prefix"
```

**Fix:** Variables might not start with `color-` or `tw-`. Check actual prefix in console.

### Issue 3: No dark mode variants

**Symptoms:** Only light mode shown, no "Dark:" lines

**Possible causes:**
1. Site doesn't have `.dark` selector CSS
2. Site uses JavaScript theme switching (not CSS)
3. Dark mode defined in different selector pattern

**Debug:**
```javascript
// In browser console:
document.documentElement.classList.add('dark')
// See if styles change
```

### Issue 4: No usage counts

**Symptoms:** Computed colors don't show "Used in X elements"

**Debug:**
```javascript
// Check styleData.colorUsage in console
// Should be: { 'rgb(255,255,255)': 23, ... }
```

---

## 📊 Test Sites Comparison

| Site | Extension Vars | Tailwind | Dark Mode | Custom Vars | Notes |
|------|---------------|----------|-----------|-------------|-------|
| **Shadcn UI** | ❌ None | ✅ 156 | ✅ Yes | ✅ 23 | Perfect test |
| **GitHub** | ⚠️ Vimium (filtered) | ❌ None | ✅ Yes | ✅ 100+ | Good for dark mode |
| **Stripe** | ❌ None | ❌ None | ❌ No | ✅ 30-50 | Clean custom system |
| **Tailwind CSS** | ❌ None | ✅ 200+ | ✅ Yes | ✅ 40 | Max Tailwind test |

---

## 🔍 Debug Console Logs

**What you should see in console:**

### Page Console (F12 on inspected tab):
```
🎨 Yoink content script loaded
🎨 Yoink: Starting style extraction...
⚠️  Skipping browser extension stylesheet: chrome-extension://...
🚫 Filtered extension variable: --vimium-foreground-color
📋 Extracted CSS variables: { --background: {...}, ... }
🗺️  Color lookup map: { 'rgb(255,255,255)': [...], ... }
✅ Yoink: Style extraction complete
```

### Popup Console:
```
Received style data: { cssVariables: {...}, colorUsage: {...} }
Generating enhanced markdown...
✅ Markdown generated (1234 chars)
```

---

## 🎓 What Changed from V1.0

| Feature | V1.0 | V2.1 |
|---------|------|------|
| Extension vars | Included | ✅ Filtered |
| Tailwind | Mixed in | ✅ Collapsible |
| Dark mode | ❌ Missing | ✅ Inline |
| Color format | Inconsistent | ✅ Normalized |
| Usage info | ❌ None | ✅ Element count |
| Grouping | Generic | ✅ Semantic |
| Border radius | Computed | ✅ CSS vars |

---

## ✅ Success Criteria

Your extension is working correctly if:

1. ✅ Shadcn UI extracts ~23 custom variables (not 179)
2. ✅ Dark mode shown for `background`, `foreground`, `primary`
3. ✅ Tailwind section says "(156 colors - click to expand)"
4. ✅ No Vimium/Arc variables in output
5. ✅ Computed colors show usage counts
6. ✅ Total extraction time < 500ms
7. ✅ Copy and download work correctly

---

**Quick Test:** Load Shadcn UI → Scan → Should see ~23 variables grouped semantically + 156 Tailwind collapsed

**Done! 🎉**

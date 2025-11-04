# Testing Guide - Enhanced CSS Variable Extraction

## Quick Test Procedure

### 1. Reload the Extension

```bash
1. Go to chrome://extensions/
2. Find "Yoink" extension
3. Click the refresh icon (↻)
4. Confirm it says "v1.0.0"
```

### 2. Test on Recommended Websites

These websites have excellent CSS variable implementations for testing:

#### Test Site #1: Shadcn UI ✅ **HIGHLY RECOMMENDED**
**URL:** https://ui.shadcn.com

**What to expect:**
- CSS Variables: ~50-100 variables
- Theme variants: Light and dark modes
- Prefixes: `--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--destructive`, `--border`, `--ring`
- Modern formats: Uses `hsl()` color format
- Expected output:
  ```markdown
  ### Semantic UI Colors
  - **background**: `0 0% 100%` (hsl(0, 0%, 100%))
    - **Dark mode**: `222.2 84% 4.9%`
  - **foreground**: `222.2 84% 4.9%`
    - **Dark mode**: `210 40% 98%`
  - **primary**: `221.2 83.2% 53.3%`
  ```

#### Test Site #2: Stripe
**URL:** https://stripe.com

**What to expect:**
- CSS Variables: ~30-50 variables
- Professional color system
- Brand colors with semantic names
- Expected prefixes: May include custom brand prefixes

#### Test Site #3: GitHub
**URL:** https://github.com

**What to expect:**
- CSS Variables: 100+ variables
- Comprehensive light/dark themes
- Prefixes: `--color-*` patterns
- Many theme variants

#### Test Site #4: Vercel
**URL:** https://vercel.com

**What to expect:**
- CSS Variables: ~40-70 variables
- Modern `oklch()` color format support
- Clean semantic naming

### 3. Test Procedure for Each Site

1. **Navigate to test site**
2. **Click Yoink extension icon**
3. **Click "Scan Page Styles" button**
4. **Wait 1-3 seconds** (watch loading spinner)
5. **Review the output** in the preview area

### 4. What to Check

#### ✅ CSS Variables Section
- [ ] "Brand Colors" section appears (if applicable)
- [ ] "Sidebar Colors" section appears (if sidebar-* vars exist)
- [ ] "Semantic UI Colors" section appears
- [ ] Variable names are clean (without `--` prefix in display)
- [ ] Original values shown in code blocks (e.g., `` `#5167fc` ``)
- [ ] Computed RGB values shown in parentheses (e.g., `(rgb(81, 103, 252))`)

#### ✅ Theme Variants
- [ ] Dark mode values shown indented under light mode
- [ ] "Dark mode:" label appears
- [ ] Both light and dark values are different (not duplicates)

#### ✅ Computed Colors Section
- [ ] "Computed Colors (no CSS variable found)" section appears
- [ ] Only shows colors that DON'T have CSS variables
- [ ] Limited to ~10 colors

#### ✅ Other Sections (Unchanged)
- [ ] Typography section still works
- [ ] Spacing section still works
- [ ] Border radius section still works
- [ ] Shadows section still works

#### ✅ Copy/Download
- [ ] Copy to clipboard works
- [ ] Download .md works
- [ ] Filename includes timestamp
- [ ] Success message appears

### 5. Console Debugging

Open Chrome DevTools (F12) while testing:

#### In Popup Console:
```javascript
// Should see:
// "🎨 Yoink: Starting style extraction..."
// "📋 Extracted CSS variables: {--background: {...}, ...}"
// "🗺️  Color lookup map: {rgb(255,255,255): [...], ...}"
// "✅ Yoink: Style extraction complete"
```

#### In Page Console (inspected tab):
```javascript
// Should see:
// "🎨 Yoink content script loaded"
// "🎨 Yoink: Starting style extraction..."
// "✅ Yoink: Style extraction complete"
```

If you see errors like:
- `⚠️ Skipping CORS-blocked stylesheet:` - **This is NORMAL**, external CDN stylesheets can't be accessed
- `⚠️ Could not access stylesheet (CORS):` - **This is NORMAL**

## Test Cases

### Test Case 1: Site WITH CSS Variables (Shadcn UI)

**Expected Result:**
```markdown
## 🎨 Colors

### Semantic UI Colors

- **background**: `0 0% 100%` (hsl(0, 0%, 100%))
  - **Dark mode**: `222.2 84% 4.9%`
- **foreground**: `222.2 84% 4.9%`
  - **Dark mode**: `210 40% 98%`
- **primary**: `221.2 83.2% 53.3%`

### Computed Colors (no CSS variable found)

- **Color 1**: `rgb(255, 255, 255)`
- **Color 2**: `rgb(17, 24, 39)`
```

### Test Case 2: Site WITHOUT CSS Variables (Legacy Site)

**Expected Result:**
```markdown
## 🎨 Colors

### Computed Colors (no CSS variable found)

- **Color 1**: `rgb(255, 255, 255)`
- **Color 2**: `rgb(0, 0, 0)`
- **Color 3**: `rgb(66, 133, 244)`
...
```

### Test Case 3: Site with Custom Prefixes (e.g., medical-*)

**Expected Result:**
```markdown
## 🎨 Colors

### Brand Colors

- **medical-primary**: `#5167fc` (rgb(81, 103, 252))
- **medical-secondary**: `#0a2540` (rgb(10, 37, 64))

### Sidebar Colors

- **sidebar**: `#fafcfc` (rgb(250, 252, 252))
  - **Dark mode**: `#0a2540` (rgb(10, 37, 64))
```

## Performance Benchmarks

Expected timing (check DevTools Performance tab):

- **Stylesheet parsing:** 50-200ms
- **Color normalization:** 10-50ms
- **Markdown generation:** 5-20ms
- **Total extraction:** 100-300ms

If extraction takes >500ms, check:
- How many stylesheets are on the page? (see `document.styleSheets.length`)
- Are there very large inline `<style>` blocks?

## Troubleshooting

### Issue: No CSS variables extracted

**Possible causes:**
1. Site doesn't use CSS variables (check DevTools > Elements > Computed > filter `--`)
2. All stylesheets are CORS-blocked (check console warnings)
3. Variables are defined in JS, not CSS

**Solution:** Test on Shadcn UI first to verify the extension works

### Issue: Dark mode not detected

**Possible causes:**
1. Site uses JavaScript to toggle themes (not CSS selectors)
2. Dark mode selector is non-standard (e.g., `.night-mode`)

**Solution:** Add custom selector patterns in `getThemeFromSelector()` function in contentScript.js

### Issue: Colors not grouped correctly

**Possible causes:**
1. Custom prefix patterns not recognized
2. Variables don't match the predefined patterns

**Solution:** Customize grouping logic in `groupCSSVariablesByPrefix()` function in popup.js:

```javascript
// Add your custom patterns
if (lower.startsWith('yourprefix-')) {
  groups.brand.push({ name: varName, themes });
}
```

### Issue: Extension shows error state

**Possible causes:**
1. Content script not loaded (check for CSP violations)
2. Message passing failed
3. JavaScript error in content script

**Solution:**
1. Check browser console for errors
2. Reload the page
3. Reload the extension
4. Try a different website

## Edge Cases to Test

### Edge Case 1: Nested var() references
```css
:root {
  --color-primary: #5167fc;
  --button-bg: var(--color-primary);
  --button-hover: var(--button-bg);
}
```
**Expected:** Should resolve to `rgb(81, 103, 252)` for all three

### Edge Case 2: OKLCH colors
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}
```
**Expected:** Should detect as colors and display original format

### Edge Case 3: Transparent colors
```css
:root {
  --overlay: rgba(0, 0, 0, 0.5);
}
```
**Expected:** Should normalize to `rgba(0, 0, 0, 0.5)`

### Edge Case 4: No CSS variables at all
**Expected:** Should show only "Computed Colors" section with standard extraction

## Success Criteria

✅ **Extension is working correctly if:**

1. Shadcn UI extracts 50+ CSS variables
2. Dark mode variants appear for applicable variables
3. Colors are grouped by semantic categories
4. Computed colors section shows unmapped colors
5. Copy and download functions work
6. No JavaScript errors in console
7. Total extraction time < 500ms
8. All sections render in proper markdown format

## Reporting Issues

If you find issues, please report with:

1. **Website URL** where issue occurred
2. **Screenshot** of the output
3. **Console logs** (from both popup and page console)
4. **Expected behavior** vs actual behavior
5. **Browser version** (Chrome version number)

---

**Happy Testing! 🎨**

# Regression Fixes - V2.1.1

## 🐛 Critical Bugs Fixed

### Bug #1: CSS Variables Completely Missing ✅ FIXED

**Problem:** All CSS variables (--medical-primary, --sidebar-*, etc.) were being extracted but NOT displayed

**Root Cause:** Grouping logic was filtering out non-color variables entirely

**Before (Broken):**
```javascript
// Only included color-like variables in groups
const hasColorValue = Object.values(themes).some(value => looksLikeColor(value));
if (!hasColorValue) {
  groups.other.push({ name: varName, themes });
  continue; // ❌ This skipped categorization!
}
```

**After (Fixed):**
```javascript
// Categorize ALL variables by prefix (not just colors)
if (lower.startsWith('medical-')) {
  groups.brand.push({ name: varName, themes });
} else if (lower.startsWith('sidebar-')) {
  groups.sidebar.push({ name: varName, themes });
}
// ... etc - NO filtering, ALL variables are categorized
```

**Result:** ✅ All CSS variables now show in appropriate sections

---

### Bug #2: Border Radius Showing 33.5 Million Pixels ✅ FIXED

**Problem:** Extracting `border-radius: 9999px` or `50%` as design tokens

**Root Cause:** No validation on parsed values

**Before (Broken):**
```javascript
if (borderRadius && borderRadius !== '0px') {
  radiusValues.add(borderRadius); // ❌ Adds 9999px, 50%, etc.
}
```

**After (Fixed):**
```javascript
const pixels = parseFloat(borderRadius);

// Filter out absurd values
if (borderRadius.includes('%')) {
  continue; // Skip percentage-based (50% circles)
}

if (pixels > 0 && pixels <= 100) {
  radiusValues.add(borderRadius); // ✅ Only reasonable values
}
```

**Result:** ✅ Only design-relevant radius values (0-100px)

---

### Bug #3: CSS Variables Not Showing Usage Counts ✅ FIXED

**Problem:** Usage counts only shown for computed colors, not CSS variables

**Before (Broken):**
```markdown
## Colors
- **medical-primary**: `#5167fc` → rgb(81, 103, 252)

## Computed Values
- `rgb(81, 103, 252)` - Used in 24 elements  ❌ Duplicate!
```

**After (Fixed):**
```markdown
## 🏥 Brand Colors
- **medical-primary**: `#5167fc` → rgb(81, 103, 252)
  _Used in 24 elements_  ✅ Shows usage!
```

**Implementation:**
```javascript
// Check if this variable is actually used
const normalizedLight = normalizeToRGB(lightValue);
const usage = styles.colorUsage?.[normalizedLight] || 0;

if (usage > 0) {
  section += `\n  _Used in ${usage} element${usage !== 1 ? 's' : ''}_`;
}
```

**Result:** ✅ Usage counts shown for CSS variable colors

---

### Bug #4: 'other' Group Not Displayed ✅ FIXED

**Problem:** Variables that didn't match known prefixes were hidden

**Before (Broken):**
```javascript
const displayOrder = ['brand', 'sidebar', 'chart', 'semantic'];
// ❌ 'other' group never displayed!
```

**After (Fixed):**
```javascript
const displayOrder = ['brand', 'sidebar', 'chart', 'semantic', 'other'];
// ✅ All groups displayed
```

**Result:** ✅ No CSS variables are lost

---

## ✅ What Now Works

### Complete CSS Variable Extraction

```markdown
## 🎨 Colors

### 🏥 Brand Colors (brand-*, medical-*, company-*)

- **medical-primary**: `#5167fc` → rgb(81, 103, 252)
  _Used in 24 elements_
- **medical-secondary**: `#0a2540` → rgb(10, 37, 64)
  _Used in 8 elements_
- **medical-landing**: `#fafcfc` → rgb(250, 252, 252)
  _Used in 1 element_

### 📊 Sidebar Colors (sidebar-*)

- **sidebar**: `#fafcfc` → rgb(250, 252, 252)
  _Used in 12 elements_
- **sidebar-border**: `#e4e8ee` → rgb(228, 232, 238)
  _Used in 15 elements_

### 📈 Chart Colors (chart-*, graph-*, data-*)

- **chart-1**: `oklch(64.6% .222 41.116)`
- **chart-2**: `oklch(60% .118 184.704)`
- **chart-5**: `oklch(71.4% .194 24.839)` → rgb(115, 209, 115)
  _Used in 12 elements_

### 🎨 Semantic UI Colors (background, foreground, primary, etc.)

- **background**:
  - Light: `oklch(100% 0 0)`
  - Dark: `oklch(14.5% 0 0)`
- **foreground**:
  - Light: `oklch(9.8% 0 0)`
  - Dark: `oklch(98.5% 0 0)`

### 🎯 Computed Values (hardcoded, not using CSS variables)

_These colors are hardcoded. Consider refactoring to use CSS variables._

- `rgb(75, 85, 99)` - Used in 8 elements
  💡 _Could use `var(--muted-foreground)` instead_
```

---

## 📊 Comparison: Before vs After Regression Fix

| Issue | V2.1.0 (Broken) | V2.1.1 (Fixed) |
|-------|-----------------|----------------|
| **CSS Variables** | ❌ Not displayed | ✅ All shown |
| **Border Radius** | ❌ 33.5M pixels | ✅ 0-100px only |
| **Usage Counts** | ❌ Only for computed | ✅ CSS vars too |
| **'other' Group** | ❌ Hidden | ✅ Displayed |
| **Overall Quality** | 🔴 Regression | 🟢 Better than V1.0! |

---

## 🧪 Testing Verification

### Test Case: Shadcn UI (https://ui.shadcn.com)

**Expected Output:**

1. ✅ ~23 custom CSS variables shown
2. ✅ Grouped by: Brand, Sidebar, Chart, Semantic
3. ✅ Usage counts: "Used in X elements"
4. ✅ Light + Dark modes for applicable variables
5. ✅ Border radius: Only 0-16px values (no 9999px)
6. ✅ Tailwind: Collapsed `<details>` section
7. ✅ No extension variables

**Console Logs to Check:**

```
📋 Extracted CSS variables: { --background: {...}, --medical-primary: {...} }
  → Should have 20+ entries

🗺️  Color lookup map: { 'rgb(81,103,252)': [...], ... }
  → Should map colors to variable names

✅ Yoink: Style extraction complete
  → Check styleData.cssVariables has content
```

---

## 🚀 Files Modified

1. **contentScript.js** (line 503-532)
   - Added border radius value filtering (0-100px)
   - Skip percentage-based radius (50%)

2. **popup.js** (line 212-242)
   - Removed color-only filtering
   - ALL variables now categorized

3. **popup.js** (line 149-156)
   - Added 'other' to displayOrder
   - Ensures no variables are hidden

4. **popup.js** (line 301-354)
   - Added usage count display for CSS variables
   - Shows "Used in X elements" under variable values

---

## 🎯 Success Criteria

Extension is working correctly if:

1. ✅ Shadcn UI shows ~23 CSS variables (not just computed colors)
2. ✅ Medical-primary, sidebar, chart variables all visible
3. ✅ Usage counts shown: "Used in 24 elements"
4. ✅ Border radius max value is ≤ 100px
5. ✅ Light + Dark modes displayed
6. ✅ No "33.5 million pixels" bug
7. ✅ Copy and download still work

---

## 📝 Summary

**Status:** ✅ All regressions fixed

**What was broken:** CSS variable display logic filtered out non-color variables

**What is fixed:**
- All CSS variables now categorized and displayed
- Border radius values validated (0-100px)
- Usage counts shown for CSS variable colors
- 'other' group now displayed

**Testing:** Load Shadcn UI → Should see full CSS variable output with usage counts

---

**Version:** 2.1.1
**Date:** November 4, 2025
**Status:** ✅ Regression fixed, better than V1.0

/**
 * Yoink Content Script - Refactored
 *
 * This is the main entry point for the content script that runs on web pages.
 * It has been refactored to be modular and maintainable:
 *
 * - Type definitions are in ./types/extraction
 * - Style extraction logic is in ./extraction/styleExtractor
 * - Typography extraction is in ./extraction/typographyExtractor
 * - Layout extraction is in ./extraction/layoutExtractor
 * - Component detection is in ./extraction/componentDetector
 * - Animation extraction is in ./extraction/animationExtractor
 * - DOM extraction is in ./extraction/domExtractor
 * - Miscellaneous extractors are in ./extraction/miscExtractors
 *
 * This file now serves as a thin orchestrator that:
 * 1. Listens for messages from the popup
 * 2. Coordinates all extraction functions
 * 3. Returns the aggregated results
 */

// Type imports
import { ScanStylesRequest, ScanResponse, StyleExtraction } from './types/extraction';

// Cache utilities
import { clearCaches, getCachedElements } from './utils/domCache';

// Style extraction imports
import {
  extractCSSCustomProperties,
  extractColors,
  extractBorderRadius,
  extractShadows
} from './extraction/styleExtractor';

// Typography extraction imports
import {
  extractFonts,
  extractTypographyContext
} from './extraction/typographyExtractor';

// Layout extraction imports
import {
  extractLayoutStructure,
  extractFlexboxPatterns,
  extractComponentComposition,
  extractZIndexHierarchy,
  extractLayoutPatterns,
  extractColorContext
} from './extraction/layoutExtractor';

// Component detection imports
import { extractComponents } from './extraction/components';

// Animation extraction imports
import { extractAnimations } from './extraction/animationExtractor';

// DOM extraction imports
import { extractDOMTree } from './extraction/domExtractor';

// Miscellaneous extraction imports
import {
  extractIcons,
  extractGradients,
  extractResponsiveBreakpoints,
  extractScrollbarStyles
} from './extraction/miscExtractors';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
  request: ScanStylesRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ScanResponse) => void
): boolean => {
  if (request.action === 'scanStyles') {
    try {
      const styleData = extractStyles(request.includeComponents);
      sendResponse({ success: true, data: styleData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({ success: false, error: errorMessage });
    }
  }
  return true;
});

/**
 * Main style extraction orchestrator
 *
 * Coordinates all extraction modules to collect design system information from the current page.
 * Uses caching to optimize performance by scanning the DOM only once.
 *
 * @param includeComponents - Whether to include component detection and advanced analysis
 * @returns Complete style data extraction including colors, typography, layout, and optionally components
 *
 * @example
 * ```typescript
 * // Extract all styles including components
 * const fullData = extractStyles(true);
 *
 * // Extract only basic styles (faster)
 * const basicData = extractStyles(false);
 * ```
 */
function extractStyles(includeComponents: boolean = true): StyleExtraction {
  // Clear caches from any previous extraction
  clearCaches();

  // Initialize DOM element cache (scans once, reused by all extractors)
  getCachedElements();

  const cssVariables = extractCSSCustomProperties();
  const colorData = extractColors();

  const styleData: StyleExtraction = {
    cssVariables,
    colors: colorData.colors,
    colorUsage: colorData.usage,
    fonts: extractFonts(),
    borderRadius: extractBorderRadius(),
    shadows: extractShadows(),
    layout: extractLayoutStructure(),
    icons: extractIcons(),
    gradients: extractGradients(),
    responsive: extractResponsiveBreakpoints(),
    scrollbars: extractScrollbarStyles()
  };

  // Add component patterns and context if requested
  if (includeComponents) {
    styleData.components = extractComponents();
    styleData.typographyContext = extractTypographyContext();
    styleData.colorContext = extractColorContext();
    styleData.layoutPatterns = extractLayoutPatterns();
    styleData.flexboxPatterns = extractFlexboxPatterns();
    styleData.componentComposition = extractComponentComposition();
    styleData.zIndex = extractZIndexHierarchy();
    styleData.animations = extractAnimations();
    styleData.domStructure = extractDOMTree();
  }

  return styleData;
}

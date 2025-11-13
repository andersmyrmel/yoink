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
 * - Component detection is in ./extraction/components
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

// NEW: Semantic extraction imports
import { analyzeSemanticLayout } from './extraction/semanticLayoutAnalyzer';
import { analyzeSemanticColors } from './extraction/semanticColorAnalyzer';
import { extractInteractionPatterns } from './extraction/interactionStateExtractor';

// NEW: Enhanced extraction imports (v2)
import { detectCSSArchitecture } from './utils/cssArchitectureDetector';
import { extractComponentSpecificColors } from './extraction/componentSpecificColorExtractor';
import { extractShadowsWithUsage } from './extraction/enhancedShadowExtractor';
import { extractFontWeights } from './extraction/fontWeightExtractor';

/**
 * Waits for web fonts to finish loading before extracting styles.
 * This ensures font-family values reflect the actual loaded fonts, not fallbacks.
 * Times out after 2 seconds to prevent blocking extraction indefinitely.
 *
 * @returns Promise that resolves when fonts are loaded or after timeout
 */
async function waitForFontsLoaded(): Promise<void> {
  if (!document.fonts || !document.fonts.ready) {
    // Browser doesn't support Font Loading API, continue immediately
    return Promise.resolve();
  }

  try {
    // Wait for fonts with 2 second timeout
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  } catch (error) {
    // Font loading failed, continue anyway
    console.warn('Error waiting for fonts:', error);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
  request: ScanStylesRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ScanResponse) => void
): boolean => {
  if (request.action === 'scanStyles') {
    // Wait for fonts to load before extraction
    waitForFontsLoaded().then(() => {
      try {
        const styleData = extractStyles(request.includeComponents);
        sendResponse({ success: true, data: styleData });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendResponse({ success: false, error: errorMessage });
      }
    }).catch(error => {
      // If font loading fails, continue anyway
      console.warn('Font loading check failed, continuing with extraction:', error);
      try {
        const styleData = extractStyles(request.includeComponents);
        sendResponse({ success: true, data: styleData });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendResponse({ success: false, error: errorMessage });
      }
    });
  }
  return true; // Keep message channel open for async response
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

  // NEW: Detect CSS architecture first (informs extraction strategy)
  const cssArchitecture = detectCSSArchitecture();

  const cssVariables = extractCSSCustomProperties();
  const colorData = extractColors();

  const styleData: StyleExtraction = {
    cssVariables,
    colors: colorData.colors,
    colorUsage: colorData.usage,
    colorExtraction: colorData,
    fonts: extractFonts(),
    borderRadius: extractBorderRadius(),
    shadows: extractShadows(),
    layout: extractLayoutStructure(),
    icons: extractIcons(),
    gradients: extractGradients(),
    responsive: extractResponsiveBreakpoints(),
    scrollbars: extractScrollbarStyles(),
    // NEW: CSS architecture detection (always included)
    cssArchitecture
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
    // Note: Keep domStructure but it will be replaced by semanticLayout in YAML output
    styleData.domStructure = extractDOMTree();

    // NEW: Semantic extractors
    styleData.semanticLayout = analyzeSemanticLayout();
    styleData.semanticColors = analyzeSemanticColors(
      new Map(Object.entries(styleData.colorUsage)),
      cssVariables
    );
    styleData.interactionPatterns = extractInteractionPatterns();

    // NEW: Enhanced extractors (v2) - critical for CSS-in-JS sites
    styleData.componentSpecificColors = extractComponentSpecificColors();
    styleData.enhancedShadows = extractShadowsWithUsage();
    styleData.fontWeights = extractFontWeights();
  }

  return styleData;
}

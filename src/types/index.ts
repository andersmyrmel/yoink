/**
 * Type definitions for Yoink Design System Extractor
 */

/**
 * CSS Custom Properties organized by theme
 */
export interface CSSVariables {
  [variableName: string]: ThemeValues;
}

/**
 * Theme-specific values for a CSS variable
 */
export interface ThemeValues {
  light?: string;
  dark?: string;
  [themeName: string]: string | undefined;
}

/**
 * Color usage tracking
 */
export interface ColorUsage {
  [color: string]: number;
}

/**
 * Complete style data extracted from a page
 */
export interface StyleData {
  cssVariables: CSSVariables;
  colors: string[];
  colorUsage: ColorUsage;
  fonts: string[];
  borderRadius: string[];
  shadows: string[];
}

/**
 * Grouped CSS variables by category
 */
export interface GroupedVariables {
  brand?: VariableEntry[];
  sidebar?: VariableEntry[];
  chart?: VariableEntry[];
  semantic?: VariableEntry[];
  radius?: VariableEntry[];
  tailwind?: VariableEntry[];
  other?: VariableEntry[];
}

/**
 * Single variable entry with theme values
 */
export interface VariableEntry {
  name: string;
  themes: ThemeValues;
}

/**
 * Message types for Chrome extension communication
 */
export enum MessageType {
  EXTRACT_STYLES = 'extractStyles',
  STYLE_DATA = 'styleData'
}

/**
 * Message structure for Chrome extension communication
 */
export interface ExtensionMessage {
  type: MessageType;
  data?: StyleData;
}

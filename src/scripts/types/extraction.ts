/**
 * Type definitions for Yoink extraction modules
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Request to scan page styles
 */
export interface ScanStylesRequest {
  action: 'scanStyles';
  includeComponents?: boolean;
}

/**
 * Generic response from extraction operations
 */
export interface ScanResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// DOM Tree Types
// ============================================================================

/**
 * Dimensions of an element
 */
export interface ElementDimensions {
  width: number;
  height: number;
}

/**
 * Extracted DOM node with semantic information
 */
export interface DOMNode {
  tag: string;
  classes?: string[];
  role?: string;
  href?: string;
  src?: string;
  alt?: string;
  inputType?: string;
  buttonType?: string;
  placeholder?: string;
  tableHeaders?: string[];
  tableRows?: number;
  dimensions?: ElementDimensions;
  layout?: 'flexbox' | 'grid';
  styles?: DOMNodeStyles;
  text?: string;
  children?: DOMNode[];
  svgChildren?: number;  // Number of internal SVG elements (collapsed for readability)
  note?: string;         // Additional notes about the node
}

/**
 * Computed styles for a DOM node
 */
export interface DOMNodeStyles {
  display: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  gridTemplateColumns?: string;
  padding?: string;
  margin?: string;
  background?: string;
  borderRadius?: string;
  boxShadow?: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
}

/**
 * Viewport information
 */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * Complete DOM tree extraction result
 */
export interface DOMTreeExtraction {
  url: string;
  viewport: Viewport;
  tree: DOMNode | null;
  nodeCount?: number;
  depthUsed?: number;
}

// ============================================================================
// Style Extraction Types
// ============================================================================

/**
 * CSS custom property with theme variants
 */
export interface CSSCustomProperty {
  [theme: string]: string;
}

/**
 * Collection of CSS custom properties
 */
export interface CSSCustomProperties {
  [variableName: string]: CSSCustomProperty;
}

/**
 * Color extraction result with usage tracking
 */
export interface ColorExtraction {
  colors: string[];
  usage: Record<string, number>;
  confidence?: number; // 0-1 score based on color consistency and CSS variable usage
}

/**
 * Parsed shadow data structure
 */
export interface ParsedShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
  raw: string;
}

/**
 * Shadow group with elevation level
 */
export interface ShadowGroup {
  shadows: ParsedShadow[];
  elevationLevel: number;
  name: string;
  count: number;
  intensity: number;
  representative: string;
}

/**
 * Shadow system analysis result
 */
export interface ShadowSystem {
  elevationLevels: ShadowGroup[];
  pattern: string;
  totalUniqueShadows: number;
  confidence?: number; // 0-1 score based on shadow consistency and elevation pattern clarity
}

// ============================================================================
// Typography Types
// ============================================================================

/**
 * Typography style for a heading or body text
 */
export interface TypographyStyle {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  color: string;
  usage: string;
  examples: string[];
  tag: string;
  count: number;
}

/**
 * Type scale analysis
 */
export interface TypeScaleAnalysis {
  baseSize: number;
  ratio: number;
  ratioName: string;
  scale: number[];
  confidence: string;
}

/**
 * Line height pattern
 */
export interface LineHeightPattern {
  value: string;
  ratio: number;
  count: number;
  usage: string;
}

/**
 * Enhanced typography analysis result
 */
export interface TypographyAnalysis {
  headings: Record<string, TypographyStyle>;
  body: TypographyStyle[];
  typeScale: TypeScaleAnalysis;
  lineHeightPatterns: LineHeightPattern[];
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * Interactive state styles (hover, focus, active, disabled)
 */
export interface StateStyles {
  hover?: {
    backgroundColor?: string;
    color?: string;
    opacity?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
    filter?: string;
    utilityClasses?: string[];
    hasTransition?: boolean;
    transition?: string;
    transitionDuration?: string;
    transitionEasing?: string;
    inferredInteractive?: boolean;
    dataAttribute?: string;
  };
  focus?: {
    outline?: string;
    boxShadow?: string;
    borderColor?: string;
    backgroundColor?: string;
    utilityClasses?: string[];
    dataAttribute?: string;
  };
  active?: {
    backgroundColor?: string;
    transform?: string;
    boxShadow?: string;
    opacity?: string;
    utilityClasses?: string[];
    dataAttribute?: string;
  };
  disabled?: {
    opacity?: string;
    cursor?: string;
    backgroundColor?: string;
    isDisabled?: boolean;
    utilityClasses?: string[];
    dataAttribute?: string;
  };
}

/**
 * Common component styles
 */
export interface ComponentStyles {
  background?: string;
  color?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  border?: string;
  boxShadow?: string;
  display?: string;
  height?: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  textAlign?: string;
  textDecoration?: string;
  lineHeight?: string;
  zIndex?: string;
  position?: string;
  gap?: string;
  borderBottom?: string;
  borderTop?: string;
  backgroundImage?: string;
  animation?: string;
  objectFit?: string;
  borderCollapse?: string;
}

/**
 * Generic component variant
 */
export interface ComponentVariant {
  html: string;
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
  description?: string;
  stateStyles?: StateStyles;
  states?: StateStyles;
}

/**
 * Button component variant
 */
export interface ButtonComponent extends ComponentVariant {
  variant: string;
}

/**
 * Card component variant
 */
export interface CardComponent extends ComponentVariant {
  variant: 'elevated' | 'flat' | 'interactive' | 'media' | 'default';
}

/**
 * Input component variant
 */
export interface InputComponent extends ComponentVariant {
  type: string;
  variant: 'checkbox' | 'radio' | 'select' | 'textarea' | 'search' | 'text-error' | 'text-success' | 'text';
}

/**
 * Navigation item variant
 */
export interface NavigationComponent extends ComponentVariant {
  variant: 'active' | 'primary' | 'secondary' | 'default';
}

/**
 * Heading component
 */
export interface HeadingComponent {
  html: string;
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
}

/**
 * Table component with header and cell styles
 */
export interface TableComponent extends ComponentVariant {
  styles: ComponentStyles & {
    header?: {
      background?: string;
      color?: string;
      fontWeight?: string;
      padding?: string;
    };
    cell?: {
      padding?: string;
      borderBottom?: string;
    };
  };
}

/**
 * Badge/tag component variant
 */
export interface BadgeComponent extends ComponentVariant {
  variant: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'default';
}

/**
 * Avatar component variant
 */
export interface AvatarComponent {
  classes: string;
  styles: ComponentStyles;
  variant: string;
  count: number;
}

/**
 * Tab component
 */
export interface TabComponent extends ComponentVariant {
  variant: 'active' | 'inactive';
}

/**
 * Progress/spinner component
 */
export interface ProgressComponent extends ComponentVariant {
  variant: 'spinner' | 'progress-bar';
}

/**
 * Alert/banner component
 */
export interface AlertComponent extends ComponentVariant {
  variant: 'success' | 'error' | 'warning' | 'info' | 'alert' | 'default';
}

/**
 * Skeleton loading state component
 */
export interface SkeletonComponent extends ComponentVariant {
  variant: 'animated' | 'static';
}

/**
 * Divider component
 */
export interface DividerComponent {
  classes: string;
  styles: ComponentStyles;
  variant: 'divider';
  count: number;
}

/**
 * Complete component extraction result
 */
export interface ComponentExtraction {
  buttons: ButtonComponent[];
  cards: CardComponent[];
  inputs: InputComponent[];
  navigation: NavigationComponent[];
  headings: HeadingComponent[];
  dropdowns: ComponentVariant[];
  tables: TableComponent[];
  modals: ComponentVariant[];
  tooltips: ComponentVariant[];
  badges: BadgeComponent[];
  avatars: AvatarComponent[];
  tabs: TabComponent[];
  accordions: ComponentVariant[];
  progress: ProgressComponent[];
  breadcrumbs: ComponentVariant[];
  pagination: ComponentVariant[];
  alerts: AlertComponent[];
  searchBars: ComponentVariant[];
  toggles: ComponentVariant[];
  dividers: DividerComponent[];
  skeletons: SkeletonComponent[];
  emptyStates: ComponentVariant[];
  datePickers: ComponentVariant[];
  colorPickers: ComponentVariant[];
  richTextEditors: ComponentVariant[];
  sliders: ComponentVariant[];
  comboboxes: ComponentVariant[];
  // Layout components
  sidebars: ComponentVariant[];
  topbars: ComponentVariant[];
  navigationMenus: ComponentVariant[];
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Fixed element layout information
 */
export interface FixedElement {
  position: 'fixed';
  width: string;
  height: string;
  top: string;
  left: string;
  right: string;
  bottom: string;
  zIndex: string;
}

/**
 * Sticky element layout information
 */
export interface StickyElement {
  position: 'sticky' | '-webkit-sticky';
  top: string;
  zIndex: string;
}

/**
 * Sidebar layout information
 */
export interface Sidebar {
  width: string;
  position: 'left' | 'right';
  backgroundColor: string;
  zIndex: string;
}

/**
 * Container layout information
 */
export interface Container {
  maxWidth: string;
  centered?: boolean;
  padding: string;
  selector?: string;
  count?: number;
}

/**
 * Grid layout information
 */
export interface GridLayout {
  columns: string;
  gap: string;
  alignItems: string;
  justifyItems: string;
}

/**
 * Overall layout structure
 */
export interface LayoutStructure {
  fixedElements: FixedElement[];
  stickyElements: StickyElement[];
  containers: Container[];
  grids: GridLayout[];
  sidebars: Sidebar[];
}

/**
 * Flexbox pattern
 */
export interface FlexboxPattern {
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  flexWrap: string;
  count: number;
}

/**
 * Component composition pattern
 */
export interface CompositionPattern {
  pattern: string;
  count: number;
  description: string;
}

/**
 * Z-index hierarchy entry
 */
export interface ZIndexEntry {
  zIndex: number;
  elements: number;
  contexts: string[];
}

/**
 * Z-index layers organized by semantic purpose
 */
export interface ZIndexLayers {
  base: ZIndexEntry[];
  dropdown: ZIndexEntry[];
  modal: ZIndexEntry[];
  toast: ZIndexEntry[];
}

/**
 * Z-index hierarchy analysis
 */
export interface ZIndexHierarchy {
  hierarchy: ZIndexEntry[];
  layers: ZIndexLayers;
  range: {
    min: number;
    max: number;
  } | null;
}

/**
 * Color pairing (background + text color)
 */
export interface ColorPairing {
  pair: string;
  background: string;
  backgroundVar?: string;
  text: string;
  textVar?: string;
  count: number;
}

/**
 * Color usage context
 */
export interface ColorContext {
  backgrounds: Record<string, number>;
  text: Record<string, number>;
  borders: Record<string, number>;
  pairings: ColorPairing[];
  variableMap: Record<string, string>;
}

/**
 * Spacing scale entry
 */
export interface SpacingEntry {
  value: string;
  count: number;
  usage: string;
  contexts: string[];
}

/**
 * Spacing scale analysis
 */
export interface SpacingScale {
  spacingScale: SpacingEntry[];
  baseUnit: string;
  pattern: string;
  totalUniqueValues: number;
  recommendation: string;
  confidence?: number; // 0-1 score based on base unit consistency and scale adherence
}

/**
 * Spacing pattern
 */
export interface SpacingPattern {
  type: 'padding' | 'margin';
  count: number;
}

/**
 * Complete layout patterns extraction
 */
export interface LayoutPatterns {
  containers: Container[];
  breakpoints: number[];
  spacingScale: SpacingScale;
  spacingPatterns: Record<string, SpacingPattern>;
}

// ============================================================================
// Animation Types
// ============================================================================

/**
 * Transition pattern
 */
export interface TransitionPattern {
  property: string;
  duration: string;
  easing: string;
  delay: string;
  count: number;
}

/**
 * Animation pattern
 */
export interface AnimationPattern {
  animation: string;
  count: number;
}

/**
 * Duration usage
 */
export interface DurationUsage {
  duration: string;
  count: number;
}

/**
 * Easing function usage
 */
export interface EasingUsage {
  easing: string;
  count: number;
}

/**
 * Animation extraction result
 */
export interface AnimationExtraction {
  transitions: TransitionPattern[];
  animations: AnimationPattern[];
  commonDurations: DurationUsage[];
  commonEasings: EasingUsage[];
}

// ============================================================================
// Icon Types
// ============================================================================

/**
 * SVG icon pattern
 */
export interface SVGIconPattern {
  size: string;
  viewBox: string | null;
  className: string;
  count: number;
}

/**
 * Icon font usage
 */
export interface IconFontUsage {
  size: string;
  count: number;
}

/**
 * Icon size usage
 */
export interface IconSizeUsage {
  size: string;
  count: number;
}

/**
 * Icon extraction result
 */
export interface IconExtraction {
  svgPatterns: SVGIconPattern[];
  iconFonts: IconFontUsage[];
  commonSizes: IconSizeUsage[];
  totalSvgs: number;
  totalIconFonts: number;
}

// ============================================================================
// Gradient Types
// ============================================================================

/**
 * Gradient definition
 */
export interface Gradient {
  type: 'linear' | 'radial' | 'conic';
  value: string;
  count: number;
}

// ============================================================================
// Responsive Breakpoint Types
// ============================================================================

/**
 * Responsive breakpoint
 */
export interface Breakpoint {
  width: number;
  value: string;
  type: 'min-width' | 'max-width';
  queryCount: number;
  name: string;
}

/**
 * Responsive breakpoints extraction
 */
export interface ResponsiveBreakpoints {
  breakpoints: Breakpoint[];
  totalMediaQueries: number;
  uniqueBreakpoints: number;
}

// ============================================================================
// Scrollbar Types
// ============================================================================

/**
 * Scrollbar styles
 */
export interface ScrollbarStyles {
  width?: string;
  height?: string;
  backgroundColor?: string;
  borderRadius?: string;
  scrollbarWidth?: string;
  scrollbarColor?: string;
}

/**
 * Scrollbar style definition
 */
export interface ScrollbarStyle {
  selector: string;
  styles: ScrollbarStyles;
}

// ============================================================================
// Semantic Layout Types (NEW)
// ============================================================================

/**
 * Layout structure type classification
 */
export type LayoutStructureType =
  | 'sidebar-content'
  | 'three-column'
  | 'centered'
  | 'dashboard'
  | 'split-view'
  | 'single-column'
  | 'grid-layout'
  | 'custom';

/**
 * Semantic region in the layout
 */
export interface LayoutRegion {
  name: string;
  role: string;
  position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
  width?: string;
  height?: string;
  contains?: string[];
  background?: string;
  zIndex?: string;
}

/**
 * Layout measurements for major sections
 */
export interface LayoutMeasurements {
  sidebarWidth?: string;
  topbarHeight?: string;
  contentPadding?: string;
  sectionGap?: string;
  rowHeight?: string;
  columnWidths?: Record<string, string>;
}

/**
 * High-level semantic layout description
 */
export interface SemanticLayout {
  structure: LayoutStructureType;
  regions: LayoutRegion[];
  measurements: LayoutMeasurements;
  gridPattern?: string;
}

// ============================================================================
// Semantic Color Types (NEW)
// ============================================================================

/**
 * Color usage context with semantic information
 */
export interface ColorUsageContext {
  color: string;
  usageCount: number;
  usedFor: string[];
  semanticName?: string;
  cssVariable?: string;
}

/**
 * Semantic color tokens organized by purpose
 */
export interface SemanticColorTokens {
  backgrounds: Record<string, string>;
  text: Record<string, string>;
  borders: Record<string, string>;
  interactive: Record<string, string>;
}

/**
 * Complete semantic color analysis
 */
export interface SemanticColorAnalysis {
  semantic: SemanticColorTokens;
  rawWithContext: ColorUsageContext[];
}

// ============================================================================
// Interaction State Types (NEW)
// ============================================================================

/**
 * State styles for a specific interaction
 */
export interface InteractionState {
  backgroundColor?: string;
  color?: string;
  opacity?: string;
  transform?: string;
  boxShadow?: string;
  borderColor?: string;
  outline?: string;
  transition?: string;
}

/**
 * Interaction states for a component type
 */
export interface ComponentInteractionStates {
  componentType: string;
  selector: string;
  count: number;
  states: {
    default?: InteractionState;
    hover?: InteractionState;
    active?: InteractionState;
    focus?: InteractionState;
    disabled?: InteractionState;
  };
}

/**
 * Global interaction timing configuration
 */
export interface InteractionTiming {
  defaultDuration: string;
  commonDurations: string[];
  defaultEasing: string;
  commonEasings: string[];
}

/**
 * Complete interaction patterns analysis
 */
export interface InteractionPatterns {
  timing: InteractionTiming;
  components: ComponentInteractionStates[];
}

// ============================================================================
// Main Extraction Result Type
// ============================================================================

/**
 * Complete style extraction result from a web page
 */
// Import maturity types (forward declaration to avoid circular dependency)
export interface MaturityAnalysis {
  level: 'Basic' | 'Emerging' | 'Developing' | 'Mature' | 'Advanced';
  score: number;
  strengths: string[];
  improvements: string[];
  details: {
    colorSystemScore: number;
    spacingSystemScore: number;
    typographyScore: number;
    componentSystemScore: number;
    consistencyScore: number;
    documentationScore: number;
  };
}

export interface StyleExtraction {
  cssVariables: CSSCustomProperties;
  colors: string[];
  colorUsage: Record<string, number>;
  colorExtraction?: ColorExtraction; // Full color extraction with confidence
  fonts: string[];
  borderRadius: string[];
  shadows: ShadowSystem;
  layout: LayoutStructure;
  icons: IconExtraction;
  gradients: Gradient[];
  responsive: ResponsiveBreakpoints;
  scrollbars: ScrollbarStyle[];
  // Optional component analysis (only if includeComponents = true)
  components?: ComponentExtraction;
  typographyContext?: TypographyAnalysis;
  colorContext?: ColorContext;
  layoutPatterns?: LayoutPatterns;
  flexboxPatterns?: FlexboxPattern[];
  componentComposition?: CompositionPattern[];
  zIndex?: ZIndexHierarchy;
  animations?: AnimationExtraction;
  domStructure?: DOMTreeExtraction;
  maturityAnalysis?: MaturityAnalysis;
  // NEW: Semantic extractors (only if includeComponents = true)
  semanticLayout?: SemanticLayout;
  semanticColors?: SemanticColorAnalysis;
  interactionPatterns?: InteractionPatterns;
}

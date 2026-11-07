/**
 * Core domain types for the Taavi Configurator.
 *
 * These types are UI-agnostic. Catalog types describe what is available;
 * `Configuration` describes what the user selected. See docs/04-data-model.md.
 */

export const PLATE_SHAPES = ['square', 'rectangle'] as const;
export type PlateShape = (typeof PLATE_SHAPES)[number];

/** Color categories. These are categories, not physical color values. */
export const COLOR_CATEGORIES = ['nude', 'colored'] as const;
export type ColorCategory = (typeof COLOR_CATEGORIES)[number];

/**
 * Physical dimensions. Unknown values are explicitly `pending` and must
 * never be replaced with invented numbers.
 */
export type Dimensions =
  | { readonly status: 'pending' }
  | { readonly status: 'defined'; readonly widthMm: number; readonly heightMm: number };

/** Reference to a visual asset. The asset may be missing at runtime. */
export interface AssetRef {
  readonly src: string;
  readonly alt?: string;
}

interface CatalogComponentBase {
  /** Stable identifier. Never derived from array position. */
  readonly id: string;
  readonly displayName: string;
  /** Defaults to available when omitted. `false` means not selectable. */
  readonly available?: boolean;
}

/** A specific plate color. Visual representation is optional until provided. */
export interface PlateColor extends CatalogComponentBase {
  readonly type: 'color';
  readonly category: ColorCategory;
  readonly swatch?: AssetRef;
}

export interface Plate extends CatalogComponentBase {
  readonly type: 'plate';
  readonly supportedShapes: readonly PlateShape[];
  readonly supportedColorCategories: readonly ColorCategory[];
  /** Specific colors this plate can be made in. May be empty while colors are pending. */
  readonly supportedColorIds: readonly string[];
  readonly dimensions: Readonly<Partial<Record<PlateShape, Dimensions>>>;
  readonly assets?: Readonly<Partial<Record<PlateShape, AssetRef>>>;
}

/**
 * Declared frame compatibility. Matching shapes is a necessary condition,
 * not proof of physical fit: real dimensions and mounting constraints are
 * required before production use (see docs/06-decisions.md).
 */
export interface FrameCompatibility {
  readonly shapes: readonly PlateShape[];
  /** When present, restricts the frame to these plate IDs. */
  readonly plateIds?: readonly string[];
}

export interface Frame extends CatalogComponentBase {
  readonly type: 'frame';
  readonly compatibility: FrameCompatibility;
  readonly assets?: Readonly<Partial<Record<PlateShape, AssetRef>>>;
}

export type CatalogComponent = Plate | Frame | PlateColor;

export interface Catalog {
  readonly plates: readonly Plate[];
  readonly frames: readonly Frame[];
  readonly colors: readonly PlateColor[];
}

/**
 * The user's current selection. Serializable (plain JSON) and independent
 * of UI details. `null` means "not selected"; for `frameId` it means "no frame".
 */
export interface Configuration {
  readonly plateId: string | null;
  readonly frameId: string | null;
  readonly colorCategory: ColorCategory | null;
  readonly colorId: string | null;
  readonly shape: PlateShape | null;
  /** Raw user text, preserved exactly as entered. */
  readonly text: string;
}

export type ConfigurationField = keyof Configuration;

export type InvalidCode =
  | 'unknown-reference'
  | 'unavailable'
  | 'unsupported-by-plate'
  | 'category-mismatch'
  | 'incompatible-shape'
  | 'incompatible-plate'
  | 'blank';

export type ValidationIssue =
  | { readonly kind: 'missing'; readonly field: ConfigurationField }
  | { readonly kind: 'invalid'; readonly field: ConfigurationField; readonly code: InvalidCode };

/** `invalid` takes precedence over `incomplete` when both kinds of issue exist. */
export type ValidationResult =
  | { readonly status: 'valid' }
  | { readonly status: 'incomplete'; readonly issues: readonly ValidationIssue[] }
  | { readonly status: 'invalid'; readonly issues: readonly ValidationIssue[] };

export type CatalogIssueCode =
  | 'invalid-id'
  | 'duplicate-id'
  | 'duplicate-entry'
  | 'unknown-reference'
  | 'unreachable-compatibility'
  | 'empty-list'
  | 'unsupported-shape-key'
  | 'color-category-mismatch'
  | 'invalid-dimension'
  | 'invalid-asset';

/**
 * A catalog integrity problem. `path` locates the offending value
 * (e.g. `plates[2].dimensions.rectangle.widthMm`); indices are for
 * diagnostics only and never identify components.
 */
export interface CatalogIssue {
  readonly code: CatalogIssueCode;
  readonly path: string;
  /** ID of the component that owns the offending value, when known. */
  readonly id?: string;
  /** Another location involved in the issue, e.g. a duplicate's first occurrence. */
  readonly relatedPath?: string;
}

/** Unlike configuration validation, every catalog issue is reported. */
export type CatalogValidationResult =
  | { readonly status: 'valid' }
  | { readonly status: 'invalid'; readonly issues: readonly CatalogIssue[] };

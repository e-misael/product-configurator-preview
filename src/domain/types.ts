/**
 * Core domain types for the Taavi Configurator.
 *
 * These types are UI-agnostic. Catalog types describe what is available;
 * `Configuration` describes what the user selected. See docs/04-data-model.md.
 */

export const PLATE_SHAPES = ['square', 'rectangle', 'circle'] as const;
export type PlateShape = (typeof PLATE_SHAPES)[number];

/**
 * Shapes that can never take a frame (D-024). Used only by catalog integrity
 * checks; everything else relies on `Plate.supportsFrame`.
 */
export const FRAMELESS_SHAPES: readonly PlateShape[] = ['circle'];

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

/**
 * Reference to a same-origin image under `/catalog/{plates|frames|colors}/{owner-id}/`
 * (D-031). The file may still be missing or fail to load at runtime.
 */
export interface AssetRef {
  readonly src: string;
  readonly alt?: string;
  /** Intrinsic pixel size of the file, when known. Both or neither. */
  readonly widthPx?: number;
  readonly heightPx?: number;
}

/**
 * A rectangle in an image's own coordinates, as fractions (0–1) of its
 * width and height, origin top-left (D-034). Positioning metadata only:
 * it does not describe the exact outline of a circular or irregular object.
 */
export interface NormalizedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/** Where personalized text may be laid out on a plate image. Typography is pending (P-04). */
export interface TextLayout {
  readonly area: NormalizedBox;
  readonly align?: TextAlignment;
}

/**
 * The photograph of one real variation of a plate model (D-032). Matched
 * exactly against the configuration's category and shade, never approximated.
 * Placement fields are optional until calibrated from the real photograph.
 */
export interface PlateImage {
  readonly colorCategory: ColorCategory;
  /** Omitted: the photograph for the category with no specific shade chosen. */
  readonly colorId?: string;
  readonly image: AssetRef;
  /** Bounding box of the ceramic object within the photograph. */
  readonly objectBounds?: NormalizedBox;
  readonly text?: TextLayout;
}

/**
 * Frame imagery calibrated for one plate model (D-033). `back` is drawn
 * behind the plate; the optional `front` overlay is drawn above plate and text.
 */
export interface FrameImage {
  readonly plateId: string;
  readonly back: AssetRef;
  readonly front?: AssetRef;
  /** Where the plate's `objectBounds` are placed within `back`. */
  readonly platePlacement?: NormalizedBox;
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

/** A physical plate model. Each model has one fixed shape (D-023). */
export interface Plate extends CatalogComponentBase {
  readonly type: 'plate';
  readonly shape: PlateShape;
  /** Explicit capability; never inferred from shape at use sites (D-024). */
  readonly supportsFrame: boolean;
  readonly supportedColorCategories: readonly ColorCategory[];
  /** Specific colors this plate can be made in. May be empty while colors are pending. */
  readonly supportedColorIds: readonly string[];
  readonly dimensions: Dimensions;
  /** Photographs per color variation. A variation without an entry has a pending image. */
  readonly images?: readonly PlateImage[];
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
  /** Imagery per compatible plate model. A plate without an entry has a pending image. */
  readonly images?: readonly FrameImage[];
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
 * The shape is not stored: it is derived from the selected plate (D-023).
 */
export interface Configuration {
  readonly plateId: string | null;
  readonly frameId: string | null;
  readonly colorCategory: ColorCategory | null;
  readonly colorId: string | null;
  /** Raw user text, preserved exactly as entered. */
  readonly text: string;
}

export type ConfigurationField = keyof Configuration;

export type InvalidCode =
  | 'unknown-reference'
  | 'unavailable'
  | 'unsupported-by-plate'
  | 'category-mismatch'
  | 'frame-not-supported'
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
  | 'frame-capability-conflict'
  | 'unsupported-frame-shape'
  | 'color-category-mismatch'
  | 'invalid-dimension'
  | 'invalid-asset'
  | 'unsupported-variation'
  | 'duplicate-variation'
  | 'invalid-placement';

/**
 * A catalog integrity problem. `path` locates the offending value
 * (e.g. `plates[2].dimensions.widthMm`); indices are for
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

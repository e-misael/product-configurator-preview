/**
 * Core domain types for the Taavi Configurator.
 *
 * These types are UI-agnostic. Catalog types describe what is available;
 * `Configuration` describes what the user selected. See docs/04-data-model.md.
 */

/**
 * Classification of a model's outline, used for frame compatibility. It implies
 * no geometry: `scalloped` (wavy-edged trays) says nothing about the exact outline.
 */
export const PLATE_SHAPES = ['square', 'rectangle', 'circle', 'scalloped'] as const;
export type PlateShape = (typeof PLATE_SHAPES)[number];

/**
 * Shapes that can never take a frame (D-024). Used only by catalog integrity
 * checks; everything else relies on `Plate.supportsFrame`.
 */
export const FRAMELESS_SHAPES: readonly PlateShape[] = ['circle'];

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
 * The photograph of a model (D-032, revised by D-041). The ceramic color is a
 * fixed property of the model, so each model has one photograph. Placement
 * fields are optional until calibrated from the real photograph.
 */
export interface PlateImage {
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

/**
 * A physical product model, shown to customers as "Modelo" (D-040). The
 * internal name stays `Plate`. Each model has one fixed shape (D-023).
 */
export interface Plate extends CatalogComponentBase {
  readonly type: 'plate';
  readonly shape: PlateShape;
  /** Customer-facing size as supplied, e.g. "10 cm x 10 cm" or "~ 8 cm". Display only. */
  readonly sizeLabel: string;
  /** Fixed ceramic color shown read-only, e.g. "Bege". Owned by the catalog, never chosen (D-041). */
  readonly ceramicColor: string;
  /** Explicit capability; never inferred from shape at use sites (D-024). */
  readonly supportsFrame: boolean;
  /** Physical dimensions; `pending` until measured. `sizeLabel` is not a measurement. */
  readonly dimensions: Dimensions;
  /** The model's photograph. Omitted while pending. */
  readonly image?: PlateImage;
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

/**
 * A lettering color the customer can pick for the text (D-042). Catalog data
 * only: production stays empty until Taavi supplies the approved palette (P-02).
 */
export interface TextColor extends CatalogComponentBase {
  readonly type: 'text-color';
  /** `#rrggbb`. */
  readonly hex: string;
}

export type CatalogComponent = Plate | Frame | TextColor;

export interface Catalog {
  readonly plates: readonly Plate[];
  readonly frames: readonly Frame[];
  readonly textColors: readonly TextColor[];
}

/** Provisional system font stacks are mapped in the renderer; real typography is pending (P-14). */
export const FONT_FAMILIES = ['serif', 'sans-serif'] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

/**
 * A half-open range `[start, end)` of UTF-16 offsets into `Configuration.text`,
 * always on grapheme-cluster boundaries (D-042).
 */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The customer's text placement (D-044). `align` aligns the lines inside the
 * text block; `x`/`y` place the block as fractions (0–1) of the free space
 * left around it inside the calibrated text area, so any valid value keeps
 * the block inside that area on every model.
 */
export interface TextPlacement {
  readonly align: TextAlignment;
  readonly x: number;
  readonly y: number;
}

/**
 * The user's current selection. Serializable (plain JSON) and independent
 * of UI details. `null` means "not selected"; for `frameId` it means "no frame".
 * The shape is not stored: it is derived from the selected plate (D-023).
 */
export interface Configuration {
  readonly plateId: string | null;
  readonly frameId: string | null;
  /** Raw user text, preserved exactly as entered. */
  readonly text: string;
  readonly fontFamily: FontFamily;
  /** Required lettering color; references `TextColor.id`. No default (D-042). */
  readonly textColorId: string | null;
  /** Optional second lettering color. Kept when its last range is removed. */
  readonly secondaryColorId: string | null;
  /** Characters drawn in the secondary color. Sorted, non-overlapping, grapheme-aligned. */
  readonly secondaryRanges: readonly TextRange[];
  /** `null` = the catalog default for the model's text area (D-044). */
  readonly textLayout: TextPlacement | null;
}

export type ConfigurationField = keyof Configuration;

export type InvalidCode =
  | 'unknown-reference'
  | 'unavailable'
  | 'frame-not-supported'
  | 'incompatible-shape'
  | 'incompatible-plate'
  | 'blank'
  | 'unsupported-font'
  | 'same-as-primary'
  | 'ranges-without-color'
  | 'invalid-ranges'
  | 'invalid-layout';

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
  | 'invalid-dimension'
  | 'invalid-asset'
  | 'empty-label'
  | 'duplicate-variation'
  | 'invalid-placement'
  | 'invalid-color';

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

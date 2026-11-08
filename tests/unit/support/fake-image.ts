/**
 * Replaces `Image` so tests decide when and how each file loads. Natural sizes
 * come from the `sizes` table; a source without an entry loads as 0×0, which
 * the app treats as a broken image.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export class FakeImage {
  static sizes: Record<string, Size> = {};
  static requested: FakeImage[] = [];

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  private source = '';

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    FakeImage.requested.push(this);
  }

  static get requestedSources() {
    return FakeImage.requested.map((image) => image.src);
  }

  /** Completes every pending request for `src` successfully. */
  static load(src: string) {
    for (const image of FakeImage.requested.filter((candidate) => candidate.src === src)) {
      const size = FakeImage.sizes[src];
      image.naturalWidth = size?.width ?? 0;
      image.naturalHeight = size?.height ?? 0;
      image.onload?.();
    }
    FakeImage.requested = FakeImage.requested.filter((candidate) => candidate.src !== src);
  }

  static fail(src: string) {
    for (const image of FakeImage.requested.filter((candidate) => candidate.src === src)) {
      image.onerror?.();
    }
    FakeImage.requested = FakeImage.requested.filter((candidate) => candidate.src !== src);
  }

  /** Loads everything requested so far (and anything requested as a result). */
  static loadAll() {
    for (const src of new Set(FakeImage.requestedSources)) FakeImage.load(src);
  }
}

export function installFakeImages(sizes: Record<string, Size> = {}) {
  FakeImage.sizes = sizes;
  FakeImage.requested = [];
  vi.stubGlobal('Image', FakeImage);
}

/**
 * jsdom has no 2D canvas. This fake records what would be painted so tests can
 * assert layer order, positions, and text, and it measures text
 * deterministically (half the font size per code point).
 */

export type PaintCall =
  | { readonly op: 'setTransform'; readonly args: readonly number[] }
  | { readonly op: 'clearRect'; readonly args: readonly number[] }
  | {
      readonly op: 'drawImage';
      readonly image: unknown;
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly op: 'fillText';
      readonly text: string;
      readonly x: number;
      readonly y: number;
      readonly font: string;
      readonly textAlign: string;
      readonly fillStyle: string;
    };

export class FakeContext {
  readonly calls: PaintCall[] = [];
  font = '10px sans-serif';
  fillStyle = '#000';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  imageSmoothingEnabled = false;
  imageSmoothingQuality = 'low';
  // Untouched by the renderer: the preview never tints or blends (D-027).
  filter = 'none';
  globalCompositeOperation = 'source-over';
  globalAlpha = 1;

  setTransform(...args: number[]) {
    this.calls.push({ op: 'setTransform', args });
  }

  clearRect(...args: number[]) {
    this.calls.push({ op: 'clearRect', args });
  }

  drawImage(image: unknown, x: number, y: number, width: number, height: number) {
    this.calls.push({ op: 'drawImage', image, x, y, width, height });
  }

  fillText(text: string, x: number, y: number) {
    this.calls.push({
      op: 'fillText',
      text,
      x,
      y,
      font: this.font,
      textAlign: this.textAlign,
      fillStyle: this.fillStyle,
    });
  }

  measureText(text: string) {
    return { width: [...text].length * parseFloat(this.font) * 0.5 };
  }

  /** Images and text painted since the last clear: what is currently on the canvas. */
  get drawn() {
    let lastClear = -1;
    this.calls.forEach((call, index) => {
      if (call.op === 'clearRect') lastClear = index;
    });
    return this.calls
      .slice(lastClear + 1)
      .filter((call) => call.op === 'drawImage' || call.op === 'fillText');
  }
}

const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();

/** The fake context of a canvas element, created on first use. */
export function contextOf(canvas: HTMLCanvasElement): FakeContext {
  let ctx = contexts.get(canvas);
  if (ctx === undefined) {
    ctx = new FakeContext();
    contexts.set(canvas, ctx);
  }
  return ctx;
}

export function installFakeCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return contextOf(this) as unknown as CanvasRenderingContext2D;
  });
}

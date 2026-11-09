/**
 * jsdom has no 2D canvas. This fake records what would be painted so tests can
 * assert layer order, positions, and text, and it measures text
 * deterministically (half the font size per code point, letter spacing not
 * included, as in browsers' `measureText` of unspaced text).
 */

export type PaintCall =
  | { readonly op: 'setTransform'; readonly args: readonly number[] }
  | { readonly op: 'clearRect'; readonly args: readonly number[] }
  | { readonly op: 'fillRect'; readonly args: readonly number[]; readonly fillStyle: string }
  | {
      readonly op: 'drawImage';
      readonly image: unknown;
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly composite: string;
      readonly alpha: number;
      readonly shadow: {
        readonly color: string;
        readonly blur: number;
        readonly dx: number;
        readonly dy: number;
      };
    }
  | {
      readonly op: 'strokeRect';
      readonly args: readonly number[];
      readonly strokeStyle: string;
      readonly lineWidth: number;
      readonly lineDash: readonly number[];
    }
  | { readonly op: 'save' | 'restore' | 'beginPath' }
  | {
      readonly op: 'roundRect';
      readonly args: readonly number[];
    }
  | { readonly op: 'fill'; readonly fillStyle: string; readonly alpha: number }
  | {
      readonly op: 'fillText';
      readonly text: string;
      readonly x: number;
      readonly y: number;
      readonly font: string;
      readonly textAlign: string;
      readonly letterSpacing: string;
      readonly fillStyle: string;
      readonly composite: string;
    };

/** The font size in a CSS font shorthand such as `700 24px "Family", serif`. */
export function fontSizeOf(font: string): number {
  return parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '10');
}

export class FakeContext {
  readonly calls: PaintCall[] = [];
  font = '10px sans-serif';
  fillStyle = '#000';
  textAlign = 'start';
  letterSpacing = '0px';
  textBaseline = 'alphabetic';
  imageSmoothingEnabled = false;
  imageSmoothingQuality = 'low';
  // Untouched by the renderer: the preview never tints or blends (D-027).
  filter = 'none';
  globalCompositeOperation = 'source-over';
  globalAlpha = 1;
  shadowColor = 'rgba(0, 0, 0, 0)';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  strokeStyle = '#000';
  lineWidth = 1;
  private lineDash: readonly number[] = [];
  private readonly stack: Record<string, unknown>[] = [];
  private static readonly STATE = [
    'font',
    'fillStyle',
    'textAlign',
    'letterSpacing',
    'textBaseline',
    'globalCompositeOperation',
    'globalAlpha',
    'shadowColor',
    'shadowBlur',
    'shadowOffsetX',
    'shadowOffsetY',
    'strokeStyle',
    'lineWidth',
    'lineDash',
  ] as const;

  save() {
    this.calls.push({ op: 'save' });
    this.stack.push(Object.fromEntries(FakeContext.STATE.map((key) => [key, this[key]])));
  }

  restore() {
    this.calls.push({ op: 'restore' });
    Object.assign(this, this.stack.pop());
  }

  setTransform(...args: number[]) {
    this.calls.push({ op: 'setTransform', args });
  }

  clearRect(...args: number[]) {
    this.calls.push({ op: 'clearRect', args });
  }

  fillRect(...args: number[]) {
    this.calls.push({ op: 'fillRect', args, fillStyle: this.fillStyle });
  }

  /** Records the destination rectangle of the 3-, 5-, or 9-argument form. */
  drawImage(image: unknown, ...args: number[]) {
    const natural = image as { width?: number; height?: number };
    const [x = 0, y = 0, width = natural.width ?? 0, height = natural.height ?? 0] =
      args.length === 8 ? args.slice(4) : args;
    this.calls.push({
      op: 'drawImage',
      image,
      x,
      y,
      width,
      height,
      composite: this.globalCompositeOperation,
      alpha: this.globalAlpha,
      shadow: {
        color: this.shadowColor,
        blur: this.shadowBlur,
        dx: this.shadowOffsetX,
        dy: this.shadowOffsetY,
      },
    });
  }

  setLineDash(segments: readonly number[]) {
    this.lineDash = [...segments];
  }

  strokeRect(...args: number[]) {
    this.calls.push({
      op: 'strokeRect',
      args,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineDash: this.lineDash,
    });
  }

  fillText(text: string, x: number, y: number) {
    this.calls.push({
      op: 'fillText',
      text,
      x,
      y,
      font: this.font,
      textAlign: this.textAlign,
      letterSpacing: this.letterSpacing,
      fillStyle: this.fillStyle,
      composite: this.globalCompositeOperation,
    });
  }

  beginPath() {
    this.calls.push({ op: 'beginPath' });
  }

  roundRect(...args: number[]) {
    this.calls.push({ op: 'roundRect', args });
  }

  fill() {
    this.calls.push({ op: 'fill', fillStyle: this.fillStyle, alpha: this.globalAlpha });
  }

  measureText(text: string) {
    return { width: [...text].length * fontSizeOf(this.font) * 0.5 };
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

/** Outlines stroked since the last clear (the preview-only overflow outline, D-057). */
export function strokesOf(ctx: FakeContext) {
  let lastClear = -1;
  ctx.calls.forEach((call, index) => {
    if (call.op === 'clearRect') lastClear = index;
  });
  return ctx.calls.slice(lastClear + 1).filter((call) => call.op === 'strokeRect');
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
  // jsdom cannot encode; hand back a small PNG-typed blob asynchronously, like a browser.
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    setTimeout(() => callback(new Blob(['png'], { type: type ?? 'image/png' })), 0);
  });
}

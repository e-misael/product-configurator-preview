import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { chooseBackingWidth, drawOverflowOutline, drawScene } from '../../preview/draw';
import {
  dragPosition,
  HIT_TOLERANCE_PX,
  hitsBlock,
  textBlockOf,
  toLogical,
  type Point,
} from '../../preview/placement';
import type { Scene, TextBlock } from '../../preview/scene';

interface PreviewCanvasProps {
  readonly scene: Scene;
  readonly label: string;
  readonly describedBy: string;
  /** Dragging is enabled only in the "Ajustar manualmente" mode (D-058). */
  readonly moveMode: boolean;
  /** Called with the new block position while the text is dragged; alignment is not changed. */
  readonly onMoveText: ((position: Point) => void) | undefined;
}

interface Drag {
  readonly pointerId: number;
  readonly origin: Point;
  readonly start: Point;
  readonly slack: TextBlock['slack'];
}

/**
 * Paints a scene on a canvas that scales to its container with the scene's
 * aspect ratio. The backing store follows the displayed width and the device
 * pixel ratio, capped at the source image's resolution. In the "Ajustar
 * manualmente" mode the text block can be dragged with a mouse, pen, or
 * finger; otherwise touch scrolls the page as usual. Overflowing text gets a dashed outline of
 * the text area here, never in the export (D-057).
 */
export function PreviewCanvas({
  scene,
  label,
  describedBy,
  moveMode,
  onMoveText,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssWidth, setCssWidth] = useState(0);
  const drag = useRef<Drag | null>(null);
  const [cursor, setCursor] = useState<'grab' | 'grabbing' | undefined>(undefined);
  const block = textBlockOf(scene);
  const movable = onMoveText !== undefined && block !== undefined && moveMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCssWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pixelWidth = chooseBackingWidth(cssWidth, window.devicePixelRatio, scene.width);
    canvas.width = pixelWidth;
    canvas.height = Math.max(1, Math.round((pixelWidth * scene.height) / scene.width));
    drawScene(ctx, scene, pixelWidth);
    drawOverflowOutline(ctx, scene, pixelWidth);
  }, [scene, cssWidth]);

  /** The pointer in scene units, and whether it is on the text block. */
  const locate = (event: PointerEvent<HTMLCanvasElement>) => {
    const display = event.currentTarget.getBoundingClientRect();
    const point = toLogical(event.clientX, event.clientY, display, scene);
    const tolerance = display.width > 0 ? (HIT_TOLERANCE_PX * scene.width) / display.width : 0;
    return { point, hit: block !== undefined && hitsBlock(block.bounds, point, tolerance) };
  };

  const handlers = movable
    ? {
        onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
          if (event.button !== 0) return;
          const { point, hit } = locate(event);
          if (!hit) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerId: event.pointerId,
            origin: point,
            start: { x: block.x, y: block.y },
            slack: block.slack,
          };
          setCursor('grabbing');
        },
        onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => {
          const current = drag.current;
          if (current === null) {
            if (event.pointerType === 'mouse') setCursor(locate(event).hit ? 'grab' : undefined);
            return;
          }
          if (event.pointerId !== current.pointerId) return;
          const { point } = locate(event);
          const delta = { x: point.x - current.origin.x, y: point.y - current.origin.y };
          onMoveText(dragPosition(current.start, current.slack, delta));
        },
        onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          setCursor(event.pointerType === 'mouse' ? 'grab' : undefined);
        },
        onPointerCancel: () => {
          drag.current = null;
          setCursor(undefined);
        },
        onPointerLeave: () => {
          if (drag.current === null) setCursor(undefined);
        },
      }
    : {};

  return (
    <canvas
      ref={canvasRef}
      className="preview__canvas"
      role="img"
      aria-label={label}
      aria-describedby={describedBy}
      style={{
        aspectRatio: `${scene.width} / ${scene.height}`,
        // Outside manual adjustment, touch gestures scroll the page as usual.
        touchAction: movable ? 'none' : 'auto',
        cursor,
      }}
      {...handlers}
    />
  );
}

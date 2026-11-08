import { useEffect, useRef, useState } from 'react';
import { chooseBackingWidth, drawScene } from '../../preview/draw';
import type { Scene } from '../../preview/scene';

interface PreviewCanvasProps {
  readonly scene: Scene;
  readonly label: string;
  readonly describedBy: string;
}

/**
 * Paints a scene on a canvas that scales to its container with the scene's
 * aspect ratio. The backing store follows the displayed width and the device
 * pixel ratio, capped at the source image's resolution.
 */
export function PreviewCanvas({ scene, label, describedBy }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssWidth, setCssWidth] = useState(0);

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
  }, [scene, cssWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="preview__canvas"
      role="img"
      aria-label={label}
      aria-describedby={describedBy}
      style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
    />
  );
}

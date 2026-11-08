/**
 * jsdom has no PointerEvent and no pointer capture. This minimal stand-in
 * carries the fields the canvas reads (`pointerId`, `pointerType`, client
 * coordinates via MouseEvent) so React's pointer handlers can be exercised.
 */
export function installPointerEvents(): void {
  if (typeof window.PointerEvent === 'undefined') {
    class FakePointerEvent extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    window.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent;
  }
  for (const method of ['setPointerCapture', 'releasePointerCapture'] as const) {
    if (!(method in Element.prototype)) {
      Object.defineProperty(Element.prototype, method, { value: () => undefined, writable: true });
    }
  }
}

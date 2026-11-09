/**
 * Sharing the exported PNG (D-076): the device's share sheet (Web Share API)
 * with the image and the order summary, or a WhatsApp link with the summary
 * only. The app never chooses the recipient, never attaches a file to a URL,
 * and never learns whether a message was sent.
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** A stand-in for the PNG, to ask before it exists whether PNG files can be shared at all. */
const PROBE = (): File => new File([new Uint8Array()], 'taavi.png', { type: 'image/png' });

/** Whether this browser can share `file` (by default, any PNG) through the share sheet. */
export function canShareFiles(file?: File): boolean {
  if (!('share' in navigator) || !('canShare' in navigator)) return false;
  try {
    return navigator.canShare({ files: [file ?? PROBE()] });
  } catch {
    return false;
  }
}

/**
 * Opens the share sheet with `file`, and `text` where the browser accepts both.
 * `navigator.share` is called before this returns, so a click handler calling it
 * keeps the user activation browsers require. Resolves to `shared` when the sheet
 * closed after choosing a target — not proof that anything was sent — and to
 * `cancelled` when it was dismissed.
 */
export function shareFile(file: File, text: string): Promise<ShareOutcome> {
  const withText: ShareData = { files: [file], text };
  let data: ShareData = { files: [file] };
  try {
    if (navigator.canShare(withText)) data = withText;
  } catch {
    // Shared without the text.
  }
  let pending: Promise<void>;
  try {
    pending = navigator.share(data);
  } catch {
    return Promise.resolve('failed');
  }
  return pending.then(
    () => 'shared' as const,
    (error: unknown) =>
      error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed',
  );
}

/**
 * The configured number in the form wa.me expects (8–15 digits, no leading
 * zero), or null when there is none or it is not one.
 */
export function whatsAppNumber(value: string | null): string | null {
  return value !== null && /^[1-9]\d{7,14}$/.test(value) ? value : null;
}

/** A link that opens the WhatsApp chat with `number` and `text` typed in, not sent. */
export function whatsAppUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

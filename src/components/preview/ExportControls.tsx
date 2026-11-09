import { useState } from 'react';
import { TAAVI_WHATSAPP_NUMBER } from '../../config/contact';
import type { ValidationResult } from '../../domain';
import {
  downloadBlob,
  ExportError,
  exportBlockers,
  exportFileName,
  renderPng,
  type ExportBlocker,
} from '../../preview/export';
import type { PreviewNoticeCode } from '../../preview/composition';
import { textBlockOf } from '../../preview/placement';
import type { Scene } from '../../preview/scene';
import { whatsAppNumber, whatsAppUrl } from '../../preview/share';
import { invalidMessage, missingLabel } from '../configurator/messages';
import { EXPORT_MESSAGES, noticeMessage } from './messages';

interface ExportControlsProps {
  /** The preview's own scene: export paints exactly this (D-009). */
  readonly scene: Scene;
  readonly validation: ValidationResult;
  readonly plateId: string | null;
  /** A model group is chosen but not its size (D-057). */
  readonly sizePending?: boolean;
  /** The order inquiry the WhatsApp link opens with (D-076, D-080). */
  readonly orderMessage: string;
  /** TAAVI's WhatsApp number; without a valid one the WhatsApp step is not offered (P-16). */
  readonly whatsApp?: string | null;
}

type Outcome =
  | { readonly status: 'working' }
  | { readonly status: 'done'; readonly fileName: string }
  | { readonly status: 'error'; readonly message: string };

/** Notices that only restate a configuration issue already listed ("Falta escolher: …"). */
const RESTATED: ReadonlySet<PreviewNoticeCode> = new Set([
  'plate-not-selected',
  'size-not-selected',
  'text-color-provisional',
]);

/**
 * Every blocker is named (D-063): invalid choices and each preview problem in
 * the preview's own words, e.g. how many lines are over. Missing choices are
 * listed together in one "Falta escolher" line instead.
 */
function blockerMessage(
  blocker: ExportBlocker,
  excessLines: number,
  sizePending: boolean,
): string | undefined {
  switch (blocker.kind) {
    case 'configuration':
      return blocker.issue.kind === 'missing' ? undefined : invalidMessage(blocker.issue);
    case 'preview':
      return RESTATED.has(blocker.code)
        ? undefined
        : noticeMessage(blocker.code, excessLines, sizePending);
    case 'empty':
      return EXPORT_MESSAGES.empty;
  }
}

/**
 * The finalization actions, two numbered steps (D-080): "Baixar minha
 * criação" (FR-07, D-008), then "Enviar detalhes para a TAAVI", a WhatsApp
 * link once a number is configured. Downloading comes first and is drawn as
 * the main action; once a download has started for this image, the WhatsApp
 * step is (the page cannot know the file was saved, and says only that the
 * download started). WhatsApp never waits for a download: the customer may
 * already have the image. What still blocks them is listed just above, the
 * one place the configuration's status is shown (D-078). Every action stays
 * focusable while blocked (`aria-disabled`) so the reasons can be reached;
 * activation does nothing until they are resolved. Native Share (D-076) is not
 * offered; src/preview/share.ts keeps it.
 */
export function ExportControls({
  scene,
  validation,
  plateId,
  sizePending = false,
  orderMessage,
  whatsApp = TAAVI_WHATSAPP_NUMBER,
}: ExportControlsProps) {
  // The outcome belongs to the scene it was produced for; any change clears it.
  const [result, setResult] = useState<{ scene: Scene; outcome: Outcome } | null>(null);
  const outcome = result?.scene === scene ? result.outcome : undefined;
  const blockers = exportBlockers(validation, scene);
  const excessLines = textBlockOf(scene)?.excessLines ?? 0;
  const missing = (validation.status === 'valid' ? [] : validation.issues)
    .filter((issue) => issue.kind === 'missing')
    .map((issue) => missingLabel(issue.field, sizePending));
  const reasons = [
    ...(missing.length > 0 ? [`Falta escolher: ${missing.join(', ')}.`] : []),
    ...new Set(
      blockers
        .map((blocker) => blockerMessage(blocker, excessLines, sizePending))
        .filter((reason) => reason !== undefined),
    ),
  ];
  const blocked = blockers.length > 0 || plateId === null;
  const working = outcome?.status === 'working';
  // A download of this very image has started: WhatsApp is next.
  const downloaded = outcome?.status === 'done';
  const number = whatsAppNumber(whatsApp);

  const exportImage = async () => {
    if (blocked || working || plateId === null) return;
    const fileName = exportFileName(plateId);
    setResult({ scene, outcome: { status: 'working' } });
    try {
      const blob = await renderPng(scene);
      downloadBlob(blob, fileName);
      setResult({ scene, outcome: { status: 'done', fileName } });
    } catch (error) {
      const reason = error instanceof ExportError ? error.reason : undefined;
      const message =
        reason === 'invalid-size'
          ? EXPORT_MESSAGES.invalidSize
          : reason === 'no-watermark'
            ? EXPORT_MESSAGES.noWatermark
            : EXPORT_MESSAGES.failed;
      setResult({ scene, outcome: { status: 'error', message } });
    }
  };

  const describedBy = (hint: string) => (blocked ? `export-reasons ${hint}` : hint);

  return (
    <div className="export">
      {blocked && (
        <section className="status" aria-label="Situação da configuração">
          <div className="export__reasons" id="export-reasons">
            <p className="field__info">Para finalizar:</p>
            <ul className="export__list">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <ol className="actions">
        <li className="actions__step">
          <span className="actions__number" aria-hidden="true">
            1
          </span>
          <div className="actions__body">
            <button
              type="button"
              className={`button export__button${downloaded ? ' export__button--secondary' : ''}`}
              aria-disabled={blocked || working}
              aria-describedby={describedBy('download-hint')}
              onClick={() => void exportImage()}
            >
              Baixar minha criação
            </button>
            <p className="field__info" id="download-hint">
              Salve a imagem da sua peça.
            </p>
            <p className="field__info" aria-live="polite">
              {outcome?.status === 'working' && EXPORT_MESSAGES.working}
              {outcome?.status === 'done' && `${EXPORT_MESSAGES.done} ${outcome.fileName}`}
            </p>
            {outcome?.status === 'error' && (
              <p className="field__error" role="alert">
                {outcome.message}
              </p>
            )}
          </div>
        </li>
        {number !== null && (
          <li className="actions__step">
            <span className="actions__number" aria-hidden="true">
              2
            </span>
            <div className="actions__body">
              {blocked ? (
                // Not a link while blocked: an incomplete request cannot be opened.
                <span
                  role="link"
                  tabIndex={0}
                  className="button export__button whatsapp__link"
                  aria-disabled="true"
                  aria-describedby={describedBy('whatsapp-hint')}
                >
                  Enviar detalhes para a TAAVI
                </span>
              ) : (
                <a
                  className={`button export__button whatsapp__link${downloaded ? '' : ' export__button--secondary'}`}
                  href={whatsAppUrl(number, orderMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby="whatsapp-hint"
                >
                  Enviar detalhes para a TAAVI
                </a>
              )}
              <p className="field__info" id="whatsapp-hint">
                Abra nosso WhatsApp e anexe a imagem salva. Os detalhes estarão na mensagem.
              </p>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

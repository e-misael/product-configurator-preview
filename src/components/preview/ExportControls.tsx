import { useState } from 'react';
import { TAAVI_WHATSAPP_NUMBER } from '../../config/contact';
import type { ValidationResult } from '../../domain';
import { usePreparedPng } from '../../hooks/usePreparedPng';
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
import {
  canShareFiles,
  shareFile,
  whatsAppNumber,
  whatsAppUrl,
  type ShareOutcome,
} from '../../preview/share';
import { invalidMessage, missingLabel } from '../configurator/messages';
import { EXPORT_MESSAGES, noticeMessage, SHARE_MESSAGES } from './messages';

interface ExportControlsProps {
  /** The preview's own scene: export paints exactly this (D-009). */
  readonly scene: Scene;
  readonly validation: ValidationResult;
  readonly plateId: string | null;
  /** A model group is chosen but not its size (D-057). */
  readonly sizePending?: boolean;
  /** What the image shows (`exportRevision`); the PNG to share is prepared for one. */
  readonly revision: string;
  /** The customer is not editing a step: only then is the PNG to share prepared. */
  readonly active: boolean;
  /** The order request sent with the image (D-076). */
  readonly orderMessage: string;
  /** TAAVI's WhatsApp number; without a valid one the WhatsApp link is not offered (P-16). */
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
 * The finalization actions (D-076): "Compartilhar personalização" where the
 * browser can share PNG files, "Baixar imagem" (FR-07, D-008), and "Abrir
 * WhatsApp da TAAVI" once a number is configured. What still blocks them is
 * listed just above, the one place the configuration's status is shown
 * (D-078; "Configuração completa." once nothing does). Every action stays focusable while blocked
 * (`aria-disabled`) so the reasons can be reached; activation does nothing
 * until they are resolved. Each action starts only from its own tap.
 */
export function ExportControls({
  scene,
  validation,
  plateId,
  sizePending = false,
  revision,
  active,
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

  // Asked once: whether this browser can share PNG files at all.
  const [shareSupported] = useState(() => canShareFiles());
  const prepared = usePreparedPng(
    scene,
    revision,
    exportFileName(plateId ?? ''),
    shareSupported && active && !blocked,
  );
  // The prepared file itself may still be refused.
  const shareable = shareSupported && (prepared.status !== 'ready' || canShareFiles(prepared.file));
  // The share result belongs to the image it was for.
  const [shared, setShared] = useState<{
    revision: string;
    status: ShareOutcome | 'sharing';
  } | null>(null);
  const shareStatus = shared?.revision === revision ? shared.status : undefined;
  const sharing = shareStatus === 'sharing';
  const shareReady = !blocked && prepared.status === 'ready' && !sharing;

  // Opens the share sheet from this tap; never retried or chained to WhatsApp.
  const share = () => {
    if (!shareReady || prepared.status !== 'ready') return;
    const pending = shareFile(prepared.file, orderMessage);
    setShared({ revision, status: 'sharing' });
    void pending.then((status) => setShared({ revision, status }));
  };
  const shareMessage = blocked
    ? undefined
    : shareStatus === 'shared'
      ? SHARE_MESSAGES.shared
      : shareStatus === 'cancelled'
        ? SHARE_MESSAGES.cancelled
        : shareStatus === 'failed' || prepared.status === 'failed'
          ? SHARE_MESSAGES.failed
          : prepared.status === 'preparing'
            ? SHARE_MESSAGES.preparing
            : undefined;
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

  return (
    <div className="export">
      <section className="status" aria-label="Situação da configuração">
        {blocked ? (
          <div className="export__reasons" id="export-reasons">
            <p className="field__info">Para exportar a imagem:</p>
            <ul className="export__list">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="status__summary status__summary--valid">Configuração completa.</p>
        )}
      </section>
      {shareable && (
        <>
          <button
            type="button"
            className="button export__button"
            aria-disabled={!shareReady}
            aria-describedby={blocked ? 'export-reasons' : undefined}
            onClick={share}
          >
            Compartilhar personalização
          </button>
          <p className="field__info" aria-live="polite">
            {shareMessage}
          </p>
        </>
      )}
      <button
        type="button"
        className={`button export__button${shareable ? ' export__button--secondary' : ''}`}
        aria-disabled={blocked || working}
        aria-describedby={blocked ? 'export-reasons' : undefined}
        onClick={() => void exportImage()}
      >
        Baixar imagem
      </button>
      <p className="field__info" aria-live="polite">
        {outcome?.status === 'working' && EXPORT_MESSAGES.working}
        {outcome?.status === 'done' && `${EXPORT_MESSAGES.done} ${outcome.fileName}`}
      </p>
      {outcome?.status === 'error' && (
        <p className="field__error" role="alert">
          {outcome.message}
        </p>
      )}
      {number !== null && (
        <div className="whatsapp">
          <p className="field__legend field__legend--small" id="whatsapp-title">
            Prefere enviar pelo WhatsApp?
          </p>
          <ol className="whatsapp__steps" id="whatsapp-steps">
            <li>Toque em &quot;Baixar imagem&quot; para salvar a imagem no aparelho.</li>
            <li>
              Abra a conversa com a TAAVI e anexe a imagem baixada; os detalhes já vão escritos na
              mensagem.
            </li>
          </ol>
          {blocked ? (
            // Not a link while blocked: an incomplete request cannot be opened.
            <span
              role="link"
              tabIndex={0}
              className="button export__button whatsapp__link"
              aria-disabled="true"
              aria-describedby="export-reasons"
            >
              Abrir WhatsApp da TAAVI
            </span>
          ) : (
            <a
              className="button export__button export__button--secondary whatsapp__link"
              href={whatsAppUrl(number, orderMessage)}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby="whatsapp-steps"
            >
              Abrir WhatsApp da TAAVI
            </a>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { ValidationResult } from '../../domain';
import {
  downloadBlob,
  ExportError,
  exportBlockers,
  exportFileName,
  renderPng,
  type ExportBlocker,
} from '../../preview/export';
import type { Scene } from '../../preview/scene';
import { invalidMessage } from '../configurator/messages';
import { EXPORT_MESSAGES } from './messages';

interface ExportControlsProps {
  /** The preview's own scene: export paints exactly this (D-009). */
  readonly scene: Scene;
  readonly validation: ValidationResult;
  readonly plateId: string | null;
  /** Element listing the preview notices; part of the button's description when they block. */
  readonly noticesId: string;
}

type Outcome =
  | { readonly status: 'working' }
  | { readonly status: 'done'; readonly fileName: string }
  | { readonly status: 'error'; readonly message: string };

/**
 * Configuration issues are listed one by one. Preview problems are already
 * spelled out in the preview notices, so they are summarized once and the
 * notices join the button's description instead of being repeated.
 */
function blockerMessage(blocker: ExportBlocker): string {
  switch (blocker.kind) {
    case 'configuration':
      return invalidMessage(blocker.issue);
    case 'preview':
      return EXPORT_MESSAGES.previewIncomplete;
    case 'empty':
      return EXPORT_MESSAGES.empty;
  }
}

/**
 * "Exportar imagem" (FR-07, D-008). The button stays focusable while export
 * is blocked (`aria-disabled`) so the reasons listed below it can be reached;
 * activation by click or keyboard does nothing until they are resolved.
 */
export function ExportControls({ scene, validation, plateId, noticesId }: ExportControlsProps) {
  // The outcome belongs to the scene it was produced for; any change clears it.
  const [result, setResult] = useState<{ scene: Scene; outcome: Outcome } | null>(null);
  const outcome = result?.scene === scene ? result.outcome : undefined;
  const blockers = exportBlockers(validation, scene);
  const reasons = [...new Set(blockers.map(blockerMessage))];
  const previewBlocked = blockers.some((blocker) => blocker.kind === 'preview');
  const blocked = reasons.length > 0 || plateId === null;
  const working = outcome?.status === 'working';

  const exportImage = async () => {
    if (blocked || working || plateId === null) return;
    const fileName = exportFileName(plateId);
    setResult({ scene, outcome: { status: 'working' } });
    try {
      const blob = await renderPng(scene);
      downloadBlob(blob, fileName);
      setResult({ scene, outcome: { status: 'done', fileName } });
    } catch (error) {
      const message =
        error instanceof ExportError && error.reason === 'invalid-size'
          ? EXPORT_MESSAGES.invalidSize
          : EXPORT_MESSAGES.failed;
      setResult({ scene, outcome: { status: 'error', message } });
    }
  };

  return (
    <div className="export">
      <button
        type="button"
        className="button export__button"
        aria-disabled={blocked || working}
        aria-describedby={
          blocked ? (previewBlocked ? `export-reasons ${noticesId}` : 'export-reasons') : undefined
        }
        onClick={() => void exportImage()}
      >
        Exportar imagem
      </button>
      {blocked && (
        <div className="export__reasons" id="export-reasons">
          <p className="field__info">Para exportar a imagem:</p>
          <ul className="export__list">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
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
  );
}

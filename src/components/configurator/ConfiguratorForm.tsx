import { useMemo } from 'react';
import {
  catalogTextAlign,
  effectivePlacement,
  findPlate,
  findTextColor,
  isDefaultPosition,
  isPlacementFixed,
  letteringText,
  type Catalog,
  type Plate,
} from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { createTextMeasurer } from '../../preview/draw';
import { textBlockOf } from '../../preview/placement';
import { textFrameOf, type Scene } from '../../preview/scene';
import { addsLineBeyondCapacity, lineCapacity } from '../../preview/text-fit';
import { Step } from '../layout/Step';
import { lineLimitMessage, overflowMessage, presetOf } from '../preview/messages';
import { TextPositionControls } from '../preview/TextPositionControls';
import { Disclaimer } from '../review/Disclaimer';
import { FinalizePanel } from '../review/FinalizePanel';
import { NoteField } from '../review/NoteField';
import { ReviewPanel } from '../review/ReviewPanel';
import { reviewSummary } from '../review/review-summary';
import { FontField } from './FontField';
import { FORMATTING_REMOVED_NOTICE } from './messages';
import { sizeLabel, type ModelGroup } from './model-groups';
import { ModelField } from './ModelField';
import { TextColorsField } from './TextColorFields';
import { TextField } from './TextField';

export type StepId = 'model' | 'text' | 'position' | 'review' | 'note';

interface ConfiguratorFormProps {
  readonly catalog: Catalog;
  readonly plate: Plate | undefined;
  readonly state: ReturnType<typeof useConfiguration>;
  /** Model and model-group choice (D-057); see App. */
  readonly model: {
    readonly groups: readonly ModelGroup[];
    readonly group: ModelGroup | undefined;
    readonly sizePending: boolean;
    readonly choosePlate: (plateId: string) => void;
    readonly chooseGroup: (group: ModelGroup) => void;
  };
  readonly scene: Scene;
  /** Steps are collapsible, one open at a time, on narrow screens (D-058). */
  readonly collapsible: boolean;
  readonly openStep: StepId | null;
  readonly onToggleStep: (step: StepId) => void;
  readonly onRestart: () => void;
}

/**
 * The customization in four steps, in order (D-058): model and size, text and
 * colors, position and alignment, then the review; then the optional
 * "Observação", the disclaimer on its own, and, always open, "Finalize seu
 * pedido" with the price, quantity, and actions last (D-078, D-080).
 */
export function ConfiguratorForm({
  catalog,
  plate,
  state,
  model,
  scene,
  collapsible,
  openStep,
  onToggleStep,
  onRestart,
}: ConfiguratorFormProps) {
  const { config, validation } = state;
  // As lettered: capitals for "Sem serifa", the stored text unchanged (D-068).
  const lettered = letteringText(config.text, config.fontFamily);
  // The Bandejas' lettering is always centered, also while their size is still to be chosen (D-068).
  const fixedPlacement = isPlacementFixed(
    plate ??
      (model.sizePending && model.group?.previewPlateId !== undefined
        ? findPlate(catalog, model.group.previewPlateId)
        : undefined),
  );
  const block = textBlockOf(scene);
  const measure = useMemo(() => createTextMeasurer(config.fontFamily), [config.fontFamily]);
  // Line breaks beyond the model's text area are refused (D-063); wrapping still overflows.
  const frame = textFrameOf(plate, scene, config.fontFamily);
  const lineLimit = frame && {
    refuses: (next: string) =>
      addsLineBeyondCapacity(
        lettered,
        letteringText(next, config.fontFamily),
        frame.area,
        frame.fontSize,
        measure,
      ),
    message: lineLimitMessage(lineCapacity(frame.area.height, frame.lineHeight)),
  };
  const placement = effectivePlacement(config, catalog);
  const catalogAlign = catalogTextAlign(plate);
  const preset = presetOf(placement);
  const colorName =
    config.textColorId === null
      ? undefined
      : findTextColor(catalog, config.textColorId)?.displayName;
  const firstLine = lettered.split(/\r\n|\r|\n/)[0] ?? '';
  const noteLine = config.note.trim().split(/\r\n|\r|\n/)[0] ?? '';
  const summary = reviewSummary(
    catalog,
    config,
    plate,
    model.groups,
    model.group,
    model.sizePending,
  );
  const ready = validation.status === 'valid' && scene.notices.length === 0;

  const step = (id: StepId) => ({
    id: `step-${id}`,
    collapsible,
    open: openStep === id,
    onToggle: () => onToggleStep(id),
  });

  return (
    <form className="form" aria-label="Configurar peça" onSubmit={(e) => e.preventDefault()}>
      <Step
        {...step('model')}
        title="Modelo e tamanho"
        summary={
          plate
            ? `${model.group?.name ?? plate.displayName} · ${sizeLabel(model.groups, plate)}`
            : model.sizePending
              ? `${model.group?.name ?? ''} · escolha o tamanho`
              : ''
        }
        complete={plate !== undefined && issueFor(validation, 'plateId') === undefined}
      >
        <ModelField
          catalog={catalog}
          plateId={config.plateId}
          plate={plate}
          groups={model.groups}
          group={model.group}
          issue={issueFor(validation, 'plateId')}
          onChoose={model.choosePlate}
          onChooseGroup={model.chooseGroup}
        />
      </Step>

      <Step
        {...step('text')}
        title="Texto e cores"
        summary={[firstLine === '' ? '' : `“${firstLine}”`, colorName ?? '']
          .filter((part) => part !== '')
          .join(' · ')}
        complete={
          config.text !== '' &&
          config.textColorId !== null &&
          TEXT_FIELDS.every((field) => issueFor(validation, field) === undefined)
        }
      >
        <TextField
          text={config.text}
          issue={issueFor(validation, 'text')}
          onChange={state.setText}
          overflow={
            scene.notices.includes('text-overflow')
              ? overflowMessage(block?.excessLines ?? 0)
              : undefined
          }
          lineLimit={lineLimit}
          uppercase={config.fontFamily === 'sans-serif'}
        />
        {/* Always rendered so assistive technology announces changes. */}
        <p className="status__notice" role="status">
          {state.notice === 'formatting-removed' && FORMATTING_REMOVED_NOTICE}
        </p>
        <FontField fontFamily={config.fontFamily} onChoose={state.setFontFamily} />
        <TextColorsField
          catalog={catalog}
          colorId={config.textColorId}
          colorIssue={issueFor(validation, 'textColorId')}
          highlightEnabled={config.highlightEnabled}
          secondaryColorId={config.secondaryColorId}
          secondaryIssue={issueFor(validation, 'secondaryColorId')}
          ranges={config.secondaryRanges}
          rangeIssue={issueFor(validation, 'secondaryRanges')}
          text={lettered}
          swapped={state.notice === 'colors-swapped'}
          onChoose={state.chooseTextColor}
          onChooseSecondary={state.chooseSecondaryColor}
          onHighlight={state.setHighlightEnabled}
          onToggleWord={state.toggleHighlightWord}
        />
      </Step>

      <Step
        {...step('position')}
        title="Posição do texto"
        summary={
          fixedPlacement
            ? 'centro, fixo'
            : block === undefined
              ? ''
              : ((preset && PRESET_LABEL_SHORT[`${preset.row}-${preset.column}`]) ??
                'personalizada')
        }
        complete={block !== undefined}
      >
        <TextPositionControls
          block={block}
          fixed={fixedPlacement}
          moved={!isDefaultPosition(placement, catalogAlign)}
          onPlace={state.placeText}
          onAlign={state.alignText}
          onReset={state.resetTextLayout}
        />
      </Step>

      <Step
        {...step('review')}
        title="Revisar personalização"
        summary={ready ? 'pronta para exportar' : ''}
        complete={ready}
      >
        <ReviewPanel summary={summary} onRestart={onRestart} />
      </Step>

      <Step
        {...step('note')}
        title="Observação"
        summary={noteLine === '' ? '' : `“${noteLine}”`}
        complete={undefined}
      >
        <NoteField note={config.note} onNote={state.setNote} />
      </Step>

      {/* Between the note and the finalization, outside both (D-080). */}
      <Disclaimer />

      {/* Always open, so the actions are always at hand (D-078). */}
      <Step
        id="step-finalize"
        collapsible={false}
        open
        onToggle={() => undefined}
        title="Finalize seu pedido"
        summary=""
        // No state: it holds the actions, which the page cannot mark done (D-080).
        complete={null}
      >
        <FinalizePanel
          config={config}
          plate={plate}
          summary={summary}
          validation={validation}
          scene={scene}
          sizePending={model.sizePending}
        />
      </Step>
    </form>
  );
}

const TEXT_FIELDS = ['text', 'textColorId', 'secondaryColorId', 'secondaryRanges'] as const;

const PRESET_LABEL_SHORT: Record<string, string> = {
  'top-left': 'superior à esquerda',
  'top-center': 'superior ao centro',
  'top-right': 'superior à direita',
  'middle-left': 'meio à esquerda',
  'middle-center': 'centro',
  'middle-right': 'meio à direita',
  'bottom-left': 'inferior à esquerda',
  'bottom-center': 'inferior ao centro',
  'bottom-right': 'inferior à direita',
};

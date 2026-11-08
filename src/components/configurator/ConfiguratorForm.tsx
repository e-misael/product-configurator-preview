import { useState } from 'react';
import {
  catalogTextAlign,
  effectivePlacement,
  findTextColor,
  isDefaultPosition,
  matchesPreset,
  PRESET_COLUMNS,
  PRESET_ROWS,
  type Catalog,
  type Plate,
} from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { textBlockOf } from '../../preview/placement';
import type { Scene } from '../../preview/scene';
import { Step } from '../layout/Step';
import { TextPositionControls, type PositionMode } from '../preview/TextPositionControls';
import { ReviewPanel } from '../review/ReviewPanel';
import { FontField } from './FontField';
import { FORMATTING_REMOVED_NOTICE } from './messages';
import { sizeLabel, type ModelGroup } from './model-groups';
import { ModelField } from './ModelField';
import { SecondaryColorField, TextColorField } from './TextColorFields';
import { TextField } from './TextField';

export type StepId = 'model' | 'text' | 'position' | 'review';

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
  readonly positionMode: PositionMode;
  readonly onPositionMode: (mode: PositionMode) => void;
}

/**
 * The customization in four steps, in order (D-058): model and size, text and
 * colors, position and alignment, then review with export as the last action.
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
  positionMode,
  onPositionMode,
}: ConfiguratorFormProps) {
  const { config, validation } = state;
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const secondaryIssue = issueFor(validation, 'secondaryColorId');
  // Range actions appear only while a second color is chosen and its options are shown.
  const showRangeActions =
    config.secondaryColorId !== null && (secondaryOpen || secondaryIssue?.kind === 'invalid');
  const block = textBlockOf(scene);
  const placement = effectivePlacement(config, catalog);
  const catalogAlign = catalogTextAlign(plate);
  const preset = PRESET_ROWS.flatMap((row) =>
    PRESET_COLUMNS.map((column) => ({ row, column })),
  ).find(({ row, column }) => matchesPreset(placement, row, column));
  const colorName =
    config.textColorId === null
      ? undefined
      : findTextColor(catalog, config.textColorId)?.displayName;
  const firstLine = config.text.split(/\r\n|\r|\n/)[0] ?? '';

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
          secondary={
            showRangeActions
              ? {
                  rangeCount: config.secondaryRanges.length,
                  issue: issueFor(validation, 'secondaryRanges'),
                  onApply: state.applySecondaryColor,
                  onRemove: state.unapplySecondaryColor,
                }
              : undefined
          }
        />
        {/* Always rendered so assistive technology announces changes. */}
        <p className="status__notice" role="status">
          {state.notice === 'formatting-removed' && FORMATTING_REMOVED_NOTICE}
        </p>
        <FontField fontFamily={config.fontFamily} onChoose={state.setFontFamily} />
        <TextColorField
          catalog={catalog}
          colorId={config.textColorId}
          issue={issueFor(validation, 'textColorId')}
          onChoose={state.chooseTextColor}
        />
        <SecondaryColorField
          catalog={catalog}
          colorId={config.secondaryColorId}
          primaryColorId={config.textColorId}
          rangeCount={config.secondaryRanges.length}
          issue={secondaryIssue}
          open={secondaryOpen}
          onToggle={() => setSecondaryOpen((open) => !open)}
          onChoose={state.chooseSecondaryColor}
          onRemove={state.removeSecondaryColor}
        />
      </Step>

      <Step
        {...step('position')}
        title="Posição do texto"
        summary={
          block === undefined
            ? ''
            : ((preset && PRESET_LABEL_SHORT[`${preset.row}-${preset.column}`]) ?? 'personalizada')
        }
        complete={block !== undefined}
      >
        <TextPositionControls
          block={block}
          moved={!isDefaultPosition(placement, catalogAlign)}
          mode={positionMode}
          onMode={onPositionMode}
          onPlace={state.placeText}
          onAlign={state.alignText}
          onNudge={state.nudgeText}
          onReset={state.resetTextLayout}
        />
      </Step>

      <Step
        {...step('review')}
        title="Revisar personalização"
        summary={
          validation.status === 'valid' && scene.notices.length === 0 ? 'pronta para exportar' : ''
        }
        complete={validation.status === 'valid' && scene.notices.length === 0}
      >
        <ReviewPanel
          catalog={catalog}
          config={config}
          plate={plate}
          groups={model.groups}
          group={model.group}
          sizePending={model.sizePending}
          validation={validation}
          scene={scene}
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

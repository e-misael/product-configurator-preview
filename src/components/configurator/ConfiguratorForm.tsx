import { useState } from 'react';
import type { Catalog, Plate } from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { ConfigurationStatus } from './ConfigurationStatus';
import { FontField } from './FontField';
import type { ModelGroup } from './model-groups';
import { ModelField } from './ModelField';
import { SecondaryColorField, TextColorField } from './TextColorFields';
import { TextField } from './TextField';

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
}

export function ConfiguratorForm({ catalog, plate, state, model }: ConfiguratorFormProps) {
  const { config, validation } = state;
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const secondaryIssue = issueFor(validation, 'secondaryColorId');
  // Range actions appear only while a second color is chosen and its options are shown.
  const showRangeActions =
    config.secondaryColorId !== null && (secondaryOpen || secondaryIssue?.kind === 'invalid');

  return (
    <form className="form" aria-label="Configurar peça" onSubmit={(e) => e.preventDefault()}>
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
      {/* Approved copy (D-056). */}
      <div className="disclaimer">
        <p>
          A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o
          produto final pode apresentar pequenas variações de formato, textura, acabamento,
          posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela.
        </p>
        <p>
          As cores também podem variar conforme a iluminação, as características da cerâmica e as
          configurações de cada dispositivo.
        </p>
        <p>
          Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi.
        </p>
      </div>
      <ConfigurationStatus
        validation={validation}
        notice={state.notice}
        sizePending={model.sizePending}
      />
    </form>
  );
}

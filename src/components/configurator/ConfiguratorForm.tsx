import { useState } from 'react';
import type { Catalog, Plate } from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { ConfigurationStatus } from './ConfigurationStatus';
import { FontField } from './FontField';
import { ModelField } from './ModelField';
import { SecondaryColorField, TextColorField } from './TextColorFields';
import { TextField } from './TextField';

interface ConfiguratorFormProps {
  readonly catalog: Catalog;
  readonly plate: Plate | undefined;
  readonly state: ReturnType<typeof useConfiguration>;
}

export function ConfiguratorForm({ catalog, plate, state }: ConfiguratorFormProps) {
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
        issue={issueFor(validation, 'plateId')}
        onChoose={state.choosePlate}
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
      <p className="disclaimer">
        Todas as solicitações de personalização estão sujeitas à análise da Taavi. Como nossas peças
        são produzidas artesanalmente, podem apresentar pequenas variações de formato, cor,
        acabamento e posicionamento em relação à pré-visualização.
      </p>
      <ConfigurationStatus validation={validation} notice={state.notice} />
    </form>
  );
}

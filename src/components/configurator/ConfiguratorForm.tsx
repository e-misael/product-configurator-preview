import type { Catalog, Plate } from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { ConfigurationStatus } from './ConfigurationStatus';
import { FrameField } from './FrameField';
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

  return (
    <form className="form" aria-label="Configurar peça" onSubmit={(e) => e.preventDefault()}>
      <ModelField
        catalog={catalog}
        plateId={config.plateId}
        plate={plate}
        issue={issueFor(validation, 'plateId')}
        onChoose={state.choosePlate}
      />
      <FrameField
        catalog={catalog}
        frameId={config.frameId}
        plate={plate}
        issue={issueFor(validation, 'frameId')}
        onChoose={state.chooseFrame}
      />
      <TextField
        text={config.text}
        issue={issueFor(validation, 'text')}
        onChange={state.setText}
        secondary={
          config.secondaryColorId === null
            ? undefined
            : {
                rangeCount: config.secondaryRanges.length,
                issue: issueFor(validation, 'secondaryRanges'),
                onApply: state.applySecondaryColor,
                onRemove: state.removeSecondaryColor,
              }
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
        issue={issueFor(validation, 'secondaryColorId')}
        onChoose={state.chooseSecondaryColor}
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

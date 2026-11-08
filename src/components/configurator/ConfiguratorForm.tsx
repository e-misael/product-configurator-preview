import type { Catalog, Plate } from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { ColorField } from './ColorField';
import { ConfigurationStatus } from './ConfigurationStatus';
import { FrameField } from './FrameField';
import { PlateField } from './PlateField';
import { TextField } from './TextField';

interface ConfiguratorFormProps {
  readonly catalog: Catalog;
  readonly plate: Plate | undefined;
  readonly state: ReturnType<typeof useConfiguration>;
}

export function ConfiguratorForm({ catalog, plate, state }: ConfiguratorFormProps) {
  const { config, validation } = state;

  return (
    <form className="form" aria-label="Configurar placa" onSubmit={(e) => e.preventDefault()}>
      <PlateField
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
      <ColorField
        catalog={catalog}
        config={config}
        plate={plate}
        categoryIssue={issueFor(validation, 'colorCategory')}
        colorIssue={issueFor(validation, 'colorId')}
        onChooseCategory={state.chooseColorCategory}
        onChooseColor={state.chooseColor}
      />
      <TextField text={config.text} issue={issueFor(validation, 'text')} onChange={state.setText} />
      <ConfigurationStatus validation={validation} notice={state.notice} />
    </form>
  );
}

import type { Catalog, Plate } from '../../domain';
import { issueFor, type useConfiguration } from '../../hooks/useConfiguration';
import { ConfigurationStatus } from './ConfigurationStatus';
import { FrameField } from './FrameField';
import { ModelField } from './ModelField';
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
      <TextField text={config.text} issue={issueFor(validation, 'text')} onChange={state.setText} />
      <ConfigurationStatus validation={validation} notice={state.notice} />
    </form>
  );
}

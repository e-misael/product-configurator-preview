import { useState, type ReactNode } from 'react';
import { getCatalog } from './catalog';
import { ConfiguratorForm } from './components/configurator/ConfiguratorForm';
import { groupOf, MODEL_GROUPS, type ModelGroup } from './components/configurator/model-groups';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { findPlate, type Catalog } from './domain';
import { useConfiguration } from './hooks/useConfiguration';

interface AppProps {
  /** Defaults to the production catalog; demo mode and tests pass their own. */
  readonly catalog?: Catalog;
  readonly banner?: ReactNode;
  /** Model groups of `catalog` (D-057); defaults to the production table. */
  readonly modelGroups?: readonly ModelGroup[];
}

export function App({ catalog = getCatalog(), banner, modelGroups = MODEL_GROUPS }: AppProps) {
  const state = useConfiguration(catalog);
  const { plateId } = state.config;
  const plate = plateId === null ? undefined : findPlate(catalog, plateId);
  // A model group chosen without its size selects no model yet (D-057).
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const sizePending = plateId === null && pendingGroupId !== null;
  const group =
    groupOf(modelGroups, plateId) ??
    (sizePending ? modelGroups.find((candidate) => candidate.id === pendingGroupId) : undefined);
  const model = {
    groups: modelGroups,
    group,
    sizePending,
    choosePlate: (id: string) => {
      setPendingGroupId(null);
      state.choosePlate(id);
    },
    chooseGroup: (chosen: ModelGroup) => {
      if (chosen.id === group?.id) return;
      setPendingGroupId(chosen.id);
      state.clearPlate();
    },
  };

  return (
    <main className="app">
      {banner}
      <header className="app__header">
        <h1 className="app__title">Taavi Configurator</h1>
        <p className="app__note">Personalize sua peça de cerâmica.</p>
      </header>
      {catalog.plates.length === 0 ? (
        <p className="app__empty">Nenhum modelo disponível no momento.</p>
      ) : (
        <div className="app__layout">
          <PreviewPanel
            catalog={catalog}
            config={state.config}
            plate={plate}
            groups={modelGroups}
            group={group}
            sizePending={sizePending}
            validation={state.validation}
            positioning={{
              place: state.placeText,
              nudge: state.nudgeText,
              reset: state.resetTextLayout,
            }}
          />
          <ConfiguratorForm catalog={catalog} plate={plate} state={state} model={model} />
        </div>
      )}
    </main>
  );
}

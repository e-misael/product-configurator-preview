import type { ReactNode } from 'react';
import { getCatalog } from './catalog';
import { ConfiguratorForm } from './components/configurator/ConfiguratorForm';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { findPlate, type Catalog } from './domain';
import { useConfiguration } from './hooks/useConfiguration';

interface AppProps {
  /** Defaults to the production catalog; demo mode and tests pass their own. */
  readonly catalog?: Catalog;
  readonly banner?: ReactNode;
}

export function App({ catalog = getCatalog(), banner }: AppProps) {
  const state = useConfiguration(catalog);
  const plate =
    state.config.plateId === null ? undefined : findPlate(catalog, state.config.plateId);

  return (
    <main className="app">
      {banner}
      <header className="app__header">
        <h1 className="app__title">Taavi Configurator</h1>
        <p className="app__note">Personalize sua placa de cerâmica.</p>
      </header>
      {catalog.plates.length === 0 ? (
        <p className="app__empty">Nenhuma placa disponível no momento.</p>
      ) : (
        <div className="app__layout">
          <PreviewPanel catalog={catalog} config={state.config} plate={plate} />
          <ConfiguratorForm catalog={catalog} plate={plate} state={state} />
        </div>
      )}
    </main>
  );
}

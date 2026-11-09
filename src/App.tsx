import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getCatalog } from './catalog';
import { ConfiguratorForm, type StepId } from './components/configurator/ConfiguratorForm';
import { groupOf, MODEL_GROUPS, type ModelGroup } from './components/configurator/model-groups';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { findPlate, type Catalog } from './domain';
import { useConfiguration } from './hooks/useConfiguration';
import { usePreviewScene } from './hooks/usePreviewScene';
import { useWideLayout } from './hooks/useWideLayout';

/** TAAVI's online store, as supplied by the product owner (D-079). */
const STORE_URL = 'https://taavi.lojavirtualnuvem.com.br/';
const STORE_DOMAIN = 'taavi.lojavirtualnuvem.com.br';

interface AppProps {
  /** Defaults to the production catalog; demo mode and tests pass their own. */
  readonly catalog?: Catalog;
  readonly banner?: ReactNode;
  /** Model groups of `catalog` (D-057); defaults to the production table. */
  readonly modelGroups?: readonly ModelGroup[];
}

/**
 * The page (D-058): the preview first, so it can stay in view on phones,
 * then the four customization steps. Wide screens show the preview beside
 * the steps, all open; narrow screens show one step at a time.
 *
 * "Reiniciar configurações" mounts a fresh configurator, so every choice,
 * input, and open section returns to its initial state, except the note,
 * which is kept (D-070); then the first step gets focus and the reset is
 * announced.
 *
 * Below the page, outside every panel, a footer links to TAAVI's store in a
 * new tab, so the customization stays open here (D-079).
 */
export function App({ catalog = getCatalog(), banner, modelGroups = MODEL_GROUPS }: AppProps) {
  const [run, setRun] = useState(0);
  const [keptNote, setKeptNote] = useState('');

  useEffect(() => {
    if (run === 0) return;
    const target =
      document.querySelector<HTMLElement>('#step-model-heading button') ??
      document.querySelector<HTMLElement>('#step-model-body input');
    target?.focus();
    window.scrollTo?.({ top: 0 });
  }, [run]);

  return (
    <>
      <main className="app">
        {banner}
        <header className="app__header">
          <h1 className="app__title">Crie sua peça com a TAAVI</h1>
          <p className="app__note">Personalize, visualize e compartilhe sua criação.</p>
        </header>
        <p className="visually-hidden" role="status">
          {run > 0 ? 'Configurações reiniciadas.' : ''}
        </p>
        {catalog.plates.length === 0 ? (
          <p className="app__empty">Nenhum modelo disponível no momento.</p>
        ) : (
          <Configurator
            key={run}
            catalog={catalog}
            modelGroups={modelGroups}
            note={keptNote}
            onRestart={(note) => {
              setKeptNote(note);
              setRun((count) => count + 1);
            }}
          />
        )}
      </main>
      <footer className="app__footer">
        <p>
          Visite nossa loja:{' '}
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${STORE_DOMAIN} (abre em nova aba)`}
          >
            {STORE_DOMAIN}
          </a>
        </p>
      </footer>
    </>
  );
}

interface ConfiguratorProps {
  readonly catalog: Catalog;
  readonly modelGroups: readonly ModelGroup[];
  /** The note kept from before a restart. */
  readonly note: string;
  /** Called with the current note, which survives the restart. */
  readonly onRestart: (note: string) => void;
}

function Configurator({ catalog, modelGroups, note, onRestart }: ConfiguratorProps) {
  const state = useConfiguration(catalog, note);
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

  // Before its size is chosen, a group may show the photograph its sizes share.
  const scene = usePreviewScene(
    catalog,
    state.config,
    state.validation,
    sizePending ? group?.previewPlateId : undefined,
  );
  const wide = useWideLayout();
  const [openStep, setOpenStep] = useState<StepId | null>('model');
  const revealed = useRef<StepId | null>(null);

  // Accordion (WAI-ARIA): focus stays on the activated header; nothing else is focused.
  const toggleStep = (step: StepId) => {
    const next = openStep === step ? null : step;
    setOpenStep(next);
    revealed.current = next;
  };

  // A newly opened step whose heading is off screen or under the sticky preview
  // (a longer step above it closed, or the preview grew) is scrolled just below
  // the preview; otherwise nothing moves. No animation when motion is reduced.
  useEffect(() => {
    const step = revealed.current;
    revealed.current = null;
    if (step === null || wide) return;
    const heading = document.getElementById(`step-${step}-heading`);
    if (heading === null) return;
    const band = document.querySelector('.preview--active')?.getBoundingClientRect();
    const top = heading.getBoundingClientRect().top;
    const covered = band !== undefined && top < band.bottom;
    if (top >= 0 && top < window.innerHeight - heading.offsetHeight && !covered) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    // The page's scroll padding keeps the heading below the preview band (index.css).
    heading.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [openStep, wide]);

  return (
    <div className="app__layout">
      <PreviewPanel
        scene={scene}
        active={plate !== undefined || sizePending}
        sizePending={sizePending}
        expanded={!wide && openStep === 'position'}
        reduced={!wide && openStep === 'text'}
      />
      <ConfiguratorForm
        catalog={catalog}
        plate={plate}
        state={state}
        model={model}
        scene={scene}
        collapsible={!wide}
        openStep={openStep}
        onToggleStep={toggleStep}
        onRestart={() => onRestart(state.config.note)}
      />
    </div>
  );
}

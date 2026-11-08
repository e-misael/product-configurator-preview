import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getCatalog } from './catalog';
import { ConfiguratorForm, type StepId } from './components/configurator/ConfiguratorForm';
import { groupOf, MODEL_GROUPS, type ModelGroup } from './components/configurator/model-groups';
import { PreviewPanel } from './components/preview/PreviewPanel';
import type { PositionMode } from './components/preview/TextPositionControls';
import { findPlate, type Catalog } from './domain';
import { useConfiguration } from './hooks/useConfiguration';
import { usePreviewScene } from './hooks/usePreviewScene';
import { useWideLayout } from './hooks/useWideLayout';

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
 */
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

  // Before its size is chosen, a group may show the photograph its sizes share.
  const scene = usePreviewScene(
    catalog,
    state.config,
    state.validation,
    sizePending ? group?.previewPlateId : undefined,
  );
  const wide = useWideLayout();
  const [openStep, setOpenStep] = useState<StepId | null>('model');
  const [positionMode, setPositionMode] = useState<PositionMode>('presets');
  const revealed = useRef<StepId | null>(null);

  // Accordion (WAI-ARIA): focus stays on the activated header; nothing else is focused.
  const toggleStep = (step: StepId) => {
    const next = openStep === step ? null : step;
    setOpenStep(next);
    // Dragging belongs to the position step: leaving it gives touch scrolling back.
    if (next !== 'position') setPositionMode('presets');
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
            scene={scene}
            active={plate !== undefined || sizePending}
            sizePending={sizePending}
            expanded={!wide && openStep === 'position'}
            reduced={!wide && openStep === 'text'}
            moveMode={positionMode === 'manual'}
            onPlace={state.placeText}
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
            positionMode={positionMode}
            onPositionMode={setPositionMode}
          />
        </div>
      )}
    </main>
  );
}

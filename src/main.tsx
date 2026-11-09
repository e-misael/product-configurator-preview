import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getCatalog } from './catalog';
import type { ModelGroup } from './components/configurator/model-groups';
import { FONT_FAMILIES, type Catalog } from './domain';
// Red Hat Display, self-hosted (OFL-1.1; D-058): Latin covers pt-BR, the weights in use only.
import '@fontsource/red-hat-display/latin-400.css';
import '@fontsource/red-hat-display/latin-500.css';
import '@fontsource/red-hat-display/latin-700.css';
import './index.css';
import { loadLetteringFont } from './preview/font-loading';

// Both lettering fonts start loading at once, so switching fonts never waits (D-072).
for (const family of FONT_FAMILIES) loadLetteringFont(family).catch(() => {});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

/**
 * Demo data is loaded only in demo mode. `import.meta.env.MODE` is replaced
 * at build time, so production builds drop this branch and its chunks
 * (verified by scripts/check-demo-isolation.js, D-028).
 */
async function loadSetup(): Promise<{
  catalog: Catalog;
  banner?: ReactNode;
  modelGroups?: readonly ModelGroup[];
}> {
  if (import.meta.env.MODE === 'demo') {
    const [{ demoCatalog, demoModelGroups }, { DemoBanner }] = await Promise.all([
      import('./demo/demo-catalog'),
      import('./demo/DemoBanner'),
    ]);
    return { catalog: demoCatalog, banner: <DemoBanner />, modelGroups: demoModelGroups };
  }
  return { catalog: getCatalog() };
}

void loadSetup().then(({ catalog, banner, modelGroups }) => {
  createRoot(root).render(
    <StrictMode>
      <App catalog={catalog} banner={banner} {...(modelGroups && { modelGroups })} />
    </StrictMode>,
  );
});

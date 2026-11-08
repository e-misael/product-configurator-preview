import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getCatalog } from './catalog';
import type { Catalog } from './domain';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

/**
 * Demo data is loaded only in demo mode. `import.meta.env.MODE` is replaced
 * at build time, so production builds drop this branch and its chunks
 * (verified by scripts/check-demo-isolation.js, D-028).
 */
async function loadSetup(): Promise<{ catalog: Catalog; banner?: ReactNode }> {
  if (import.meta.env.MODE === 'demo') {
    const [{ demoCatalog }, { DemoBanner }] = await Promise.all([
      import('./demo/demo-catalog'),
      import('./demo/DemoBanner'),
    ]);
    return { catalog: demoCatalog, banner: <DemoBanner /> };
  }
  return { catalog: getCatalog() };
}

void loadSetup().then(({ catalog, banner }) => {
  createRoot(root).render(
    <StrictMode>
      <App catalog={catalog} banner={banner} />
    </StrictMode>,
  );
});

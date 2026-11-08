import '@testing-library/jest-dom/vitest';
import { installFakeCanvas } from './support/fake-canvas';
import { installPointerEvents } from './support/pointer';

installPointerEvents();

// jsdom cannot paint; every test gets a recording fake instead (and no
// "not implemented" noise).
beforeEach(() => {
  installFakeCanvas();
});

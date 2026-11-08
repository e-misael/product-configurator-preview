import '@testing-library/jest-dom/vitest';
import { installFakeCanvas } from './support/fake-canvas';

// jsdom cannot paint; every test gets a recording fake instead (and no
// "not implemented" noise).
beforeEach(() => {
  installFakeCanvas();
});

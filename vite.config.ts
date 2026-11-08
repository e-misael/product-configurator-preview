import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Vite copies the public directory into every build. Demo images live in
  // their own directory that only demo mode serves, so they can never reach
  // a production build (D-036).
  publicDir: mode === 'demo' ? 'src/demo/public' : 'public',
}));

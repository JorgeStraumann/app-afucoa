import { defineConfig } from 'vite';

function normalizeBase(value) {
  const base = value?.trim() || '/';
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('AFUCOA_PUBLIC_BASE debe comenzar y terminar con /.');
  }
  return base;
}

export default defineConfig(({ mode }) => ({
  base: normalizeBase(process.env.AFUCOA_PUBLIC_BASE || (mode === 'staging' ? '/app-afucoa/' : '/')),
  build: {
    sourcemap: false,
  },
}));

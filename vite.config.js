import { defineConfig } from 'vite';

function normalizeBase(value) {
  const base = value.trim();
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('AFUCOA_PUBLIC_BASE debe comenzar y terminar con /.');
  }
  return base;
}

function resolveBase(mode) {
  const explicitBase = process.env.AFUCOA_PUBLIC_BASE?.trim();
  if (mode === 'production' && !explicitBase) {
    throw new Error('AFUCOA_PUBLIC_BASE es obligatoria para production.');
  }
  return normalizeBase(explicitBase || (mode === 'staging' ? '/app-afucoa/' : '/'));
}

function sanitizeProductionDependencyFallbacks(mode) {
  return {
    name: 'afucoa-production-dependency-fallbacks',
    enforce: 'pre',
    transform(code, id) {
      if (mode !== 'production' || !/[\\/]@supabase[\\/]auth-js[\\/]/.test(id)) return null;
      if (!code.includes('http://localhost:9999')) return null;
      // auth-js carries this constructor default even when createClient receives
      // AFUCOA's explicit validated URL. Keep it out of PROD artifacts without
      // changing staging/dev or introducing a reachable fallback.
      return {
        code: code.replaceAll('http://localhost:9999', 'https://invalid.invalid'),
        map: null,
      };
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: resolveBase(mode),
  plugins: [sanitizeProductionDependencyFallbacks(mode)],
  build: {
    sourcemap: false,
  },
}));

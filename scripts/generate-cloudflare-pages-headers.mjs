import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { validateProductionEnv } from './lib/production-env.mjs';
import {
  loadProductionSecurityPolicy,
  materializeCloudflarePagesHeaders,
} from './lib/cloudflare-pages-headers.mjs';

function fail(error) {
  console.error(error?.message || 'No se pudieron generar los headers de Cloudflare Pages.');
  process.exit(1);
}

try {
  const repositoryRoot = process.cwd();
  const viteEnv = loadEnv('production', repositoryRoot, '');
  const config = validateProductionEnv(process.env, { additionalEnvs: [viteEnv] });
  const policy = await loadProductionSecurityPolicy(
    new URL('../config/production-security-headers.json', import.meta.url),
  );
  const mode = process.env.AFUCOA_CLOUDFLARE_HEADERS_MODE;
  const output = materializeCloudflarePagesHeaders(policy, {
    supabaseOrigin: config.supabaseUrl,
    publicBase: config.publicBase,
    mode,
  });
  await writeFile(path.join(repositoryRoot, 'dist', '_headers'), output, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    provider: 'cloudflare-pages',
    mode,
    hsts_materialized: mode === 'canonical-domain',
    csp_connect_origins: 2,
  }));
} catch (error) {
  fail(error);
}


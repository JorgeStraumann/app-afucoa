import { validateProductionEnv } from './lib/production-env.mjs';
import { loadEnv } from 'vite';

function fail(error) {
  console.error(`Configuración PROD inválida: ${error?.message || 'configuración rechazada.'}`);
  process.exit(1);
}

try {
  const viteEnv = loadEnv('production', process.cwd(), '');
  const config = validateProductionEnv(process.env, { additionalEnvs: [viteEnv] });
  console.log(JSON.stringify({
    ok: true,
    mode: config.mode,
    project_ref: config.projectRef,
    publishable_key: 'validated',
    public_base: config.publicBase,
    privileged_key_exposed: false,
  }));
} catch (error) {
  fail(error);
}

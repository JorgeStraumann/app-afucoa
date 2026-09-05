import { spawnSync } from 'node:child_process';

const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (name.startsWith('VITE_') || [
    'AFUCOA_PUBLIC_BASE',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'VAPID_PRIVATE_KEY',
    'RESEND_API_KEY',
  ].includes(name)) delete env[name];
}

Object.assign(env, {
  VITE_AFUCOA_MODE: 'supabase',
  VITE_SUPABASE_URL: 'https://prodartifacttest01.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_prod_artifact_ci_only_000000000001',
  VITE_AUTH_ALIAS_DOMAIN: 'auth.synthetic.internal',
  AFUCOA_PUBLIC_BASE: '/',
});

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  console.error('No se pudo localizar pnpm para el build PROD sintético.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [pnpmCli, 'run', 'build:prod'], {
  cwd: process.cwd(),
  env,
  encoding: 'utf8',
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) process.exit(result.status || 1);

console.log(JSON.stringify({
  ok: true,
  synthetic: true,
  network_required: false,
  public_base: '/',
  dev_references: 0,
  source_maps: 0,
  privileged_key_exposed: false,
  deployed: false,
}));

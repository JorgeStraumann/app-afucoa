import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { validateProductionEnv } from './lib/production-env.mjs';
import { assertCleanGitWorktree, createProductionReleaseManifest, readGitSha } from './lib/production-release.mjs';

function fail(message) {
  console.error(`Manifest PROD inválido: ${message}`);
  process.exit(1);
}

function outputArgument(argv) {
  if (!argv.length) return null;
  if (argv.length !== 2 || argv[0] !== '--output' || !argv[1]) fail('uso: --output <archivo fuera de dist>.');
  return path.resolve(argv[1]);
}

try {
  const repositoryRoot = process.cwd();
  const distDirectory = path.join(repositoryRoot, 'dist');
  const output = outputArgument(process.argv.slice(2));
  if (output) {
    const relative = path.relative(distDirectory, output);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      fail('el manifest de release debe guardarse fuera de dist.');
    }
  }

  const viteEnv = loadEnv('production', repositoryRoot, '');
  const config = validateProductionEnv(process.env, { additionalEnvs: [viteEnv] });
  assertCleanGitWorktree(repositoryRoot);
  const gitSha = readGitSha(repositoryRoot);
  const manifest = await createProductionReleaseManifest({
    repositoryRoot,
    distDirectory,
    gitSha,
    createdAt: new Date().toISOString(),
    projectRef: config.projectRef,
    publicBase: config.publicBase,
  });

  if (!output) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({
      ok: true,
      output: path.relative(repositoryRoot, output).split(path.sep).join('/'),
      git_sha: gitSha,
      files: manifest.files.length,
      edge_functions: manifest.edgeFunctions.length,
      secrets_included: false,
    }));
  }
} catch (error) {
  fail(error?.message || 'no se pudo crear el manifest.');
}

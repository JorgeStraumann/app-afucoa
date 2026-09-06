import path from 'node:path';
import { verifyProductionRelease } from './lib/production-pipeline.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`falta --${name}.`);
  return process.argv[index + 1];
}

try {
  const result = await verifyProductionRelease({
    manifestPath: path.resolve(argument('manifest')),
    distDirectory: path.resolve(argument('dist')),
    expectedReleaseSha: argument('release-sha'),
  });
  console.log(JSON.stringify({
    ok: true,
    release_sha: result.releaseSha,
    manifest_sha256: result.manifestSha256,
    files: result.fileCount,
    rebuilt: false,
  }));
} catch (error) {
  console.error(error?.message || 'No se pudo verificar el release PROD.');
  process.exit(1);
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertCleanGitWorktree, createProductionReleaseManifest, readGitSha } from '../scripts/lib/production-release.mjs';

const repositoryRoot = path.resolve(new URL('../', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));

test('lee un SHA inmutable aun cuando el workspace requiere safe.directory local', () => {
  assert.match(readGitSha(repositoryRoot), /^[0-9a-f]{40}$/);
});

test('release CLI puede exigir un checkout limpio y rechaza contenido no versionado', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'afucoa-git-release-'));
  const git = (...args) => execFileSync('git', ['-c', `safe.directory=${directory.split(path.sep).join('/')}`, ...args], {
    cwd: directory,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  try {
    git('init');
    git('config', 'user.name', 'AFUCOA synthetic test');
    git('config', 'user.email', 'synthetic@example.invalid');
    await writeFile(path.join(directory, 'tracked.txt'), 'approved\n');
    git('add', 'tracked.txt');
    git('commit', '-m', 'synthetic');
    assert.doesNotThrow(() => assertCleanGitWorktree(directory));
    await writeFile(path.join(directory, 'unexpected.txt'), 'dirty\n');
    assert.throws(() => assertCleanGitWorktree(directory), /working tree limpio/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'afucoa-release-'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><script src="/assets/app-a1b2c3.js"></script>');
  await writeFile(path.join(directory, 'manifest.webmanifest'), '{"start_url":"./"}');
  await writeFile(path.join(directory, 'push-sw.js'), "self.addEventListener('push',()=>{});");
  return directory;
}

test('manifest identifica exactamente artefacto, migraciones, policy y Edge sources sin secretos', async () => {
  const distDirectory = await fixture();
  try {
    const input = {
      repositoryRoot,
      distDirectory,
      gitSha: 'a'.repeat(40),
      createdAt: '2026-09-05T12:00:00.000Z',
      projectRef: 'prodartifacttest01',
      publicBase: '/',
    };
    const manifest = await createProductionReleaseManifest(input);
    const repeated = await createProductionReleaseManifest(input);
    assert.deepEqual(manifest, repeated);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.gitSha, input.gitSha);
    assert.equal(manifest.projectRef, input.projectRef);
    assert.equal(manifest.publicBase, '/');
    assert.match(manifest.packageVersion, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(manifest.files.map((file) => file.path), ['index.html', 'manifest.webmanifest', 'push-sw.js']);
    for (const file of manifest.files) assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.match(manifest.migrationManifest.sha256, /^[0-9a-f]{64}$/);
    assert.match(manifest.securityHeadersPolicy.sha256, /^[0-9a-f]{64}$/);
    assert.match(manifest.edgeFunctionsManifest.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(manifest.edgeFunctions.map(({ name }) => name), [
      'request-password-recovery',
      'confirm-password-recovery',
      'push-config',
      'send-notification-push',
    ]);
    for (const edge of manifest.edgeFunctions) assert.match(edge.sourceVersion, /^sha256:[0-9a-f]{64}$/);
    const serialized = JSON.stringify(manifest);
    for (const forbidden of ['publishableKey', 'sb_secret_', 'service_role', 'VAPID_PRIVATE_KEY', 'RESEND_API_KEY', '"password":']) {
      assert.ok(!serialized.includes(forbidden));
    }
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});

test('cambiar un byte del dist cambia el hash del archivo correspondiente', async () => {
  const distDirectory = await fixture();
  try {
    const input = {
      repositoryRoot,
      distDirectory,
      gitSha: 'b'.repeat(40),
      createdAt: '2026-09-05T12:00:00.000Z',
      projectRef: 'prodartifacttest01',
      publicBase: '/',
    };
    const before = await createProductionReleaseManifest(input);
    await writeFile(path.join(distDirectory, 'index.html'), '<!doctype html><p>changed</p>');
    const after = await createProductionReleaseManifest(input);
    assert.notEqual(
      before.files.find((file) => file.path === 'index.html').sha256,
      after.files.find((file) => file.path === 'index.html').sha256,
    );
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});

test('SHA o fecha inválidos impiden crear evidencia ambigua', async () => {
  const distDirectory = await fixture();
  try {
    await assert.rejects(() => createProductionReleaseManifest({
      repositoryRoot,
      distDirectory,
      gitSha: 'moving-branch',
      createdAt: 'invalid',
      projectRef: 'prodartifacttest01',
      publicBase: '/',
    }));
  } finally {
    await rm(distDirectory, { recursive: true, force: true });
  }
});

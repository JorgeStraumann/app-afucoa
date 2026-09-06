import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertDeploymentId,
  assertProductionDeployment,
  assertReleaseSha,
  verifyProductionRelease,
} from '../scripts/lib/production-pipeline.mjs';

const root = new URL('../', import.meta.url);
const fullSha = 'a'.repeat(40);
const deploymentId = 'f7645b3e-61e9-4fb8-b513-f1b741accbc7';

function deployment(overrides = {}) {
  return {
    id: deploymentId,
    project_name: 'afucoa-v2-prod',
    environment: 'production',
    url: 'https://f7645b3e.afucoa-v2-prod.pages.dev',
    created_on: '2026-09-05T12:00:00.000Z',
    modified_on: '2026-09-05T12:01:00.000Z',
    latest_stage: { status: 'success' },
    deployment_trigger: { metadata: { branch: 'afucoa-v2', commit_hash: fullSha } },
    ...overrides,
  };
}

test('release_sha y deployment_id aceptan únicamente identificadores inmutables', () => {
  assert.equal(assertReleaseSha(fullSha), fullSha);
  assert.equal(assertDeploymentId(deploymentId), deploymentId);
  for (const invalid of ['main', 'afucoa-v2', 'a'.repeat(39), 'A'.repeat(40), `${fullSha}x`]) {
    assert.throws(() => assertReleaseSha(invalid));
  }
  for (const invalid of ['', 'preview', '348d68b4-32d3-4cd0-a109-49ef01fbc43']) {
    assert.throws(() => assertDeploymentId(invalid));
  }
});

test('precheck Cloudflare rechaza preview, fallo, otra rama, otro proyecto y SHA distinto', () => {
  assert.doesNotThrow(() => assertProductionDeployment(deployment(), {
    expectedDeploymentId: deploymentId,
    expectedReleaseSha: fullSha,
  }));
  assert.throws(() => assertProductionDeployment(deployment({ environment: 'preview' })));
  assert.throws(() => assertProductionDeployment(deployment({ latest_stage: { status: 'failure' } })));
  assert.throws(() => assertProductionDeployment(deployment({
    deployment_trigger: { metadata: { branch: 'foundation', commit_hash: fullSha } },
  })));
  assert.throws(() => assertProductionDeployment(deployment({ project_name: 'otro-proyecto' })));
  assert.throws(() => assertProductionDeployment(deployment(), { expectedReleaseSha: 'b'.repeat(40) }));
});

test('verificación inmutable detecta bytes extra, alterados o manifest de otro SHA', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'afucoa-pipeline-'));
  const dist = path.join(directory, 'dist');
  const manifestPath = path.join(directory, 'manifest.json');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(dist));
  try {
    await writeFile(path.join(dist, 'index.html'), 'approved');
    const bytes = Buffer.from('approved');
    const sha = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(bytes).digest('hex'));
    await writeFile(manifestPath, JSON.stringify({
      schemaVersion: 1,
      gitSha: fullSha,
      projectRef: 'rywdochyzhgfaymrmxek',
      publicBase: '/',
      files: [{ path: 'index.html', bytes: bytes.length, sha256: sha }],
    }));
    const valid = await verifyProductionRelease({ manifestPath, distDirectory: dist, expectedReleaseSha: fullSha });
    assert.equal(valid.fileCount, 1);
    await writeFile(path.join(dist, 'index.html'), 'changed');
    await assert.rejects(() => verifyProductionRelease({ manifestPath, distDirectory: dist, expectedReleaseSha: fullSha }));
    await writeFile(path.join(dist, 'index.html'), 'approved');
    await writeFile(path.join(dist, 'extra.txt'), 'unexpected');
    await assert.rejects(() => verifyProductionRelease({ manifestPath, distDirectory: dist, expectedReleaseSha: fullSha }));
    await assert.rejects(() => verifyProductionRelease({ manifestPath, distDirectory: dist, expectedReleaseSha: 'b'.repeat(40) }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('workflow de promoción separa prepare de approval/deploy y nunca recompila después', async () => {
  const workflow = await readFile(new URL('.github/workflows/afucoa-v2-production.yml', root), 'utf8');
  const [prepare, deploy] = workflow.split(/^  deploy:/m);
  assert.match(workflow, /^name: AFUCOA V2 production$/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release_sha:/);
  assert.match(workflow, /group: afucoa-v2-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.ok(!prepare.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(!prepare.includes('environment:\n      name: production'));
  assert.match(deploy, /environment:\n      name: production/);
  assert.match(prepare, /pnpm build:prod/);
  assert.ok(!deploy.includes('pnpm build:prod'));
  assert.match(deploy, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(deploy, /verify-production-release\.mjs/);
  assert.match(deploy, /--branch=afucoa-v2/);
  assert.match(deploy, /--commit-hash=/);
  assert.ok(!workflow.includes('write-all'));
  for (const line of workflow.match(/^\s+uses: .+$/gm) || []) assert.match(line, /@[0-9a-f]{40}(?:\s+#.*)?$/);
});

test('workflow rollback usa approval, concurrencia común, precheck y endpoint oficial sin build', async () => {
  const workflow = await readFile(new URL('.github/workflows/afucoa-v2-production-rollback.yml', root), 'utf8');
  const helper = await readFile(new URL('scripts/cloudflare-pages-release.mjs', root), 'utf8');
  assert.match(workflow, /^name: AFUCOA V2 production rollback$/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /deployment_id:/);
  assert.match(workflow, /environment:\n      name: production/);
  assert.match(workflow, /group: afucoa-v2-production/);
  assert.match(workflow, /cloudflare-pages-release\.mjs inspect/);
  assert.match(workflow, /cloudflare-pages-release\.mjs rollback/);
  assert.match(workflow, /production-smoke\.mjs/);
  assert.ok(!workflow.includes('build:prod'));
  assert.ok(!workflow.includes('pages deploy'));
  assert.match(helper, /\/deployments\/\$\{deploymentId\}\/rollback/);
  assert.match(helper, /method: 'POST'/);
  for (const line of workflow.match(/^\s+uses: .+$/gm) || []) assert.match(line, /@[0-9a-f]{40}(?:\s+#.*)?$/);
});

test('smoke PROD permanece público, read-only y sin login', async () => {
  const smoke = await readFile(new URL('scripts/production-smoke.mjs', root), 'utf8');
  assert.match(smoke, /afucoa-v2-prod\.pages\.dev/);
  assert.match(smoke, /rywdochyzhgfaymrmxek\.supabase\.co\/auth\/v1\/settings/);
  assert.ok(!smoke.includes('/auth/v1/token'));
  assert.ok(!smoke.includes('signIn'));
  assert.ok(!smoke.includes('Authorization:'));
});

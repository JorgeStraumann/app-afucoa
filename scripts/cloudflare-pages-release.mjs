import { appendFile, writeFile } from 'node:fs/promises';
import {
  assertDeploymentId,
  assertProductionDeployment,
  assertReleaseSha,
  productionPipeline,
  publicDeploymentRecord,
} from './lib/production-pipeline.mjs';

function argument(name, { optional = false } = {}) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) {
    if (optional) return null;
    throw new Error(`falta --${name}.`);
  }
  return process.argv[index + 1];
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`falta ${name}.`);
  return value.trim();
}

function assertRuntimeConfiguration() {
  const accountId = requiredEnvironment('CLOUDFLARE_ACCOUNT_ID');
  const project = requiredEnvironment('CLOUDFLARE_PAGES_PROJECT');
  const token = requiredEnvironment('CLOUDFLARE_API_TOKEN');
  if (!/^[0-9a-f]{32}$/i.test(accountId)) throw new Error('CLOUDFLARE_ACCOUNT_ID inválido.');
  if (project !== productionPipeline.cloudflareProject) throw new Error('Proyecto Cloudflare inesperado.');
  return { accountId, project, token };
}

async function request(pathname, { method = 'GET' } = {}) {
  const { accountId, project, token } = assertRuntimeConfiguration();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}${pathname}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* error below is deliberately generic */ }
  if (!response.ok || payload?.success !== true) {
    throw new Error(`Cloudflare Pages respondió HTTP ${response.status}; la operación fue rechazada.`);
  }
  return payload.result;
}

async function writeOutputs(record) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  await appendFile(outputFile, [
    `deployment_id=${record.deployment_id}`,
    `deployment_url=${record.url}`,
    `release_sha=${record.release_sha}`,
    `deployment_created_on=${record.created_on}`,
  ].join('\n') + '\n');
}

async function emit(record) {
  const output = argument('output', { optional: true });
  if (output) await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  await writeOutputs(record);
  console.log(JSON.stringify({ ok: true, ...record }));
}

try {
  const command = process.argv[2];
  if (!['inspect', 'latest', 'rollback'].includes(command)) throw new Error('comando esperado: inspect, latest o rollback.');

  if (command === 'latest') {
    const releaseSha = assertReleaseSha(argument('release-sha'));
    const deployments = await request('/deployments?env=production&per_page=25');
    const match = deployments
      .filter((deployment) => deployment.deployment_trigger?.metadata?.commit_hash === releaseSha)
      .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
    assertProductionDeployment(match, { expectedReleaseSha: releaseSha });
    await emit(publicDeploymentRecord(match));
  } else {
    const deploymentId = assertDeploymentId(argument('deployment-id'));
    const before = await request(`/deployments/${deploymentId}`);
    assertProductionDeployment(before, { expectedDeploymentId: deploymentId });
    if (command === 'inspect') {
      await emit(publicDeploymentRecord(before));
    } else {
      const rolledBack = await request(`/deployments/${deploymentId}/rollback`, { method: 'POST' });
      assertProductionDeployment(rolledBack, { expectedDeploymentId: deploymentId });
      await emit({ ...publicDeploymentRecord(rolledBack), rollback_executed: true });
    }
  }
} catch (error) {
  console.error(error?.message || 'Operación Cloudflare Pages inválida.');
  process.exit(1);
}

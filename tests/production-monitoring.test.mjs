import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_HEALTH_KEYS,
  PROD_ORIGIN,
  PROD_SUPABASE_ORIGIN,
  incidentTitle,
  runMonitoringAudit,
  syncIncidentIssues
} from '../scripts/lib/production-monitoring.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const monitors = JSON.parse(read('config/uptimerobot-monitors.json'));
const policy = JSON.parse(read('config/production-monitoring-policy.json'));
const migration = read('supabase/migrations/20260908180819_production_monitoring_health.sql');
const workflow = read('.github/workflows/afucoa-v2-production-monitoring.yml');

test('monitor inventory defines eight contracts and records the FREE-plan coverage honestly', () => {
  assert.equal(monitors.plan, 'FREE');
  assert.equal(monitors.monthlyCostUsd, 0);
  assert.equal(monitors.intervalSeconds, 300);
  assert.equal(monitors.regions, 1);
  assert.equal(monitors.requiredMonitorCount, 8);
  assert.equal(monitors.activeExternalCount, 5);
  assert.equal(monitors.blockedByFreePlanCount, 3);
  assert.equal(monitors.monitors.length, 8);
  assert.deepEqual(new Set(monitors.monitors.map((item) => item.id)), new Set([
    'frontend-https', 'auth-health', 'database-health', 'push-config-security',
    'push-send-security', 'storage-api', 'manifest', 'push-worker'
  ]));
  assert.ok(monitors.monitors.every((item) => item.name.startsWith('AFUCOA PROD - ')));
  assert.ok(monitors.monitors.every((item) => item.url.startsWith('https://')));
  assert.equal(monitors.monitors.filter((item) => item.uptimeRobotStatus === 'ACTIVE').length, 5);
  assert.equal(monitors.monitors.filter((item) => item.uptimeRobotStatus.startsWith('BLOCKED_BY_FREE_PLAN')).length, 3);
  assert.ok(monitors.monitors.filter((item) => item.uptimeRobotStatus.startsWith('BLOCKED_BY_FREE_PLAN')).every((item) => item.activeCheck === 'AUTOMATED_GITHUB'));
  assert.doesNotMatch(JSON.stringify(monitors), /sb_secret_|service_role|VAPID_PRIVATE_KEY|Bearer eyJ/i);
});

test('health migration is parameterless, minimal and deny-by-default except anon execute', () => {
  assert.match(migration, /function public\.production_health\(\)/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.production_health\(\) from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.production_health\(\) to anon/i);
  assert.deepEqual(EXPECTED_HEALTH_KEYS, ['database', 'ok', 'push', 'rls', 'schemaContract', 'storage']);
  const outputContract = migration.match(/jsonb_build_object\(([\s\S]*?)\);/)?.[1] || '';
  assert.doesNotMatch(outputContract, /document_number|full_name|email|phone|endpoint|password|secret/i);
});

test('policy is active and every alert has one approved monitoring mode', () => {
  const modes = new Set(['AUTOMATED_EXTERNAL', 'AUTOMATED_GITHUB', 'SUPABASE_NATIVE_MANUAL', 'INACTIVE_UNTIL_B04', 'BASELINE_PENDING_REAL_TRAFFIC']);
  assert.equal(policy.status, 'ACTIVE / B09 OPERATING');
  for (const alert of policy.alerts) assert.ok(modes.has(alert.monitoringMode), `${alert.id}:${alert.monitoringMode}`);
  assert.ok(policy.alerts.filter((item) => item.component === 'password-recovery-email').every((item) => item.monitoringMode === 'INACTIVE_UNTIL_B04'));
});

test('workflow is scheduled, minimally permissioned and never uses production environment or privileged secrets', () => {
  assert.match(workflow, /cron: '17 \*\/6 \* \* \*'/);
  assert.match(workflow, /contents: read[\s\S]*issues: write/);
  assert.doesNotMatch(workflow, /write-all|environment:\s*production|sb_secret_|service_role|CLOUDFLARE_API_TOKEN|VAPID_PRIVATE_KEY/i);
  assert.match(workflow, /SIMULATE_FAILURE/);
});

function response(status, body, headers = {}, url = PROD_ORIGIN) {
  const value = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  Object.defineProperty(value, 'url', { value: url });
  return value;
}

test('audit validates public contracts and simulation cannot mutate PROD', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).endsWith('.js.map')) return response(404, {});
    if (String(url) === `${PROD_ORIGIN}/`) return response(200, '<title>AFUCOA</title><script src="/assets/app.js"></script>', {
      'content-type': 'text/html', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff'
    }, `${PROD_ORIGIN}/`);
    if (String(url).endsWith('/assets/app.js')) return response(200, 'console.log("safe")', { 'content-type': 'application/javascript' });
    if (String(url).endsWith('/manifest.webmanifest')) return response(200, { display: 'standalone' });
    if (String(url).endsWith('/push-sw.js')) return response(200, "self.addEventListener('push',()=>{}); const notification_id=true;");
    if (String(url).endsWith('/auth/v1/health')) return response(200, { name: 'GoTrue' });
    if (String(url).endsWith('/rest/v1/rpc/production_health')) return response(200, { ok: true, database: true, rls: true, storage: true, push: true, schemaContract: 19 });
    if (String(url).includes('/functions/v1/')) return response(401, { error: 'not_authenticated' });
    if (String(url).includes('/storage/v1/object/public/')) return response(400, { code: 'NoSuchKey', message: 'Object not found' });
    throw new Error(`unexpected:${url}`);
  };
  const results = await runMonitoringAudit({ publishableKey: 'sb_publishable_test_value', simulateFailure: true }, { fetchImpl, attempts: 1 });
  assert.equal(results.filter((item) => !item.ok).length, 1);
  assert.equal(results.find((item) => !item.ok).id, 'monitoring-simulation');
  assert.ok(calls.every((call) => ['GET', 'POST'].includes(call.method)));
  assert.ok(calls.every((call) => call.url.startsWith(PROD_ORIGIN) || call.url.startsWith(PROD_SUPABASE_ORIGIN)));
});

function githubMock(initialIssues = []) {
  const requests = [];
  let issues = structuredClone(initialIssues);
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    const pathname = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ method, pathname, body });
    if (method === 'GET' && pathname.endsWith('/issues')) return response(200, issues);
    const comment = pathname.match(/\/issues\/(\d+)\/comments$/);
    if (method === 'POST' && comment) return response(201, { id: requests.length });
    const issue = pathname.match(/\/issues\/(\d+)$/);
    if (method === 'PATCH' && issue) {
      const target = issues.find((item) => item.number === Number(issue[1]));
      Object.assign(target, body);
      return response(200, target);
    }
    if (method === 'POST' && pathname.endsWith('/issues')) {
      const created = { number: issues.length + 1, state: 'open', ...body };
      issues.push(created);
      return response(201, created);
    }
    throw new Error(`${method}:${pathname}`);
  };
  return { fetchImpl, requests, issues };
}

test('incident synchronization deduplicates failures and closes recovered issues', async () => {
  const definition = { id: 'monitoring-simulation', alertId: 'monitoring-simulation', severity: 'SEV3', component: 'monitoring', runbook: 'docs/INCIDENT_RESPONSE.md' };
  const title = incidentTitle(definition);
  const mock = githubMock([{ number: 7, title, state: 'open' }]);
  const context = { repository: 'owner/repo', workflowUrl: 'https://github.test/run/1', sha: 'a'.repeat(40), timestamp: '2026-09-08T00:00:00.000Z' };
  let actions = await syncIncidentIssues([{ ...definition, ok: false, status: null, reason: 'simulated_local_failure' }], context, { token: 'test', fetchImpl: mock.fetchImpl });
  assert.deepEqual(actions, [{ alertId: 'monitoring-simulation', action: 'updated', issue: 7 }]);
  assert.equal(mock.requests.filter((item) => item.method === 'POST' && item.pathname.endsWith('/issues')).length, 0);
  actions = await syncIncidentIssues([{ ...definition, ok: true, status: null, reason: 'simulation_disabled' }], context, { token: 'test', fetchImpl: mock.fetchImpl });
  assert.deepEqual(actions, [{ alertId: 'monitoring-simulation', action: 'closed', issue: 7 }]);
  assert.equal(mock.issues[0].state, 'closed');
  assert.ok(mock.requests.some((item) => item.pathname.endsWith('/comments') && /RECOVERED/.test(item.body.body)));
});

test('issue content and sources remain redacted', () => {
  const sources = [read('scripts/production-monitoring-audit.mjs'), read('scripts/lib/production-monitoring.mjs'), workflow].join('\n');
  assert.doesNotMatch(sources, /console\.(?:log|error)\([^\n]*(?:body|publishableKey|token)/i);
  const environmentReads = [...sources.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]);
  assert.ok(environmentReads.every((name) => !/SECRET|SERVICE_ROLE|VAPID_PRIVATE|PASSWORD|TOTP|JWT/.test(name)), environmentReads.join(','));
  assert.doesNotMatch(workflow, /AFUCOA_PROD_SECRET|SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY/);
});

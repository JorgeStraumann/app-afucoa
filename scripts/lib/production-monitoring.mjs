export const PROD_ORIGIN = 'https://afucoa-v2-prod.pages.dev';
export const PROD_SUPABASE_ORIGIN = 'https://rywdochyzhgfaymrmxek.supabase.co';
export const DEV_PROJECT_REF = 'imiplnspvmsrsuikulwm';
export const EXPECTED_HEALTH_KEYS = ['database', 'ok', 'push', 'rls', 'schemaContract', 'storage'];

const CHECK_DEFINITIONS = [
  { id: 'frontend-https', alertId: 'frontend-total-outage', severity: 'SEV1', component: 'frontend-hosting', runbook: 'docs/runbooks/FRONTEND_OUTAGE.md' },
  { id: 'frontend-headers', alertId: 'frontend-release-contract-mismatch', severity: 'SEV2', component: 'frontend-hosting', runbook: 'docs/runbooks/FRONTEND_OUTAGE.md' },
  { id: 'manifest', alertId: 'frontend-release-contract-mismatch', severity: 'SEV2', component: 'frontend-hosting', runbook: 'docs/runbooks/FRONTEND_OUTAGE.md' },
  { id: 'push-worker', alertId: 'frontend-release-contract-mismatch', severity: 'SEV2', component: 'frontend-hosting', runbook: 'docs/runbooks/FRONTEND_OUTAGE.md' },
  { id: 'auth-health', alertId: 'auth-general-outage', severity: 'SEV1', component: 'auth', runbook: 'docs/runbooks/AUTH_OUTAGE.md' },
  { id: 'database-health', alertId: 'database-unavailable-or-data-loss', severity: 'SEV1', component: 'supabase-database', runbook: 'docs/runbooks/DATABASE_INCIDENT.md' },
  { id: 'push-config-security', alertId: 'edge-functions-sustained-failure', severity: 'SEV2', component: 'edge-functions', runbook: 'docs/runbooks/EDGE_FUNCTION_INCIDENT.md' },
  { id: 'push-send-security', alertId: 'edge-functions-sustained-failure', severity: 'SEV2', component: 'edge-functions', runbook: 'docs/runbooks/EDGE_FUNCTION_INCIDENT.md' },
  { id: 'recovery-request-cors', alertId: 'password-recovery-broad-failure', severity: 'SEV2', component: 'password-recovery-email', runbook: 'docs/runbooks/PASSWORD_RECOVERY_INCIDENT.md' },
  { id: 'recovery-confirm-cors', alertId: 'password-recovery-broad-failure', severity: 'SEV2', component: 'password-recovery-email', runbook: 'docs/runbooks/PASSWORD_RECOVERY_INCIDENT.md' },
  { id: 'storage-api', alertId: 'storage-broad-failure', severity: 'SEV2', component: 'storage', runbook: 'docs/runbooks/DATABASE_INCIDENT.md' },
  { id: 'public-artifact-security', alertId: 'suspected-secret-exposure', severity: 'SEV1', component: 'security', runbook: 'docs/runbooks/SECRET_EXPOSURE.md' },
  { id: 'monitoring-simulation', alertId: 'monitoring-simulation', severity: 'SEV3', component: 'monitoring', runbook: 'docs/INCIDENT_RESPONSE.md' }
];

export function getCheckDefinition(id) {
  return CHECK_DEFINITIONS.find((item) => item.id === id);
}

export function incidentTitle(definition) {
  return `[PROD MONITOR][${definition.alertId}] ${definition.component}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBounded(url, options = {}, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const attempts = dependencies.attempts ?? 2;
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, redirect: options.redirect || 'manual', signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(400 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`request_failed:${lastError?.name || 'unknown'}`);
}

function result(id, ok, startedAt, technical = {}) {
  const definition = getCheckDefinition(id);
  return {
    ...definition,
    ok,
    latencyMs: Date.now() - startedAt,
    status: Number.isInteger(technical.status) ? technical.status : null,
    reason: technical.reason || (ok ? 'contract_ok' : 'contract_failed')
  };
}

async function check(id, task) {
  const startedAt = Date.now();
  try {
    return await task(startedAt);
  } catch (error) {
    return result(id, false, startedAt, { reason: String(error?.message || 'check_error').slice(0, 120) });
  }
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

function exactHealthContract(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys) === JSON.stringify(EXPECTED_HEALTH_KEYS)
    && value.ok === true
    && value.database === true
    && value.rls === true
    && value.storage === true
    && value.push === true
    && value.schemaContract === 19;
}

export async function runMonitoringAudit({ publishableKey, simulateFailure = false }, dependencies = {}) {
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '')) throw new Error('missing_or_invalid_publishable_key');
  const request = (url, options) => fetchBounded(url, options, dependencies);
  const apiHeaders = { apikey: publishableKey };
  const originHeaders = { ...apiHeaders, Origin: PROD_ORIGIN, 'Content-Type': 'application/json' };

  const checks = [];
  checks.push(await check('frontend-https', async (startedAt) => {
    const response = await request(`${PROD_ORIGIN}/`);
    const body = await response.text();
    return result('frontend-https', response.status === 200 && response.url.startsWith(PROD_ORIGIN) && /AFUCOA/i.test(body), startedAt, { status: response.status });
  }));

  checks.push(await check('frontend-headers', async (startedAt) => {
    const response = await request(`${PROD_ORIGIN}/`);
    const csp = response.headers.get('content-security-policy') || '';
    const ok = response.status === 200
      && /max-age=\d+/i.test(response.headers.get('strict-transport-security') || '')
      && (response.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff'
      && (/frame-ancestors/i.test(csp) || /deny|sameorigin/i.test(response.headers.get('x-frame-options') || ''));
    return result('frontend-headers', ok, startedAt, { status: response.status });
  }));

  checks.push(await check('manifest', async (startedAt) => {
    const response = await request(`${PROD_ORIGIN}/manifest.webmanifest`);
    const body = await safeJson(response);
    return result('manifest', response.status === 200 && body?.display === 'standalone', startedAt, { status: response.status });
  }));

  checks.push(await check('push-worker', async (startedAt) => {
    const response = await request(`${PROD_ORIGIN}/push-sw.js`);
    const body = await response.text();
    const ok = response.status === 200 && body.includes("addEventListener('push'") && body.includes('notification_id');
    return result('push-worker', ok, startedAt, { status: response.status });
  }));

  checks.push(await check('auth-health', async (startedAt) => {
    const response = await request(`${PROD_SUPABASE_ORIGIN}/auth/v1/health`, { headers: apiHeaders });
    const body = await safeJson(response);
    const service = String(body?.name || body?.service || '').toLowerCase();
    return result('auth-health', response.status === 200 && service.includes('gotrue'), startedAt, { status: response.status });
  }));

  checks.push(await check('database-health', async (startedAt) => {
    const response = await request(`${PROD_SUPABASE_ORIGIN}/rest/v1/rpc/production_health`, {
      method: 'POST', headers: { ...apiHeaders, 'Content-Type': 'application/json' }, body: '{}'
    });
    const body = await safeJson(response);
    return result('database-health', response.status === 200 && exactHealthContract(body), startedAt, { status: response.status });
  }));

  for (const [id, slug] of [['push-config-security', 'push-config'], ['push-send-security', 'send-notification-push']]) {
    checks.push(await check(id, async (startedAt) => {
      const response = await request(`${PROD_SUPABASE_ORIGIN}/functions/v1/${slug}`, { method: 'POST', headers: originHeaders, body: '{}' });
      return result(id, response.status === 401, startedAt, { status: response.status });
    }));
  }

  for (const [id, slug] of [
    ['recovery-request-cors', 'request-password-recovery'],
    ['recovery-confirm-cors', 'confirm-password-recovery']
  ]) {
    checks.push(await check(id, async (startedAt) => {
      const response = await request(`${PROD_SUPABASE_ORIGIN}/functions/v1/${slug}`, {
        method: 'OPTIONS', headers: { ...apiHeaders, Origin: PROD_ORIGIN }
      });
      const allowedMethods = response.headers.get('access-control-allow-methods') || '';
      const ok = response.status === 204
        && response.headers.get('access-control-allow-origin') === PROD_ORIGIN
        && /(?:^|,\s*)POST(?:,|$)/i.test(allowedMethods)
        && /(?:^|,\s*)OPTIONS(?:,|$)/i.test(allowedMethods);
      return result(id, ok, startedAt, { status: response.status });
    }));
  }

  checks.push(await check('storage-api', async (startedAt) => {
    const response = await request(`${PROD_SUPABASE_ORIGIN}/storage/v1/object/public/public-media/__afucoa_monitor__/not-found`, { headers: apiHeaders });
    const body = await safeJson(response);
    return result('storage-api', response.status === 400 && body?.code === 'NoSuchKey' && body?.message === 'Object not found', startedAt, { status: response.status });
  }));

  checks.push(await check('public-artifact-security', async (startedAt) => {
    const indexResponse = await request(`${PROD_ORIGIN}/`);
    const indexBody = await indexResponse.text();
    const assetPaths = [...indexBody.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map((match) => match[1]);
    const bodies = [indexBody];
    let sourcemapFound = false;
    for (const assetPath of assetPaths) {
      const assetUrl = new URL(assetPath, PROD_ORIGIN).href;
      const response = await request(assetUrl);
      const body = await response.text();
      bodies.push(body);
      if (/sourceMappingURL=/i.test(body)) sourcemapFound = true;
      if (assetUrl.endsWith('.js')) {
        const mapResponse = await request(`${assetUrl}.map`);
        const mapType = mapResponse.headers.get('content-type') || '';
        const mapBody = await mapResponse.text();
        if (mapResponse.status === 200 && (/json|javascript/i.test(mapType) || /"sources"\s*:/.test(mapBody))) sourcemapFound = true;
      }
    }
    const combined = bodies.join('\n');
    const privileged = /sb_secret_[A-Za-z0-9_-]{16,}|(?:service_role|secret)["'\s:=]+eyJ[A-Za-z0-9_-]{20,}|(?:VAPID_PRIVATE_KEY|RESEND_API_KEY|BREVO_API_KEY)["'\s:=]+[A-Za-z0-9_-]{16,}|\bxkeysib-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i.test(combined);
    const devRef = combined.includes(DEV_PROJECT_REF);
    return result('public-artifact-security', indexResponse.status === 200 && assetPaths.length > 0 && !sourcemapFound && !privileged && !devRef, startedAt, { status: indexResponse.status });
  }));

  checks.push(result('monitoring-simulation', !simulateFailure, Date.now(), { reason: simulateFailure ? 'simulated_local_failure' : 'simulation_disabled' }));
  return checks;
}

async function githubRequest(path, options, dependencies) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const response = await fetchImpl(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${dependencies.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  if (!response.ok) throw new Error(`github_api_${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

export async function syncIncidentIssues(checks, context, dependencies = {}) {
  if (!dependencies.token || !context.repository) throw new Error('github_issue_context_missing');
  const [owner, repo] = context.repository.split('/');
  if (!owner || !repo) throw new Error('github_repository_invalid');
  const root = `/repos/${owner}/${repo}`;
  const groups = new Map();
  for (const checkResult of checks) {
    const group = groups.get(checkResult.alertId) || { definition: checkResult, results: [] };
    group.results.push(checkResult);
    groups.set(checkResult.alertId, group);
  }

  const actions = [];
  for (const { definition, results } of groups.values()) {
    const title = incidentTitle(definition);
    const issues = await githubRequest(`${root}/issues?state=all&per_page=100`, { method: 'GET' }, dependencies);
    const matches = issues.filter((issue) => !issue.pull_request && issue.title === title);
    const openIssue = matches.find((issue) => issue.state === 'open');
    const failed = results.filter((item) => !item.ok);
    const now = context.timestamp;

    if (failed.length > 0) {
      const technicalState = failed.map((item) => `${item.id}:${item.status ?? item.reason}`).join(', ');
      const body = [
        `Alert ID: \`${definition.alertId}\``,
        `Severity: \`${definition.severity}\``,
        `UTC timestamp: \`${now}\``,
        `Component: \`${definition.component}\``,
        `Technical state: \`${technicalState}\``,
        `SHA: \`${context.sha}\``,
        `Runbook: \`${definition.runbook}\``,
        `Workflow: ${context.workflowUrl}`,
        '',
        'No PII, credentials, response bodies or private endpoints are included.'
      ].join('\n');
      if (openIssue) {
        await githubRequest(`${root}/issues/${openIssue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `FAILED again at \`${now}\`. ${technicalState}. Workflow: ${context.workflowUrl}` }) }, dependencies);
        actions.push({ alertId: definition.alertId, action: 'updated', issue: openIssue.number });
      } else if (matches[0]) {
        await githubRequest(`${root}/issues/${matches[0].number}`, { method: 'PATCH', body: JSON.stringify({ state: 'open', body }) }, dependencies);
        actions.push({ alertId: definition.alertId, action: 'reopened', issue: matches[0].number });
      } else {
        const created = await githubRequest(`${root}/issues`, { method: 'POST', body: JSON.stringify({ title, body, labels: ['production-monitoring', definition.severity.toLowerCase()] }) }, dependencies);
        actions.push({ alertId: definition.alertId, action: 'created', issue: created.number });
      }
    } else if (openIssue) {
      await githubRequest(`${root}/issues/${openIssue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `RECOVERED at \`${now}\`. Workflow: ${context.workflowUrl}` }) }, dependencies);
      await githubRequest(`${root}/issues/${openIssue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) }, dependencies);
      actions.push({ alertId: definition.alertId, action: 'closed', issue: openIssue.number });
    }
  }
  return actions;
}

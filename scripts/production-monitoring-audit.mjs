import { runMonitoringAudit, syncIncidentIssues } from './lib/production-monitoring.mjs';

const publishableKey = process.env.AFUCOA_PROD_PUBLISHABLE_KEY || '';
const simulateFailure = String(process.env.SIMULATE_FAILURE || 'false').toLowerCase() === 'true';
const timestamp = new Date().toISOString();

const checks = await runMonitoringAudit({ publishableKey, simulateFailure });
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} status=${item.status ?? 'n/a'} latency_ms=${item.latencyMs} reason=${item.reason}`);
}

if (process.env.GITHUB_TOKEN) {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const workflowUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID || 'unknown'}`;
  const actions = await syncIncidentIssues(checks, {
    repository,
    workflowUrl,
    sha: process.env.GITHUB_SHA || 'unknown',
    timestamp
  }, { token: process.env.GITHUB_TOKEN });
  for (const action of actions) console.log(`ISSUE ${action.alertId} ${action.action} #${action.issue}`);
}

const failures = checks.filter((item) => !item.ok);
if (failures.length > 0) {
  console.error(`Production monitoring audit: FAIL (${failures.length}/${checks.length})`);
  process.exitCode = 1;
} else {
  console.log(`Production monitoring audit: PASS (${checks.length}/${checks.length})`);
}

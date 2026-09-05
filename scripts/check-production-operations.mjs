import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..');

export const requiredDocuments = [
  'docs/PRODUCTION_MONITORING.md',
  'docs/PRODUCTION_SLO.md',
  'docs/INCIDENT_RESPONSE.md',
  'docs/BACKUP_RESTORE.md',
  'docs/DATA_RETENTION.md',
  'docs/PRODUCTION_CUTOVER_CHECKLIST.md',
  'docs/runbooks/FRONTEND_OUTAGE.md',
  'docs/runbooks/AUTH_OUTAGE.md',
  'docs/runbooks/DATABASE_INCIDENT.md',
  'docs/runbooks/PASSWORD_RECOVERY_INCIDENT.md',
  'docs/runbooks/WEB_PUSH_INCIDENT.md',
  'docs/runbooks/EDGE_FUNCTION_INCIDENT.md',
  'docs/runbooks/SECRET_EXPOSURE.md',
  'docs/runbooks/DNS_TLS_INCIDENT.md',
  'docs/runbooks/RESTORE_DRILL.md',
  'docs/runbooks/SECRET_ROTATION.md'
];

const declarativeFiles = [
  'config/production-monitoring-policy.json',
  'config/production-smoke-checks.json'
];

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function hasNumber(value) {
  return /\d/.test(String(value));
}

export function validatePolicy(policy, root = repoRoot) {
  const errors = [];
  if (policy?.schemaVersion !== 1) errors.push('monitoring policy: schemaVersion must be 1');
  if (policy?.environment !== 'production-only') errors.push('monitoring policy: environment must be production-only');
  if (policy?.calibrationRequired !== true) errors.push('monitoring policy: calibrationRequired must be true');
  if (policy?.privacy?.allowPII !== false) errors.push('monitoring policy: PII must be forbidden');
  if (policy?.privacy?.allowFullPushEndpoints !== false) errors.push('monitoring policy: full push endpoints must be forbidden');
  if (!Array.isArray(policy?.alerts) || policy.alerts.length === 0) {
    errors.push('monitoring policy: alerts must be a non-empty array');
    return errors;
  }

  const ids = new Set();
  const allowedSeverities = new Set(['SEV1', 'SEV2', 'SEV3']);
  for (const [index, alert] of policy.alerts.entries()) {
    const label = alert?.id || `index ${index}`;
    for (const field of ['id', 'component', 'signal', 'severity', 'window', 'condition', 'owner', 'action', 'runbook']) {
      if (typeof alert?.[field] !== 'string' || alert[field].trim() === '') {
        errors.push(`alert ${label}: missing ${field}`);
      }
    }
    if (ids.has(alert?.id)) errors.push(`alert ${label}: duplicate id`);
    ids.add(alert?.id);
    if (!allowedSeverities.has(alert?.severity)) errors.push(`alert ${label}: invalid severity`);
    if (typeof alert?.immediate !== 'boolean') errors.push(`alert ${label}: immediate must be boolean`);
    if ((hasNumber(alert?.window) || hasNumber(alert?.condition)) && alert?.provisional !== true) {
      errors.push(`alert ${label}: numeric threshold/window must be provisional`);
    }
    if (typeof alert?.provisional !== 'boolean') errors.push(`alert ${label}: provisional must be boolean`);
    if (typeof alert?.runbook === 'string') {
      if (!alert.runbook.startsWith('docs/runbooks/')) errors.push(`alert ${label}: runbook must live under docs/runbooks`);
      else if (!fs.existsSync(path.join(root, alert.runbook))) errors.push(`alert ${label}: runbook does not exist`);
    }
  }
  return errors;
}

export function validateSmokeContract(smoke) {
  const errors = [];
  const expectedConstraints = [
    'destructive',
    'usesRealUsers',
    'createsBusinessData',
    'sendsBulkNotifications',
    'runsRecurringRealRecovery',
    'pushesToRealPeople'
  ];
  if (smoke?.status !== 'DESIGN ONLY / NOT ACTIVE') errors.push('smoke checks must remain design-only');
  for (const key of expectedConstraints) {
    if (smoke?.constraints?.[key] !== false) errors.push(`smoke checks: ${key} must be false`);
  }
  if (!/distinct from every DEV identity/i.test(smoke?.constraints?.syntheticIdentities || '')) {
    errors.push('smoke checks: future PROD identities must be distinct from DEV');
  }
  if (!Array.isArray(smoke?.checks) || smoke.checks.length === 0) errors.push('smoke checks must be non-empty');
  for (const check of smoke?.checks || []) {
    if (!check.id || !check.audience || !check.method || !check.target || !Array.isArray(check.assertions)) {
      errors.push(`smoke check ${check?.id || 'unknown'} is incomplete`);
    }
    if (check.mutatesState !== false) errors.push(`smoke check ${check?.id || 'unknown'} must be read-only`);
  }
  const audiences = new Set((smoke?.checks || []).map((item) => item.audience));
  for (const required of ['public', 'authenticated-synthetic', 'admin-synthetic']) {
    if (!audiences.has(required)) errors.push(`smoke checks: missing audience ${required}`);
  }
  return errors;
}

function scanContent(root, files) {
  const errors = [];
  const devProjectRef = ['imiplnspvmsrsu', 'ikulwm'].join('');
  const stagingHost = ['jorgestraumann.github.io', '/app-afucoa'].join('');
  const secretPatterns = [
    /sb_secret_[A-Za-z0-9_-]{16,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:service_role|secret)["'\s:=]+eyJ[A-Za-z0-9_-]{20,}/i,
    /(?:RESEND_API_KEY|VAPID_PRIVATE_KEY)["'\s:=]+[A-Za-z0-9_-]{16,}/
  ];

  for (const file of files) {
    const content = read(root, file);
    if (content.includes(devProjectRef)) errors.push(`${file}: contains DEV project ref`);
    if (/https?:\/\/localhost(?::\d+)?/i.test(content)) errors.push(`${file}: contains localhost URL`);
    if (content.includes(stagingHost)) errors.push(`${file}: contains GitHub staging host`);
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) errors.push(`${file}: contains secret-like material`);
    }
    if (/AFUCOA(?: V2)? (?:está|queda) lista para producción/i.test(content)) {
      errors.push(`${file}: declares AFUCOA production ready`);
    }
  }
  return errors;
}

export function validateOperations(root = repoRoot) {
  const errors = [];
  for (const file of [...requiredDocuments, ...declarativeFiles]) {
    if (!fs.existsSync(path.join(root, file))) errors.push(`missing required file: ${file}`);
  }
  if (errors.length > 0) return { ok: false, errors, checkedFiles: 0, alertCount: 0, smokeCount: 0 };

  const policy = JSON.parse(read(root, 'config/production-monitoring-policy.json'));
  const smoke = JSON.parse(read(root, 'config/production-smoke-checks.json'));
  errors.push(...validatePolicy(policy, root));
  errors.push(...validateSmokeContract(smoke));

  const scannedFiles = [...requiredDocuments, ...declarativeFiles];
  errors.push(...scanContent(root, scannedFiles));
  const readiness = read(root, 'docs/PRODUCTION_READINESS.md');
  if (/AFUCOA(?: V2)? (?:está|queda) lista para producción/i.test(readiness)) {
    errors.push('production readiness: declares AFUCOA production ready');
  }

  const backup = read(root, 'docs/BACKUP_RESTORE.md');
  if (!/RPO[\s\S]*PENDING AFUCOA APPROVAL/i.test(backup)) errors.push('backup: RPO is not pending AFUCOA approval');
  if (!/RTO[\s\S]*PENDING AFUCOA APPROVAL/i.test(backup)) errors.push('backup: RTO is not pending AFUCOA approval');
  if (!backup.includes('RESTORE REAL: NOT EXECUTED')) errors.push('backup: real restore must be explicitly not executed');

  const drill = read(root, 'docs/runbooks/RESTORE_DRILL.md');
  if (!drill.includes('RESTORE REAL: NOT EXECUTED')) errors.push('restore drill: real restore must be explicitly not executed');
  if (/restore real (?:fue|ha sido) (?:ejecutado|completado)/i.test(`${backup}\n${drill}`)) {
    errors.push('restore documentation claims a real restore ran');
  }

  const retention = read(root, 'docs/DATA_RETENTION.md');
  if (!retention.includes('NO AUTOMATIC PURGE ENABLED')) errors.push('retention: automatic purge must be explicitly disabled');
  if (/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i.test(retention)) errors.push('retention: destructive SQL is forbidden');

  const slo = read(root, 'docs/PRODUCTION_SLO.md');
  if (!/no garantiza exactly-once/i.test(slo)) errors.push('SLO: Web Push exactly-once disclaimer is missing');
  if (/garantiza (?:la )?entrega exactly-once/i.test(slo)) errors.push('SLO: exactly-once is promised');
  if (/SLO (?:propuesto )?(?:de|para) ["“]?toast[^\n]*\d/i.test(slo)) {
    errors.push('SLO: forbidden Web Push outcome target');
  }

  const runbookContent = requiredDocuments
    .filter((file) => file.startsWith('docs/runbooks/'))
    .map((file) => read(root, file))
    .join('\n');
  if (/\brm\s+-rf\b|\bsupabase\s+db\s+reset\b|\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i.test(runbookContent)) {
    errors.push('runbooks contain a destructive command');
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: scannedFiles.length,
    alertCount: policy.alerts.length,
    smokeCount: smoke.checks.length
  };
}

function main() {
  const result = validateOperations();
  if (!result.ok) {
    console.error('Production operations contract: FAIL');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Production operations contract: PASS (${result.checkedFiles} files, ${result.alertCount} alerts, ${result.smokeCount} smoke checks)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  repoRoot,
  requiredDocuments,
  validateOperations,
  validatePolicy,
  validateSmokeContract
} from '../scripts/check-production-operations.mjs';

const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/production-monitoring-policy.json'), 'utf8'));
const smoke = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/production-smoke-checks.json'), 'utf8'));

test('all operational documents and policy references validate', () => {
  const result = validateOperations();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.ok(result.alertCount >= 15);
  assert.ok(result.smokeCount >= 7);
  for (const file of requiredDocuments) assert.equal(fs.existsSync(path.join(repoRoot, file)), true, file);
});

test('every alert has severity, owner, action and an existing runbook', () => {
  assert.deepEqual(validatePolicy(policy), []);
  for (const alert of policy.alerts) {
    assert.match(alert.severity, /^SEV[123]$/);
    assert.ok(alert.owner);
    assert.ok(alert.action);
    assert.equal(fs.existsSync(path.join(repoRoot, alert.runbook)), true);
  }
});

test('numeric alert conditions cannot look measured without provisional=true', () => {
  const invalid = structuredClone(policy);
  invalid.alerts[0].provisional = false;
  assert.ok(validatePolicy(invalid).some((error) => error.includes('must be provisional')));
});

test('missing operational ownership is rejected', () => {
  const invalid = structuredClone(policy);
  invalid.alerts[0].owner = '';
  assert.ok(validatePolicy(invalid).some((error) => error.includes('missing owner')));
});

test('future production smoke checks remain non-destructive and synthetic', () => {
  assert.deepEqual(validateSmokeContract(smoke), []);
  assert.ok(smoke.checks.every((check) => check.mutatesState === false));
  assert.equal(smoke.constraints.usesRealUsers, false);
});

test('a mutating admin smoke check is rejected', () => {
  const invalid = structuredClone(smoke);
  invalid.checks.find((check) => check.audience === 'admin-synthetic').mutatesState = true;
  assert.ok(validateSmokeContract(invalid).some((error) => error.includes('must be read-only')));
});

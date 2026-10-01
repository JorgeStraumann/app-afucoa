// Alta server-side de una cohorte PROD previamente aprobada por dry-run.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { prepareMemberCsv, rollbackPilot, runPilotImport } from './lib/pilot-members.mjs';
import { createPilotSupabaseAdapter } from './lib/pilot-supabase-adapter.mjs';
import { ensurePrivateDirectory, parseArgs, publicReport, writeJsonAtomic } from './lib/pilot-cli.mjs';
import {
  PROD_COHORT_MAX_MEMBERS,
  PROD_PROJECT_REF,
  assertProdDryRunTarget,
  prodSecretCredentialsFromEnv,
  summarizeProdCohortReport,
} from './lib/prod-cohort-cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.apply) throw new Error('Operacion rechazada: falta --apply explicito.');
if (!args.input || !args.output_dir || !args.confirm_batch) {
  throw new Error(`Uso: node scripts/prod-cohort-apply.mjs --input cohorte.csv --output-dir directorio-privado --confirm-project ${PROD_PROJECT_REF} --confirm-batch prod-cohort-... --apply`);
}

const { url, secretKey } = prodSecretCredentialsFromEnv();
assertProdDryRunTarget(url, args.confirm_project);
const inputPath = path.resolve(args.input);
const inputBytes = fs.readFileSync(inputPath);
const digest = crypto.createHash('sha256').update(inputBytes).digest('hex');
const batchId = `prod-cohort-${digest.slice(0, 12)}`;
if (args.confirm_batch !== batchId) throw new Error('El batch confirmado no coincide con el hash del archivo.');

const { accepted, rejected } = prepareMemberCsv(inputBytes.toString('utf8'));
if (accepted.length !== PROD_COHORT_MAX_MEMBERS || rejected.length !== 0) {
  throw new Error(`El lote autorizado exige exactamente ${PROD_COHORT_MAX_MEMBERS} filas validas y cero rechazadas.`);
}

const outputDirectory = path.resolve(args.output_dir);
ensurePrivateDirectory(outputDirectory);
const reportPath = path.join(outputDirectory, `${batchId}-apply-report.json`);
const journalPath = path.join(outputDirectory, `${batchId}-rollback.json`);
const credentialsPath = path.join(outputDirectory, `${batchId}-credentials.json`);
const rollbackResultPath = path.join(outputDirectory, `${batchId}-automatic-rollback-result.json`);

for (const protectedPath of [reportPath, journalPath, credentialsPath]) {
  if (fs.existsSync(protectedPath)) throw new Error(`Operacion rechazada: ya existe ${path.basename(protectedPath)}.`);
}

const client = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const adapter = createPilotSupabaseAdapter(client);
const metadataKey = 'cohort_batch_id';

const preflight = await runPilotImport({ rows: accepted, adapter, batchId, apply: false, batchMetadataKey: metadataKey });
const preflightSummary = summarizeProdCohortReport(preflight, rejected);
if (preflightSummary.ready !== PROD_COHORT_MAX_MEMBERS || preflightSummary.unchanged !== 0
  || preflightSummary.rejected !== 0 || preflightSummary.conflicts !== 0) {
  throw new Error('Preflight inmediato no coincide con 5 ready, 0 unchanged, 0 rejected y 0 conflicts.');
}

const persist = async progress => {
  writeJsonAtomic(reportPath, {
    project_ref: PROD_PROJECT_REF,
    input_sha256: digest,
    authorization: 'EXPLICIT_APPLY_AUTHORIZATION',
    ...publicReport(progress, []),
  });
  writeJsonAtomic(journalPath, {
    batch_id: batchId,
    batch_metadata_key: metadataKey,
    project_ref: PROD_PROJECT_REF,
    created_at: progress.started_at,
    rollback: progress.rollback || [],
  });
  if (progress.credentials?.length) {
    writeJsonAtomic(credentialsPath, { batch_id: batchId, credentials: progress.credentials }, 0o600);
  }
};

const result = await runPilotImport({
  rows: accepted,
  adapter,
  batchId,
  apply: true,
  batchMetadataKey: metadataKey,
  onProgress: persist,
});
await persist(result);

const appliedCleanly = result.summary.imported === PROD_COHORT_MAX_MEMBERS
  && result.summary.unchanged === 0
  && result.summary.rejected === 0
  && result.summary.auth_created === PROD_COHORT_MAX_MEMBERS
  && result.summary.profiles_linked === PROD_COHORT_MAX_MEMBERS;

if (!appliedCleanly) {
  const journal = {
    batch_id: batchId,
    batch_metadata_key: metadataKey,
    project_ref: PROD_PROJECT_REF,
    rollback: result.rollback || [],
  };
  const rollbackResult = await rollbackPilot({ journal, adapter });
  writeJsonAtomic(rollbackResultPath, rollbackResult);
  throw new Error('Alta parcial o inconsistente: se ejecuto rollback automatico.');
}

const postcheck = await runPilotImport({ rows: accepted, adapter, batchId, apply: false, batchMetadataKey: metadataKey });
const postcheckSummary = summarizeProdCohortReport(postcheck, []);
if (postcheckSummary.ready !== 0 || postcheckSummary.unchanged !== PROD_COHORT_MAX_MEMBERS
  || postcheckSummary.rejected !== 0 || postcheckSummary.conflicts !== 0) {
  throw new Error('Postcheck inconsistente. Conservar journal y detener entrega de credenciales.');
}

console.log(JSON.stringify({
  project_ref: PROD_PROJECT_REF,
  batch_id: batchId,
  mode: 'apply',
  input_sha256: digest,
  summary: result.summary,
  postcheck: postcheckSummary,
  report: reportPath,
  rollback_journal: journalPath,
  credentials_file_created: fs.existsSync(credentialsPath),
  changes_applied: true,
}, null, 2));

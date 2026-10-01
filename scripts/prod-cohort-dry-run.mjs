// Preflight de cohorte PROD. Es deliberadamente dry-run only: no crea Auth ni profiles.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { prepareMemberCsv, runPilotImport } from './lib/pilot-members.mjs';
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
if (args.apply) throw new Error('Operacion rechazada: este comando no implementa --apply.');
if (!args.input || !args.output_dir) {
  throw new Error(`Uso: node scripts/prod-cohort-dry-run.mjs --input cohorte.csv --output-dir directorio-privado --confirm-project ${PROD_PROJECT_REF}`);
}

const { url, secretKey } = prodSecretCredentialsFromEnv();
assertProdDryRunTarget(url, args.confirm_project);

const inputPath = path.resolve(args.input);
const inputBytes = fs.readFileSync(inputPath);
const { accepted, rejected } = prepareMemberCsv(inputBytes.toString('utf8'));
const inputRows = accepted.length + rejected.length;
if (!inputRows) throw new Error('La cohorte no contiene filas.');
if (inputRows > PROD_COHORT_MAX_MEMBERS) {
  throw new Error(`La autorizacion B10 admite como maximo ${PROD_COHORT_MAX_MEMBERS} socios.`);
}

const digest = crypto.createHash('sha256').update(inputBytes).digest('hex');
const batchId = `prod-cohort-${digest.slice(0, 12)}`;
const outputDirectory = path.resolve(args.output_dir);
ensurePrivateDirectory(outputDirectory);
const reportPath = path.join(outputDirectory, `${batchId}-dry-run-report.json`);

const client = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const adapter = createPilotSupabaseAdapter(client);
const result = accepted.length
  ? await runPilotImport({ rows: accepted, adapter, batchId, apply: false })
  : { batch_id: batchId, mode: 'dry-run', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), summary: { ready: 0, unchanged: 0, rejected: 0 }, items: [] };
const summary = summarizeProdCohortReport(result, rejected);
const localReport = {
  project_ref: PROD_PROJECT_REF,
  input_sha256: digest,
  authorization: 'B10_GO_CON_CONDICIONES_DRY_RUN_ONLY',
  ...publicReport(result, rejected),
  summary,
};
writeJsonAtomic(reportPath, localReport);

console.log(JSON.stringify({
  project_ref: PROD_PROJECT_REF,
  batch_id: batchId,
  mode: 'dry-run',
  input_sha256: digest,
  summary,
  report: reportPath,
  changes_applied: false,
}, null, 2));

if (summary.rejected > 0 || summary.conflicts > 0) {
  throw new Error('Dry-run detenido: existen rechazos o conflictos. No se aplico ningun cambio.');
}

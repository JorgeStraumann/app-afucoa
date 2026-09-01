// Importador server-side Pilot 01. El modo por defecto es dry-run.
// Nunca usar esta utilidad desde Vite ni definir la service_role con prefijo VITE_.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { prepareMemberCsv, makeBatchId, runPilotImport } from './lib/pilot-members.mjs';
import { createPilotSupabaseAdapter } from './lib/pilot-supabase-adapter.mjs';
import { parseArgs, assertDevTarget, serverCredentialsFromEnv, ensurePrivateDirectory, writeJsonAtomic, publicReport, DEV_PROJECT_REF } from './lib/pilot-cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error('Uso: node scripts/pilot-import-members.mjs --input members-v2.csv --confirm-project imiplnspvmsrsuikulwm [--apply].');
const { url, serviceRoleKey } = serverCredentialsFromEnv();
assertDevTarget(url, args.confirm_project);

const inputPath = path.resolve(args.input);
const inputBytes = fs.readFileSync(inputPath);
const { accepted, rejected } = prepareMemberCsv(inputBytes.toString('utf8'));
if (accepted.length > 10) throw new Error('Pilot 01 rechaza lotes de más de 10 socios. No se ejecutó ningún cambio.');
if (args.apply && accepted.length < 5) throw new Error('Pilot 01 requiere entre 5 y 10 socios aceptados para --apply. Usá dry-run para fixtures menores.');
if (!accepted.length) throw new Error('No hay filas válidas para procesar.');

const batchId = args.batch_id || makeBatchId(inputBytes);
if (!/^pilot01-[a-z0-9-]{4,48}$/i.test(batchId)) throw new Error('batch-id inválido; debe comenzar con pilot01-.');
const outputDirectory = path.resolve(args.output_dir || 'pilot-output');
ensurePrivateDirectory(outputDirectory);
const reportPath = path.join(outputDirectory, `${batchId}-report.json`);
const journalPath = path.join(outputDirectory, `${batchId}-rollback.json`);
const credentialsPath = path.join(outputDirectory, `${batchId}-credentials.json`);

const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const adapter = createPilotSupabaseAdapter(client);

const persist = async progress => {
  writeJsonAtomic(reportPath, publicReport(progress, rejected));
  writeJsonAtomic(journalPath, { batch_id: batchId, project_ref: DEV_PROJECT_REF, created_at: progress.started_at, rollback: progress.rollback || [] });
  if (progress.credentials?.length) writeJsonAtomic(credentialsPath, { batch_id: batchId, credentials: progress.credentials }, 0o600);
};

const result = await runPilotImport({ rows: accepted, adapter, batchId, apply: args.apply, authDomain: args.auth_domain || 'auth.afucoa.local', onProgress: persist });
await persist(result);

console.log(JSON.stringify({
  project_ref: DEV_PROJECT_REF,
  batch_id: batchId,
  mode: result.mode,
  summary: publicReport(result, rejected).summary,
  report: reportPath,
  rollback_journal: journalPath,
  credentials_file_created: Boolean(result.credentials.length),
}, null, 2));

// Rollback server-side de un lote Pilot 01. El modo por defecto solo genera un plan.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { rollbackPilot } from './lib/pilot-members.mjs';
import { createPilotSupabaseAdapter } from './lib/pilot-supabase-adapter.mjs';
import { parseArgs, assertDevTarget, serverCredentialsFromEnv, writeJsonAtomic, DEV_PROJECT_REF } from './lib/pilot-cli.mjs';

const args = parseArgs(process.argv.slice(2));
const journalArgument = args.journal || args.input;
if (!journalArgument) throw new Error('Uso: node scripts/pilot-rollback.mjs --journal pilot-output/<lote>-rollback.json --confirm-project imiplnspvmsrsuikulwm [--apply].');
const journalPath = path.resolve(journalArgument);
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
if (journal.project_ref !== DEV_PROJECT_REF) throw new Error('El journal no pertenece a AFUCOA V2 DEV.');
const outputPath = path.resolve(args.output || journalPath.replace(/-rollback\.json$/i, '-rollback-report.json'));

if (!args.apply) {
  const plan = {
    batch_id: journal.batch_id,
    project_ref: journal.project_ref,
    mode: 'dry-run',
    actions: [...(journal.rollback || [])].reverse().map(entry => ({
      migration_external_id: entry.migration_external_id,
      profile_id: entry.profile_id,
      delete_profile: entry.profile_created,
      restore_profile: !entry.profile_created,
      delete_auth_user: entry.auth_user_created,
    })),
  };
  writeJsonAtomic(outputPath, plan);
  console.log(JSON.stringify({ mode: 'dry-run', actions: plan.actions.length, report: outputPath }, null, 2));
  process.exit(0);
}

const { url, serviceRoleKey } = serverCredentialsFromEnv();
assertDevTarget(url, args.confirm_project);
const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const adapter = createPilotSupabaseAdapter(client);
const result = await rollbackPilot({ journal, adapter, onProgress: partial => writeJsonAtomic(outputPath, { ...partial, project_ref: DEV_PROJECT_REF, mode: 'apply' }) });
writeJsonAtomic(outputPath, { ...result, project_ref: DEV_PROJECT_REF, mode: 'apply' });
console.log(JSON.stringify({ mode: 'apply', batch_id: journal.batch_id, rolled_back: result.rolled_back, already_absent: result.already_absent, rejected: result.rejected, report: outputPath }, null, 2));

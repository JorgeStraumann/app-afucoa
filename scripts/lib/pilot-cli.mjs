import fs from 'node:fs';
import path from 'node:path';

export const DEV_PROJECT_REF = 'imiplnspvmsrsuikulwm';

export function parseArgs(argv) {
  const args = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') args.apply = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2).replaceAll('-', '_');
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${token}.`);
      args[key] = value;
      index += 1;
    } else if (!args.input) args.input = token;
    else throw new Error(`Argumento inesperado: ${token}.`);
  }
  return args;
}

export function assertDevTarget(url, confirmation) {
  const parsed = new URL(url);
  const projectRef = parsed.hostname.split('.')[0];
  if (projectRef !== DEV_PROJECT_REF || confirmation !== DEV_PROJECT_REF) {
    throw new Error(`Destino rechazado. Pilot 01 solo admite ${DEV_PROJECT_REF} y requiere --confirm-project ${DEV_PROJECT_REF}.`);
  }
}

export function serverCredentialsFromEnv() {
  const url = process.env.SUPABASE_URL || process.env.AFUCOA_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY solo en el entorno del proceso servidor.');
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SERVICE_ROLE_KEY) throw new Error('Se detectó una service_role con prefijo VITE_. Eliminála: jamás debe llegar al frontend.');
  return { url, serviceRoleKey };
}

export function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* Windows aplica ACL del usuario. */ }
}

export function writeJsonAtomic(filePath, value, mode = 0o600) {
  ensurePrivateDirectory(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.renameSync(temporary, filePath);
  try { fs.chmodSync(filePath, mode); } catch { /* Windows aplica ACL del usuario. */ }
}

export function publicReport(report, sourceRejected = []) {
  const inputRejected = sourceRejected.map(row => ({
    status: 'rejected', source_line: row.line, document_number: row.document_number,
    member_number: row.member_number, rejection_reason: row.reasons.join(','),
    auth_user_created: false, profile_linked: false,
  }));
  const clean = structuredClone(report);
  delete clean.rollback;
  delete clean.credentials;
  clean.items = [...inputRejected, ...(clean.items || [])];
  clean.summary.rejected += inputRejected.length;
  clean.summary.input_rows = clean.items.length;
  return clean;
}

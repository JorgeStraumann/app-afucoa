export const PROD_PROJECT_REF = 'rywdochyzhgfaymrmxek';
export const PROD_SUPABASE_URL = `https://${PROD_PROJECT_REF}.supabase.co`;
export const PROD_COHORT_MAX_MEMBERS = 5;

export function assertProdDryRunTarget(url, confirmation) {
  const parsed = new URL(url);
  const projectRef = parsed.hostname.split('.')[0];
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${PROD_PROJECT_REF}.supabase.co`
    || projectRef !== PROD_PROJECT_REF || confirmation !== PROD_PROJECT_REF) {
    throw new Error(`Destino rechazado. El preflight solo admite PROD ${PROD_PROJECT_REF} y requiere confirmacion exacta.`);
  }
}

export function prodSecretCredentialsFromEnv(env = process.env) {
  const url = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY || env.AFUCOA_PROD_SECRET_KEY;
  if (!url || !secretKey) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en el proceso servidor.');
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) throw new Error('El preflight requiere una Supabase Secret API Key moderna.');
  if (env.VITE_SUPABASE_SECRET_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SERVICE_ROLE_KEY) {
    throw new Error('Se detecto una clave privilegiada con prefijo VITE_.');
  }
  return { url, secretKey };
}

export function summarizeProdCohortReport(report, sourceRejected = []) {
  const rejectedItems = [
    ...sourceRejected.map(row => ({ rejection_reason: row.reasons.join(',') })),
    ...(report.items || []).filter(item => item.status === 'rejected'),
  ];
  const profileConflictCodes = new Set([
    'conflicto_perfiles_existentes',
    'perfil_existente_sin_trazabilidad_v1',
    'datos_clave_no_coinciden',
    'perfil_historico_inactivo_requiere_revision',
  ]);
  const authConflictCodes = new Set([
    'auth_vinculado_no_coincide',
    'email_auth_en_uso',
    'auth_lote_no_coincide',
    'auth_vinculado_a_otro_perfil',
  ]);
  const reasons = rejectedItems.flatMap(item => String(item.rejection_reason || '').split(',').filter(Boolean));
  const profileConflicts = reasons.filter(reason => profileConflictCodes.has(reason)).length;
  const authConflicts = reasons.filter(reason => authConflictCodes.has(reason)).length;
  return {
    input_rows: (report.items || []).length + sourceRejected.length,
    ready: report.summary?.ready || 0,
    unchanged: report.summary?.unchanged || 0,
    rejected: (report.summary?.rejected || 0) + sourceRejected.length,
    profile_conflicts: profileConflicts,
    auth_conflicts: authConflicts,
    conflicts: profileConflicts + authConflicts,
  };
}

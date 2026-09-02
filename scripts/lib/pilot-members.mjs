import crypto from 'node:crypto';

export const PILOT_SOURCE = 'v1';
export const PILOT_MAX_MEMBERS = 10;
export const MEMBER_STATUSES = new Set(['activo', 'inactivo', 'pendiente', 'baja']);

const headerAliases = {
  document_number: ['document_number', 'cedula', 'cédula', 'documento'],
  member_number: ['member_number', 'ficha', 'nro_ficha', 'numero_ficha'],
  first_name: ['first_name', 'nombre', 'nombres'],
  last_name: ['last_name', 'apellido', 'apellidos'],
  email: ['email', 'correo'],
  phone: ['phone', 'telefono', 'teléfono', 'celular'],
  sector: ['sector', 'dependencia'],
  status: ['status', 'estado'],
  migration_source: ['migration_source'],
  migration_external_id: ['migration_external_id', 'id_externo', 'external_id'],
};

export function parseDelimited(text, delimiter = ';') {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV inválido: comillas sin cerrar.');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(values => values.some(value => clean(value)));
}

export function stringifyDelimited(rows, delimiter = ';') {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return /["\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(delimiter)).join('\n');
}

export function normalizeDocument(value) {
  return clean(value).replace(/\D/g, '').padStart(8, '0');
}

export function isValidUruguayanDocument(value) {
  const digits = clean(value).replace(/\D/g, '');
  if (!/^\d{7,8}$/.test(digits)) return false;
  const normalized = digits.padStart(8, '0');
  if (/^(\d)\1{7}$/.test(normalized)) return false;
  const weights = [2, 9, 8, 7, 6, 3, 4];
  const sum = weights.reduce((total, weight, index) => total + Number(normalized[index]) * weight, 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(normalized[7]);
}

export function prepareMemberCsv(text, { source = PILOT_SOURCE } = {}) {
  const csv = parseDelimited(text);
  if (csv.length < 2) throw new Error('El CSV no contiene filas de socios.');
  const headers = csv.shift().map(value => clean(value).toLowerCase());
  const forbidden = headers.filter(header => ['password','contraseña','contrasena','password_hash','hash_password','clave'].includes(header));
  if (forbidden.length) throw new Error(`El CSV contiene columnas prohibidas de credenciales: ${forbidden.join(', ')}.`);
  const column = Object.fromEntries(Object.entries(headerAliases).map(([key, aliases]) => [key, aliases.map(alias => headers.indexOf(alias)).find(index => index >= 0) ?? -1]));
  for (const required of ['document_number', 'member_number', 'first_name', 'last_name', 'status']) {
    if (column[required] < 0) throw new Error(`Falta la columna requerida: ${required}.`);
  }

  const accepted = [];
  const rejected = [];
  const identities = csv.map(values => {
    const get = key => column[key] >= 0 ? clean(values[column[key]]) : '';
    const documentNumber = normalizeDocument(get('document_number'));
    const memberNumber = get('member_number');
    return { documentNumber, memberNumber, externalId:get('migration_external_id') || memberNumber || documentNumber };
  });
  const documentCounts = countBy(identities, row => row.documentNumber);
  const memberCounts = countBy(identities, row => row.memberNumber);
  const externalCounts = countBy(identities, row => row.externalId);
  for (let index = 0; index < csv.length; index += 1) {
    const line = index + 2;
    const values = csv[index];
    const get = key => column[key] >= 0 ? clean(values[column[key]]) : '';
    const rawDocument = get('document_number');
    const documentNumber = normalizeDocument(rawDocument);
    const memberNumber = get('member_number');
    const firstName = get('first_name');
    const lastName = get('last_name');
    const status = get('status').toLowerCase();
    const migrationSource = get('migration_source') || source;
    const migrationExternalId = get('migration_external_id') || memberNumber || documentNumber;
    const reasons = [];
    if (!isValidUruguayanDocument(rawDocument)) reasons.push('cedula_invalida');
    if (!memberNumber) reasons.push('ficha_vacia');
    if (!firstName) reasons.push('nombre_vacio');
    if (!lastName) reasons.push('apellido_vacio');
    if (!MEMBER_STATUSES.has(status)) reasons.push('estado_invalido');
    if (migrationSource !== source) reasons.push('migration_source_invalido');
    if (!migrationExternalId) reasons.push('migration_external_id_vacio');
    const email = get('email').toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push('email_invalido');
    if ((documentCounts.get(documentNumber) || 0) > 1) reasons.push('cedula_duplicada_en_archivo');
    if (memberNumber && (memberCounts.get(memberNumber) || 0) > 1) reasons.push('ficha_duplicada_en_archivo');
    if (migrationExternalId && (externalCounts.get(migrationExternalId) || 0) > 1) reasons.push('external_id_duplicado_en_archivo');

    const normalized = {
      document_number: documentNumber,
      member_number: memberNumber,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: get('phone'),
      sector: get('sector'),
      status,
      migration_source: migrationSource,
      migration_external_id: migrationExternalId,
      source_line: line,
    };
    if (reasons.length) rejected.push({ line, document_number: documentNumber, member_number: memberNumber, reasons });
    else accepted.push(normalized);
  }
  return { accepted, rejected };
}

export function preparedCsv(rows) {
  const headers = ['document_number','member_number','first_name','last_name','email','phone','sector','status','migration_source','migration_external_id'];
  return stringifyDelimited([headers, ...rows.map(row => headers.map(header => row[header] || ''))]);
}

export function authEmailForDocument(documentNumber, domain = 'auth.afucoa.local') {
  return `${normalizeDocument(documentNumber)}@${domain}`;
}

export function makeBatchId(inputBytes) {
  return `pilot01-${crypto.createHash('sha256').update(inputBytes).digest('hex').slice(0, 12)}`;
}

export function makeTemporaryPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}!Aa1`;
}

export async function runPilotImport({ rows, adapter, batchId, apply = false, authDomain = 'auth.afucoa.local', onProgress = async () => {} }) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No hay socios aceptados para importar.');
  if (rows.length > PILOT_MAX_MEMBERS) throw new Error(`Pilot 01 admite como máximo ${PILOT_MAX_MEMBERS} socios.`);
  const report = {
    batch_id: batchId,
    mode: apply ? 'apply' : 'dry-run',
    started_at: new Date().toISOString(),
    summary: { ready: 0, imported: 0, unchanged: 0, rejected: 0, auth_created: 0, profiles_linked: 0 },
    items: [],
    rollback: [],
    credentials: [],
  };

  for (const row of rows) {
    const item = { migration_external_id: row.migration_external_id, document_number: row.document_number, member_number: row.member_number, auth_user_created: false, profile_linked: false };
    try {
      const profiles = await adapter.findProfiles(row);
      const uniqueProfiles = [...new Map(profiles.map(profile => [profile.id, profile])).values()];
      if (uniqueProfiles.length > 1) throw reject('conflicto_perfiles_existentes');
      let profile = uniqueProfiles[0] || null;
      if (profile && (profile.migration_source !== row.migration_source || profile.migration_external_id !== row.migration_external_id)) throw reject('perfil_existente_sin_trazabilidad_v1');
      if (profile && (profile.document_number !== row.document_number || profile.member_number !== row.member_number)) throw reject('datos_clave_no_coinciden');
      if (profile && !profile.auth_user_id && ['inactivo', 'baja'].includes(profile.status)) throw reject('perfil_historico_inactivo_requiere_revision');

      const authEmail = authEmailForDocument(row.document_number, authDomain);
      let authUser = profile?.auth_user_id ? await adapter.getAuthUser(profile.auth_user_id) : await adapter.findAuthUserByEmail(authEmail);
      if (profile?.auth_user_id && (!authUser || authUser.email?.toLowerCase() !== authEmail)) throw reject('auth_vinculado_no_coincide');
      if (authUser && !profile?.auth_user_id) {
        const metadata = authUser.app_metadata || {};
        if (metadata.migration_source !== row.migration_source || metadata.migration_external_id !== row.migration_external_id) throw reject('email_auth_en_uso');
        if (metadata.pilot_batch_id !== batchId) throw reject('auth_lote_no_coincide');
        const linkedProfile = await adapter.findProfileByAuthUser(authUser.id);
        if (linkedProfile && linkedProfile.id !== profile?.id) throw reject('auth_vinculado_a_otro_perfil');
      }

      if (!apply) {
        item.status = profile?.auth_user_id ? 'unchanged' : 'ready';
        item.action = profile ? 'link_existing_profile' : authUser ? 'create_profile_for_batch_auth' : 'create_auth_and_profile';
        item.auth_user_exists = Boolean(authUser);
        item.auth_user_id = authUser?.id || null;
        item.profile_id = profile?.id || null;
        item.profile_linked = Boolean(profile?.auth_user_id && authUser?.id === profile.auth_user_id);
        report.summary[item.status === 'unchanged' ? 'unchanged' : 'ready'] += 1;
        report.items.push(item);
        await onProgress(report);
        continue;
      }

      let temporaryPassword = null;
      let authCreated = false;
      if (!authUser) {
        temporaryPassword = makeTemporaryPassword();
        authUser = await adapter.createAuthUser({
          email: authEmail,
          password: temporaryPassword,
          email_confirm: true,
          app_metadata: { migration_source: row.migration_source, migration_external_id: row.migration_external_id, pilot_batch_id: batchId },
        });
        authCreated = true;
        item.auth_user_created = true;
        report.summary.auth_created += 1;
      }

      if (profile?.auth_user_id === authUser.id) {
        item.status = 'unchanged';
        item.profile_id = profile.id;
        item.auth_user_id = authUser.id;
        item.profile_linked = true;
        report.summary.unchanged += 1;
      } else {
        const profileBefore = profile ? snapshotProfile(profile) : null;
        try {
          profile = profile
            ? await adapter.updateProfile(profile.id, { auth_user_id: authUser.id })
            : await adapter.createProfile({ ...profilePayload(row), auth_user_id: authUser.id });
        } catch (error) {
          if (authCreated) await adapter.deleteAuthUser(authUser.id);
          throw error;
        }
        item.status = 'imported';
        item.profile_id = profile.id;
        item.auth_user_id = authUser.id;
        item.profile_linked = true;
        report.summary.imported += 1;
        report.summary.profiles_linked += 1;
        report.rollback.push({
          migration_source: row.migration_source,
          migration_external_id: row.migration_external_id,
          profile_id: profile.id,
          profile_created: !profileBefore,
          profile_before: profileBefore,
          auth_user_id: authUser.id,
          auth_user_created: authCreated,
        });
      }
      if (temporaryPassword) report.credentials.push({ document_number: row.document_number, auth_email: authEmail, temporary_password: temporaryPassword });
    } catch (error) {
      item.status = 'rejected';
      item.rejection_reason = error.code || 'error_importacion';
      item.detail = error.message;
      report.summary.rejected += 1;
    }
    report.items.push(item);
    await onProgress(report);
  }
  report.finished_at = new Date().toISOString();
  return report;
}

export async function rollbackPilot({ journal, adapter, onProgress = async () => {} }) {
  const result = {
    batch_id: journal.batch_id,
    started_at: new Date().toISOString(),
    deleted: 0,
    deactivated_preserved_history: 0,
    restored_existing_profile: 0,
    auth_delete_failed: 0,
    rejected: 0,
    items: [],
  };
  for (const entry of [...(journal.rollback || [])].reverse()) {
    const item = {
      migration_source: entry.migration_source || PILOT_SOURCE,
      migration_external_id: entry.migration_external_id,
      profile_id: entry.profile_id,
      auth_user_id: entry.auth_user_id,
      auth_user_deleted: false,
    };
    try {
      let authUser = null;
      if (entry.auth_user_created) {
        authUser = await adapter.getAuthUser(entry.auth_user_id);
        if (authUser && authUser.app_metadata?.pilot_batch_id !== journal.batch_id) throw reject('auth_no_pertenece_al_lote');
      }

      const profile = await adapter.getProfile(entry.profile_id);
      if (entry.profile_created) {
        if (profile && (profile.migration_source !== (entry.migration_source || PILOT_SOURCE) || profile.migration_external_id !== entry.migration_external_id)) throw reject('perfil_cambio_desde_importacion');
        const alreadyDeactivated = Boolean(profile && profile.auth_user_id === null && profile.status === 'inactivo');
        if (profile && profile.auth_user_id !== entry.auth_user_id && !alreadyDeactivated) throw reject('perfil_cambio_desde_importacion');

        if (!profile) {
          item.status = 'deleted';
          item.profile_deleted = true;
          item.idempotent_replay = true;
        } else {
          const activity = await adapter.getProfileActivity(profile.id);
          item.activity = activity;
          if (activity.has_activity || alreadyDeactivated) {
            if (!alreadyDeactivated) await adapter.updateProfile(profile.id, { auth_user_id: null, status: 'inactivo' });
            item.status = 'deactivated_preserved_history';
            item.profile_deactivated = true;
            item.history_preserved = true;
            item.idempotent_replay = alreadyDeactivated;
          } else {
            await adapter.deleteProfile(profile.id);
            item.status = 'deleted';
            item.profile_deleted = true;
            item.idempotent_replay = false;
          }
        }
      } else {
        if (!profile || !entry.profile_before) throw reject('perfil_preexistente_ausente');
        const importedLinkIsCurrent = profile.auth_user_id === entry.auth_user_id
          && profile.migration_source === (entry.migration_source || PILOT_SOURCE)
          && profile.migration_external_id === entry.migration_external_id;
        const previousLinkIsCurrent = profile.auth_user_id === entry.profile_before.auth_user_id
          && profile.migration_source === entry.profile_before.migration_source
          && profile.migration_external_id === entry.profile_before.migration_external_id;
        if (!importedLinkIsCurrent && !previousLinkIsCurrent) throw reject('perfil_cambio_desde_importacion');
        if (importedLinkIsCurrent) await adapter.updateProfile(profile.id, entry.profile_before);
        item.status = 'restored_existing_profile';
        item.profile_restored = importedLinkIsCurrent;
        item.idempotent_replay = previousLinkIsCurrent;
      }

      if (entry.auth_user_created && authUser) {
        try {
          await adapter.deleteAuthUser(entry.auth_user_id);
          item.auth_user_deleted = true;
        } catch (error) {
          item.auth_user_delete_error = error.message;
          item.auth_access_invalidated_by_profile_unlink = true;
          result.auth_delete_failed += 1;
        }
      } else if (entry.auth_user_created) {
        item.auth_user_already_absent = true;
      }
      result[item.status] += 1;
    } catch (error) {
      item.status = 'rejected';
      item.rejection_reason = error.code || 'error_rollback';
      item.detail = error.message;
      result.rejected += 1;
    }
    result.items.push(item);
    await onProgress(result);
  }
  result.finished_at = new Date().toISOString();
  return result;
}

function profilePayload(row) {
  return {
    role: 'socio', first_name: row.first_name, last_name: row.last_name,
    document_number: row.document_number, member_number: row.member_number,
    email: row.email || null, phone: row.phone || null, sector: row.sector || null,
    status: row.status, migration_source: row.migration_source,
    migration_external_id: row.migration_external_id,
  };
}

function snapshotProfile(profile) {
  return {
    auth_user_id: profile.auth_user_id || null,
    migration_source: profile.migration_source || null,
    migration_external_id: profile.migration_external_id || null,
  };
}

function reject(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clean(value) { return String(value ?? '').trim(); }

function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const value = selector(row);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

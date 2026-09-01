import { appMode, requireSupabase } from './supabase.js';

export const STORAGE_BUCKETS = {
  requestFiles: 'request-files',
  documents: 'documents-private',
  publicMedia: 'public-media',
};

export async function uploadRequestFile(requestId, file) {
  if (!file) throw new Error('Seleccioná un archivo.');
  if (appMode !== 'supabase') return { demo: true, path: `demo/${file.name}`, file };
  const db = requireSupabase();
  const safeName = sanitizeFileName(file.name);
  const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await db.storage.from(STORAGE_BUCKETS.requestFiles).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await db.rpc('register_my_request_file', {
    p_request_id: requestId,
    p_storage_path: path,
    p_file_name: file.name,
    p_mime_type: file.type || null,
  });
  if (error) {
    await db.storage.from(STORAGE_BUCKETS.requestFiles).remove([path]);
    throw error;
  }
  return data;
}

export async function getRequestFileUrl(storagePath, expiresIn = 120) {
  if (appMode !== 'supabase') return null;
  const { data, error } = await requireSupabase().storage.from(STORAGE_BUCKETS.requestFiles).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function getPrivateDocumentUrl(storagePath, expiresIn = 120) {
  if (appMode !== 'supabase') return null;
  const { data, error } = await requireSupabase().storage.from(STORAGE_BUCKETS.documents).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

function sanitizeFileName(name) {
  return String(name || 'archivo').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120);
}

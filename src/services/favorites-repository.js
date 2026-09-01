import { appMode, requireSupabase } from './supabase.js';

export async function listAgreementFavoriteIds() {
  return listFavoriteIds('agreement_favorites', 'agreement_id');
}

export async function listDocumentFavoriteIds() {
  return listFavoriteIds('document_favorites', 'document_id');
}

export async function setAgreementFavorite(agreementId, favorite) {
  return setFavorite('agreement_favorites', 'agreement_id', agreementId, favorite);
}

export async function setDocumentFavorite(documentId, favorite) {
  return setFavorite('document_favorites', 'document_id', documentId, favorite);
}

async function listFavoriteIds(table, column) {
  if (appMode !== 'supabase') return [];
  const { data, error } = await requireSupabase().from(table).select(column);
  if (error) throw error;
  return (data || []).map(row => row[column]);
}

async function setFavorite(table, column, id, favorite) {
  if (appMode !== 'supabase') return favorite;
  const db = requireSupabase();
  if (!favorite) {
    const { error } = await db.from(table).delete().eq(column, id);
    if (error) throw error;
    return false;
  }
  const { data: profileId, error: profileError } = await db.rpc('current_profile_id');
  if (profileError) throw profileError;
  const { error } = await db.from(table).upsert({ profile_id: profileId, [column]: id });
  if (error) throw error;
  return true;
}

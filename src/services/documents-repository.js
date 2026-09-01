import { appMode, requireSupabase } from './supabase.js';
import { documents as mockDocuments } from './mock-data.js';

export async function listDocuments() {
  if (appMode !== 'supabase') return mockDocuments.map(x => ({...x, storage_path:null, id:x.id}));
  const { data, error } = await requireSupabase()
    .from('documents')
    .select('*')
    .eq('status','publicado')
    .eq('is_current',true)
    .order('category')
    .order('title');
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || '',
    version: row.version || 'Sin versión',
    dateLabel: row.effective_from ? new Date(`${row.effective_from}T12:00:00`).toLocaleDateString('es-UY') : 'Sin fecha',
    current: row.is_current,
    storage_path: row.storage_path,
  }));
}

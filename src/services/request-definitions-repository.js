import { appMode, requireSupabase } from './supabase.js';
import { requestDefinitions as mockDefinitions } from './mock-data.js';

export async function listRequestDefinitions() {
  if (appMode !== 'supabase') return mockDefinitions;
  const { data, error } = await requireSupabase()
    .from('request_definitions')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(normalizeDefinition);
}

export async function getRequestDefinition(idOrSlug) {
  if (appMode !== 'supabase') return mockDefinitions.find(x => x.id === idOrSlug) || null;
  const db = requireSupabase();
  let query = db.from('request_definitions').select('*').eq('active', true);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(idOrSlug))) query = query.eq('id', idOrSlug);
  else query = query.eq('slug', idOrSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normalizeDefinition(data) : null;
}

function normalizeDefinition(row) {
  const fields = Array.isArray(row.fields) ? row.fields : [];
  const steps = fields.length && fields[0]?.fields ? fields : [{ id: 'datos', title: 'Datos', fields }, { id: 'review', title: 'Revisar y enviar', fields: [] }];
  return {
    id: row.slug || row.id,
    databaseId: row.id,
    name: row.name,
    category: row.category || 'Gestiones',
    description: row.description || '',
    estimated: row.estimated_days ? `${row.estimated_days} ${row.estimated_days === 1 ? 'día hábil' : 'días hábiles'}` : 'A confirmar',
    automatic: !row.requires_review,
    instructions: row.instructions || '',
    steps,
  };
}

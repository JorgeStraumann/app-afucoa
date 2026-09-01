import { appMode, requireSupabase } from './supabase.js';
import { contentItems as demoContent } from './mock-data.js';

export async function listPublishedContent() {
  if (appMode !== 'supabase') return demoContent.map(x => ({ ...x }));
  const client = requireSupabase();
  const { data, error } = await client
    .from('content_items')
    .select('id,kind,title,summary,body,image_url,starts_at,ends_at,location,priority,pinned,published_at')
    .eq('status', 'publicado')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    featured: row.pinned,
    badge: row.kind === 'comunicado' ? 'Comunicado' : row.kind === 'evento' ? 'Agenda' : row.kind === 'aviso' ? 'Importante' : 'Noticia',
    dateLabel: formatDate(row.starts_at || row.published_at),
  }));
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-UY', { day:'2-digit', month:'short', year:'numeric' });
}

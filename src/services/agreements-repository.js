import { appMode, requireSupabase } from './supabase.js';
import { agreements as mockAgreements } from './mock-data.js';

export async function listAgreements({ category = null, search = '' } = {}) {
  if (appMode !== 'supabase') {
    const term = search.trim().toLowerCase();
    return mockAgreements.filter(item => (!category || category === 'Todos' || item.category === category) && (!term || `${item.name} ${item.category} ${item.benefit || item.shortBenefit || ''}`.toLowerCase().includes(term)));
  }
  let query = requireSupabase().from('agreements').select('*').eq('status', 'publicado').order('is_featured', { ascending: false }).order('sort_order');
  if (category && category !== 'Todos') query = query.eq('category', category);
  if (search.trim()) query = query.or(`name.ilike.%${escapeSearch(search)}%,short_benefit.ilike.%${escapeSearch(search)}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAgreement(id) {
  if (appMode !== 'supabase') return mockAgreements.find(item => String(item.id) === String(id)) || null;
  const { data, error } = await requireSupabase().from('agreements').select('*, agreement_locations(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

function escapeSearch(value) { return String(value).replace(/[,%()]/g, ' ').trim(); }

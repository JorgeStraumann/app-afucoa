import { appMode, requireSupabase } from './supabase.js';
import { proposals as demoProposals } from './mock-data.js';

export async function listProposals() {
  if (appMode !== 'supabase') return demoProposals.map(x => ({ ...x }));
  const client = requireSupabase();
  const { data, error } = await client
    .from('proposals')
    .select('id,title,description,status,response,published_at,closed_at,created_at,profile_id,proposal_supports(profile_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    summary: row.description,
    description: row.description,
    status: row.status,
    statusLabel: labelStatus(row.status),
    supports: row.proposal_supports?.length || 0,
    response: row.response,
    dateLabel: new Date(row.created_at).toLocaleDateString('es-UY'),
    category: 'Propuesta',
    mine: false,
    supported: false,
  }));
}

export async function createProposal({ title, description }) {
  if (appMode !== 'supabase') return { demo: true };
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_my_proposal', { p_title: title, p_description: description });
  if (error) throw error;
  return data;
}

export async function supportProposal(proposalId) {
  if (appMode !== 'supabase') return { demo: true };
  const client = requireSupabase();
  const { data, error } = await client.rpc('support_proposal', { p_proposal_id: proposalId });
  if (error) throw error;
  return data;
}

function labelStatus(status) {
  return ({ recibida:'Recibida', en_evaluacion:'En evaluación', publicada:'Publicada', cerrada:'Cerrada', respondida:'Respondida' })[status] || status;
}

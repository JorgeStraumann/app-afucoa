import { appMode, requireSupabase } from './supabase.js';

export async function listMyRequests() {
  if (appMode !== 'supabase') return [];
  const { data, error } = await requireSupabase().from('requests').select('*, request_definitions(name, category)').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyRequest(id) {
  if (appMode !== 'supabase') return null;
  const { data, error } = await requireSupabase().from('requests').select('*, request_definitions(name, category), request_events(*), request_messages(*), request_files(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDraft(definitionId, payload, currentStep = 0) {
  if (appMode !== 'supabase') return { definitionId, payload, currentStep, demo: true };
  const { data, error } = await requireSupabase().rpc('save_my_request_draft', {
    p_definition_id: definitionId,
    p_payload: payload,
    p_current_step: currentStep,
  });
  if (error) throw error;
  return data;
}

export async function submitRequest(definitionId, payload) {
  if (appMode !== 'supabase') return { request_number: 'DEMO', demo: true };
  const { data, error } = await requireSupabase().rpc('submit_my_request', {
    p_definition_id: definitionId,
    p_payload: payload,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}

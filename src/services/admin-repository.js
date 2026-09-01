import { appMode, requireSupabase } from './supabase.js';
import { adminMembers, adminRequests, adminAgreements, adminActivity } from './admin-mock-data.js';
import { adminContent, adminProposals, auditEvents } from './admin-content-mock-data.js';

const stateLabels = {
  activo: 'Activo', inactivo: 'Inactivo', pendiente: 'Pendiente', baja: 'Baja',
  borrador: 'Borrador', recibida: 'Recibida', en_revision: 'En revisión',
  requiere_informacion: 'Requiere información', en_gestion: 'En gestión', resuelta: 'Resuelta', cancelada: 'Cancelada',
  publicado: 'Publicado', programado: 'Programado', archivado: 'Archivado',
  en_evaluacion: 'En evaluación', publicada: 'Publicada', cerrada: 'Cerrada', respondida: 'Respondida'
};

const label = (value) => stateLabels[value] || value || '—';
const fmtDate = (value) => value ? new Intl.DateTimeFormat('es-UY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

export async function listAdminMembers() {
  if (appMode === 'demo') return adminMembers;
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('id,first_name,last_name,document_number,member_number,email,sector,status,joined_at,requests:requests(id)').order('last_name');
  if (error) throw error;
  return (data || []).map(m => ({
    id: m.id,
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
    memberNumber: m.member_number || '—', document: m.document_number || '—', email: m.email || '—', sector: m.sector || '—',
    status: label(m.status), joined: m.joined_at || '—', requests: m.requests?.length || 0
  }));
}

export async function updateAdminMember(id, patch) {
  if (appMode === 'demo') return { demo: true };
  const allowed = ['first_name','last_name','email','phone','sector','department','status','member_number','joined_at'];
  const payload = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').update(payload).eq('id', id).select('id').single();
  if (error) throw error;
  return data;
}

export async function listAdminRequests() {
  if (appMode === 'demo') return adminRequests;
  const client = requireSupabase();
  const { data, error } = await client.from('requests')
    .select('id,request_number,status,updated_at,assigned_to,profile:profiles!requests_profile_id_fkey(first_name,last_name),definition:request_definitions(name),assignee:profiles!requests_assigned_to_fkey(first_name,last_name)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    dbId: r.id, id: r.request_number, member: `${r.profile?.first_name || ''} ${r.profile?.last_name || ''}`.trim() || '—',
    type: r.definition?.name || 'Solicitud', status: label(r.status), assignee: r.assignee ? `${r.assignee.first_name} ${r.assignee.last_name}` : 'Sin asignar', updated: fmtDate(r.updated_at)
  }));
}

export async function updateAdminRequest(requestId, { status, assignedTo = undefined, note = '' }) {
  if (appMode === 'demo') return { demo: true };
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_update_request', {
    p_request_id: requestId,
    p_status: status || null,
    p_assigned_to: assignedTo || null,
    p_set_assignee: assignedTo !== undefined,
    p_note: note || null,
    p_visible_to_member: true
  });
  if (error) throw error;
  return data;
}

export async function listAdminAgreements() {
  if (appMode === 'demo') return adminAgreements;
  const client = requireSupabase();
  const { data, error } = await client.from('agreements').select('*').order('sort_order').order('name');
  if (error) throw error;
  return (data || []).map(a => ({
    id: a.id, name: a.name, category: a.category, benefit: a.short_benefit, status: label(a.status), action: labelAction(a.access_action),
    validity: [a.starts_at, a.ends_at].filter(Boolean).join(' → ') || 'Sin vencimiento', raw: a
  }));
}

export async function saveAdminAgreement(input) {
  if (appMode === 'demo') return { demo: true };
  const client = requireSupabase();
  const slug = input.slug || slugify(input.name);
  const payload = { ...input, slug };
  const { data, error } = await client.from('agreements').upsert(payload, { onConflict: 'slug' }).select().single();
  if (error) throw error;
  return data;
}

export async function listAdminContent() {
  if (appMode === 'demo') return adminContent;
  const client = requireSupabase();
  const { data, error } = await client.from('content_items').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(x => ({ id:x.id, kind: titleCase(x.kind), status: label(x.status), pinned:x.pinned, title:x.title, audience: audienceLabel(x.audience), date:fmtDate(x.published_at || x.starts_at || x.created_at), raw:x }));
}

export async function saveAdminContent(input) {
  if (appMode === 'demo') return { demo: true };
  const client = requireSupabase();
  const payload = { ...input };
  if (payload.status === 'publicado' && !payload.published_at) payload.published_at = new Date().toISOString();
  const { data, error } = await client.from('content_items').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function listAdminProposals() {
  if (appMode === 'demo') return adminProposals;
  const client = requireSupabase();
  const { data, error } = await client.from('proposals')
    .select('id,title,status,created_at,response,profile:profiles(first_name,last_name),supports:proposal_supports(count)')
    .order('created_at', { ascending:false });
  if (error) throw error;
  return (data || []).map(x => ({ id:x.id, title:x.title, status:label(x.status), author:`${x.profile?.first_name || ''} ${x.profile?.last_name || ''}`.trim() || 'Socio', supports:x.supports?.[0]?.count || 0, received:fmtDate(x.created_at), raw:x }));
}

export async function moderateProposal(id, status, note = '') {
  if (appMode === 'demo') return { demo:true };
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_moderate_proposal', { p_proposal_id:id, p_status:status, p_note:note || null });
  if (error) throw error;
  return data;
}

export async function listAuditEvents(limit = 200) {
  if (appMode === 'demo') return auditEvents;
  const client = requireSupabase();
  const { data, error } = await client.from('audit_log').select('id,action,entity_type,entity_id,metadata,created_at,actor:profiles(first_name,last_name)').order('created_at',{ascending:false}).limit(limit);
  if (error) throw error;
  return (data || []).map(x => ({ at:fmtDate(x.created_at), actor:x.actor ? `${x.actor.first_name} ${x.actor.last_name}` : 'Sistema', action:x.action, entity:`${x.entity_type}${x.entity_id ? ` · ${x.entity_id}` : ''}`, detail:formatMetadata(x.metadata) }));
}

export async function getAdminDashboardData() {
  if (appMode === 'demo') return null;
  const client = requireSupabase();
  const [members, requests, proposals, audit] = await Promise.all([
    client.from('profiles').select('id',{count:'exact',head:true}).eq('status','activo'),
    client.from('requests').select('id',{count:'exact',head:true}).in('status',['recibida','en_revision','requiere_informacion','en_gestion']),
    client.from('proposals').select('id',{count:'exact',head:true}).eq('status','en_evaluacion'),
    listAuditEvents(8)
  ]);
  [members, requests, proposals].forEach(r => { if (r.error) throw r.error; });
  return { activeMembers:members.count || 0, openRequests:requests.count || 0, proposalsToModerate:proposals.count || 0, audit };
}

function slugify(value='') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function titleCase(v=''){ return String(v).replace(/_/g,' ').replace(/^./, c=>c.toUpperCase()); }
function audienceLabel(v){ if(!v) return 'Todos los socios'; if(typeof v==='string') return v; return v.type === 'all_members' ? 'Todos los socios' : v.label || 'Audiencia segmentada'; }
function labelAction(v){ return ({carnet:'Mostrar carné',tramite:'Iniciar trámite',sitio:'Ir al sitio',contacto:'Contactar',sucursal:'Ver sucursal'})[v] || v || '—'; }
function formatMetadata(v){ if(!v || !Object.keys(v).length) return '—'; return Object.entries(v).slice(0,4).map(([k,val])=>`${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join(' · '); }

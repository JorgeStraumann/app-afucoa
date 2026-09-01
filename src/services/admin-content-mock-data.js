export const adminContent = [
  { id:'c001', kind:'Comunicado', title:'Convocatoria a Asamblea General', status:'Programado', date:'02/09/2026 · 09:00', audience:'Todos los socios', pinned:true },
  { id:'c002', kind:'Noticia', title:'Nuevo convenio de salud disponible', status:'Publicado', date:'31/08/2026 · 11:10', audience:'Todos los socios', pinned:false },
  { id:'c003', kind:'Evento', title:'Reunión informativa sobre cobertura BSE', status:'Borrador', date:'Sin publicar', audience:'Todos los socios', pinned:false }
];

export const adminDocuments = [
  { id:'d001', title:'Estatuto de AFUCOA', category:'Estatuto', version:'3.0', status:'Publicado', updated:'12/08/2026', current:true },
  { id:'d002', title:'Reglamento de funcionamiento', category:'Reglamentos', version:'2.1', status:'Publicado', updated:'20/07/2026', current:true },
  { id:'d003', title:'Formulario de afiliación', category:'Formularios', version:'1.4', status:'Borrador', updated:'29/08/2026', current:false }
];

export const adminProposals = [
  { id:'p001', title:'Ampliar convenios de óptica', author:'Socio Nº 1832', status:'En evaluación', supports:0, received:'Hoy · 10:22' },
  { id:'p002', title:'Beneficio de transporte interdepartamental', author:'Socio Nº 1750', status:'En evaluación', supports:0, received:'Ayer · 18:04' },
  { id:'p003', title:'Extender horario de atención sindical', author:'Socio Nº 1902', status:'Publicada', supports:48, received:'28/08/2026' },
  { id:'p004', title:'Repositorio de normativa laboral', author:'Socio Nº 1881', status:'Respondida', supports:71, received:'11/08/2026' }
];

export const adminNotifications = [
  { id:'n001', title:'Asamblea General', audience:'Todos los socios', channel:'Push + centro', status:'Programada', sendAt:'02/09/2026 · 09:00' },
  { id:'n002', title:'Nuevo convenio publicado', audience:'Todos los socios', channel:'Push + centro', status:'Enviada', sendAt:'31/08/2026 · 11:12' },
  { id:'n003', title:'Solicitud requiere información', audience:'1 socio', channel:'Centro', status:'Enviada', sendAt:'31/08/2026 · 12:05' }
];

export const auditEvents = [
  { at:'31/08/2026 · 14:20', actor:'Julio Pintos', action:'Cambió estado de trámite', entity:'AF-2026-00418', detail:'Recibida → En revisión' },
  { at:'31/08/2026 · 12:05', actor:'Sistema', action:'Generó notificación', entity:'AF-2026-00417', detail:'Solicitud requiere información' },
  { at:'31/08/2026 · 11:10', actor:'Administrador', action:'Publicó convenio', entity:'Centro Salud Integral', detail:'Estado Borrador → Publicado' },
  { at:'31/08/2026 · 09:52', actor:'Emanuel Basualdo', action:'Editó comunicado', entity:'Convocatoria a Asamblea General', detail:'Guardado como borrador' }
];

export const adminSettings = {
  organizationName:'AFUCOA',
  fullName:'Asociación de Funcionarios de la Comisión Administrativa',
  supportEmail:'afucoa@example.uy',
  defaultRequestOwner:'Sin asignar',
  requestPrefix:'AF',
  allowMemberProposals:true,
  allowPush:true,
  requireProposalModeration:true
};

export const adminStats = [
  { label:'Socios activos', value:'428', delta:'+6 este mes', tone:'blue' },
  { label:'Solicitudes pendientes', value:'17', delta:'5 requieren atención', tone:'gold' },
  { label:'Propuestas por moderar', value:'4', delta:'2 recibidas hoy', tone:'neutral' },
  { label:'Publicaciones programadas', value:'3', delta:'Próxima: 02/09', tone:'neutral' }
];

export const adminMembers = [
  { id:'s001', name:'Jorge Andrés Carrara', memberNumber:'1925', document:'4.567.890-1', email:'jorge@example.uy', sector:'Administración', status:'Activo', joined:'01/07/2025', requests:2 },
  { id:'s002', name:'Emanuel Basualdo', memberNumber:'1901', document:'3.981.402-7', email:'emanuel@example.uy', sector:'Administración', status:'Activo', joined:'14/05/2024', requests:0 },
  { id:'s003', name:'Julio Pintos', memberNumber:'1874', document:'4.102.774-3', email:'julio@example.uy', sector:'Servicios', status:'Activo', joined:'02/02/2023', requests:1 },
  { id:'s004', name:'Leonardo Mariño', memberNumber:'1912', document:'4.811.204-6', email:'leonardo@example.uy', sector:'Mantenimiento', status:'Activo', joined:'18/09/2024', requests:0 },
  { id:'s005', name:'María Rodríguez', memberNumber:'1762', document:'3.774.115-8', email:'maria@example.uy', sector:'Comisiones', status:'Pendiente', joined:'—', requests:1 },
  { id:'s006', name:'Carlos Fernández', memberNumber:'1698', document:'3.208.997-2', email:'carlos@example.uy', sector:'Talleres', status:'Inactivo', joined:'12/11/2019', requests:0 }
];

export const adminRequests = [
  { id:'AF-2026-00418', member:'Jorge Andrés Carrara', type:'Constancia de afiliación', status:'En revisión', priority:'Normal', assignee:'J. Pintos', updated:'Hoy · 14:20' },
  { id:'AF-2026-00417', member:'María Rodríguez', type:'Actualización de datos', status:'Requiere información', priority:'Alta', assignee:'Sin asignar', updated:'Hoy · 12:04' },
  { id:'AF-2026-00416', member:'Pablo Gómez', type:'Solicitud general', status:'Recibida', priority:'Normal', assignee:'Sin asignar', updated:'Hoy · 10:46' },
  { id:'AF-2026-00415', member:'Lucía Pereira', type:'Consulta administrativa', status:'En gestión', priority:'Normal', assignee:'E. Basualdo', updated:'Ayer · 16:30' },
  { id:'AF-2026-00414', member:'Martín Silva', type:'Constancia de afiliación', status:'Resuelta', priority:'Normal', assignee:'Sistema', updated:'Ayer · 12:10' }
];

export const adminAgreements = [
  { id:'salud-integral', name:'Centro Salud Integral', category:'Salud', benefit:'20% OFF', status:'Publicado', validity:'31/12/2026', action:'Carné digital' },
  { id:'sabores-del-sur', name:'Sabores del Sur', category:'Gastronomía', benefit:'15% OFF', status:'Publicado', validity:'Vigente', action:'Carné digital' },
  { id:'formacion-profesional', name:'Instituto de Formación Profesional', category:'Educación', benefit:'25% OFF', status:'Publicado', validity:'Ciclo 2026', action:'Trámite' },
  { id:'turismo-uruguay', name:'Turismo Uruguay', category:'Turismo', benefit:'Tarifa preferencial', status:'Borrador', validity:'Sin publicar', action:'Contacto' }
];

export const adminActivity = [
  { icon:'▤', title:'AF-2026-00418 pasó a En revisión', meta:'Hace 18 min · J. Pintos' },
  { icon:'●', title:'Se actualizó la ficha del socio Nº 1874', meta:'Hace 42 min · E. Basualdo' },
  { icon:'%', title:'Se publicó el convenio Centro Salud Integral', meta:'Hoy · 11:10 · Administrador' },
  { icon:'▣', title:'Comunicado institucional guardado como borrador', meta:'Hoy · 09:52 · Administrador' }
];

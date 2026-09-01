export const demoMember = {
  firstName: 'Jorge',
  fullName: 'Jorge Andrés Carrara',
  initials: 'JC',
  memberNumber: '1925',
  status: 'activo',
  joinedAt: '2025-07-01'
};

export const agreements = [
  { id:'salud-integral', name:'Centro Salud Integral', category:'Salud', benefit:'20% OFF', summary:'Descuento para socios en consultas y servicios seleccionados.', conditions:'Presentar carné AFUCOA vigente antes de facturar. No acumulable con otras promociones.', access:'Mostrar el carné digital AFUCOA en recepción.', validity:'Vigente hasta 31/12/2026', action:'carnet', featured:true, isNew:true },
  { id:'sabores-del-sur', name:'Sabores del Sur', category:'Gastronomía', benefit:'15% OFF', summary:'Beneficio en consumo en salón de lunes a jueves.', conditions:'Válido para el socio y un acompañante. No acumulable.', access:'Acreditar afiliación al solicitar la cuenta.', validity:'Vigente', action:'carnet', isNew:true },
  { id:'formacion-profesional', name:'Instituto de Formación Profesional', category:'Educación', benefit:'25% OFF', summary:'Bonificación en cursos seleccionados y matrícula.', conditions:'Sujeto a cupos y calendario de cada curso.', access:'Solicitar constancia de afiliación desde AFUCOA.', validity:'Ciclo 2026', action:'tramite' },
  { id:'turismo-uruguay', name:'Turismo Uruguay', category:'Turismo', benefit:'Tarifa preferencial', summary:'Tarifas especiales en paquetes seleccionados.', conditions:'Reserva previa y disponibilidad.', access:'Contactar al proveedor e indicar convenio AFUCOA.', validity:'Vigente', action:'contacto' },
  { id:'optica-central', name:'Óptica Central', category:'Compras', benefit:'18% OFF', summary:'Descuento en armazones y cristales seleccionados.', conditions:'No acumulable con liquidaciones.', access:'Mostrar carné digital AFUCOA.', validity:'Vigente', action:'carnet' },
  { id:'servicios-hogar', name:'Servicios Hogar', category:'Servicios', benefit:'10% OFF', summary:'Descuento en servicios domiciliarios seleccionados.', conditions:'Coordinación previa.', access:'Solicitar el beneficio identificándose como socio AFUCOA.', validity:'Vigente', action:'contacto' }
];

export const requestDefinitions = [
  {
    id:'constancia-afiliacion',
    name:'Constancia de afiliación',
    category:'Constancias',
    description:'Generá o solicitá una constancia que acredita tu afiliación vigente a AFUCOA.',
    estimated:'Inmediato o hasta 1 día hábil',
    automatic:true,
    steps:[
      { id:'motivo', title:'Solicitud', fields:[
        { name:'purpose', label:'¿Para qué necesitás la constancia?', type:'select', required:true, options:['Convenio comercial','Presentación administrativa','Trámite personal','Otro'] },
        { name:'notes', label:'Observaciones', type:'textarea', required:false, placeholder:'Agregá información solo si es necesaria.' }
      ]},
      { id:'review', title:'Revisar y generar', fields:[] }
    ]
  },
  {
    id:'actualizacion-datos',
    name:'Actualización de datos',
    category:'Datos personales',
    description:'Solicitá la modificación de información que requiera validación administrativa.',
    estimated:'2 a 3 días hábiles',
    automatic:false,
    steps:[
      { id:'datos', title:'Datos a modificar', fields:[
        { name:'field', label:'Dato que querés modificar', type:'select', required:true, options:['Correo electrónico','Teléfono','Sector / dependencia','Otro'] },
        { name:'newValue', label:'Nuevo valor', type:'text', required:true, placeholder:'Ingresá el dato actualizado' }
      ]},
      { id:'documentacion', title:'Documentación', fields:[
        { name:'attachment', label:'Adjuntar respaldo', type:'file', required:false }
      ]},
      { id:'review', title:'Revisar y enviar', fields:[] }
    ]
  },
  {
    id:'solicitud-general',
    name:'Solicitud general',
    category:'Gestiones',
    description:'Enviá un planteo o gestión a AFUCOA y seguí su evolución.',
    estimated:'3 a 5 días hábiles',
    automatic:false,
    steps:[
      { id:'detalle', title:'Solicitud', fields:[
        { name:'subject', label:'Asunto', type:'text', required:true, placeholder:'Resumen breve de tu solicitud' },
        { name:'description', label:'Descripción', type:'textarea', required:true, placeholder:'Explicá qué necesitás gestionar.' }
      ]},
      { id:'documentacion', title:'Documentación', fields:[{ name:'attachment', label:'Adjuntar archivo', type:'file', required:false }]},
      { id:'review', title:'Revisar y enviar', fields:[] }
    ]
  },
  {
    id:'consulta-administrativa',
    name:'Consulta administrativa',
    category:'Consultas',
    description:'Canalizá una consulta y conservá la respuesta dentro de la aplicación.',
    estimated:'2 a 4 días hábiles',
    automatic:false,
    steps:[
      { id:'consulta', title:'Consulta', fields:[
        { name:'subject', label:'Tema', type:'text', required:true },
        { name:'description', label:'Consulta', type:'textarea', required:true }
      ]},
      { id:'review', title:'Revisar y enviar', fields:[] }
    ]
  }
];

export const demoRequests = [
  {
    id:'AF-2026-00418',
    definitionId:'constancia-afiliacion',
    title:'Constancia de afiliación',
    status:'en_revision',
    statusLabel:'En revisión',
    updatedLabel:'Actualizada hoy, 14:20',
    createdAt:'31/08/2026 13:56',
    events:[
      { state:'done', label:'Solicitud recibida', date:'31/08/2026 · 13:56', detail:'AFUCOA recibió correctamente la solicitud.' },
      { state:'done', label:'Datos validados', date:'31/08/2026 · 14:02', detail:'La afiliación figura activa en el padrón de desarrollo.' },
      { state:'current', label:'En revisión', date:'31/08/2026 · 14:20', detail:'La solicitud fue asignada para revisión.' },
      { state:'pending', label:'Resolución', date:'Pendiente', detail:'La resolución aparecerá acá cuando esté disponible.' }
    ],
    messages:[
      { author:'Sistema AFUCOA', date:'31/08/2026 · 13:56', text:'Tu solicitud fue registrada con el número AF-2026-00418.' }
    ]
  }
];

export const contentItems = [
  {
    id:'asamblea-septiembre', kind:'evento', badge:'Agenda', title:'Próxima Asamblea General', summary:'Información de la próxima Asamblea General y documentación asociada.', dateLabel:'Miércoles 9 de septiembre · 13:00', location:'Palacio Legislativo', priority:10, featured:true
  },
  {
    id:'nuevos-convenios-agosto', kind:'noticia', badge:'Nuevo', title:'Nuevos beneficios para socios', summary:'Se incorporaron nuevos convenios en salud, gastronomía y educación.', dateLabel:'31 de agosto de 2026', priority:4
  },
  {
    id:'comunicado-gestion', kind:'comunicado', badge:'Comunicado', title:'Actualización sobre gestiones institucionales', summary:'Resumen de avances y próximos pasos de las gestiones que AFUCOA mantiene en curso.', dateLabel:'29 de agosto de 2026', priority:6
  },
  {
    id:'documentacion-digital', kind:'noticia', badge:'Información', title:'La biblioteca documental se prepara para V2', summary:'La nueva versión centralizará reglamentos, actas, formularios y documentos vigentes.', dateLabel:'27 de agosto de 2026', priority:2
  }
];

export const documents = [
  { id:'estatuto-2026', title:'Estatuto de AFUCOA', category:'Estatuto', description:'Texto institucional vigente para consulta de socios.', version:'Versión 2026', dateLabel:'Actualizado 15/08/2026', current:true },
  { id:'reglamento-electoral', title:'Reglamento electoral', category:'Reglamentos', description:'Normas y procedimientos aplicables a los procesos electorales internos.', version:'Versión 2.1', dateLabel:'12/06/2026', current:true },
  { id:'acta-agosto', title:'Acta de Comisión Directiva — agosto', category:'Actas', description:'Acta publicada para consulta institucional.', version:'Acta 08/2026', dateLabel:'28/08/2026', current:true },
  { id:'formulario-afiliacion', title:'Formulario de afiliación', category:'Formularios', description:'Modelo vigente para gestiones de afiliación.', version:'Edición 2026', dateLabel:'01/07/2026', current:true },
  { id:'comunicado-0726', title:'Comunicado institucional julio', category:'Comunicados', description:'Versión histórica conservada para trazabilidad.', version:'Comunicado 07/2026', dateLabel:'30/07/2026', current:false }
];

export const proposals = [
  { id:'p1', title:'Espacio digital de consultas frecuentes', category:'Servicios', summary:'Centralizar respuestas a consultas recurrentes y permitir que los socios encuentren información sin depender de mensajes individuales.', status:'publicada', statusLabel:'Activa', supports:34, supported:false, mine:false, dateLabel:'28/08/2026' },
  { id:'p2', title:'Más actividades de capacitación', category:'Formación', summary:'Propuesta para ampliar convenios y actividades formativas para funcionarios.', status:'publicada', statusLabel:'Activa', supports:21, supported:true, mine:true, dateLabel:'25/08/2026' },
  { id:'p3', title:'Repositorio de documentación histórica', category:'Institucional', summary:'Digitalizar y ordenar documentos históricos relevantes para AFUCOA.', status:'respondida', statusLabel:'Respondida', supports:48, mine:false, dateLabel:'12/07/2026', response:'La propuesta fue aceptada y se integra a la Biblioteca Documental de AFUCOA V2.' },
  { id:'p4', title:'Mejora del canal de solicitudes', category:'Gestión', summary:'Incorporar seguimiento por estados y mensajes dentro de cada solicitud.', status:'cerrada', statusLabel:'Cerrada', supports:55, mine:true, dateLabel:'18/06/2026' }
];

export const notifications = [
  { id:'n1', kind:'tramite', priority:9, read:false, title:'Tu solicitud está en revisión', text:'AF-2026-00418 recibió una actualización.', dateLabel:'Hoy · 14:20', href:'/solicitudes/AF-2026-00418' },
  { id:'n2', kind:'institucional', priority:10, read:false, title:'Próxima Asamblea General', text:'Consultá fecha, horario e información disponible.', dateLabel:'Hoy · 11:30', href:'/noticias' },
  { id:'n3', kind:'convenio', priority:4, read:true, title:'Nuevo convenio disponible', text:'Se incorporó un nuevo beneficio en salud.', dateLabel:'Ayer · 16:10', href:'/convenios' },
  { id:'n4', kind:'documento', priority:3, read:true, title:'Documento actualizado', text:'Hay una nueva versión vigente en la biblioteca.', dateLabel:'29 ago. · 09:15', href:'/documentos' }
];

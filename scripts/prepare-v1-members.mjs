// Convierte un CSV exportado del padrón V1 en un CSV normalizado para migración V2.
// Uso: node scripts/prepare-v1-members.mjs entrada.csv salida.csv
import fs from 'node:fs';
const [,,input,output='members-v2.csv']=process.argv;
if(!input) throw new Error('Indicá el CSV de entrada.');
const raw=fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'');
const lines=raw.split(/\r?\n/).filter(Boolean); const head=lines.shift().split(';').map(x=>x.trim().toLowerCase());
const idx=(...names)=>names.map(n=>head.indexOf(n)).find(i=>i>=0);
const cols={document:idx('cedula','cédula','documento'),member:idx('ficha','nro_ficha','numero_ficha'),first:idx('nombre','nombres'),last:idx('apellido','apellidos'),email:idx('email','correo'),phone:idx('telefono','teléfono','celular'),sector:idx('sector','dependencia'),status:idx('estado')};
const clean=v=>String(v??'').trim(); const doc=v=>clean(v).replace(/\D/g,'');
const out=[['document_number','member_number','first_name','last_name','email','phone','sector','status','migration_source','migration_external_id'].join(';')];
const seen=new Set(); const errors=[];
for(let n=0;n<lines.length;n++){const p=lines[n].split(';');const d=doc(p[cols.document]);if(d.length<6){errors.push(`Línea ${n+2}: cédula inválida`);continue}if(seen.has(d)){errors.push(`Línea ${n+2}: cédula duplicada ${d}`);continue}seen.add(d);const status=clean(p[cols.status]).toLowerCase();out.push([d,clean(p[cols.member]),clean(p[cols.first]),clean(p[cols.last]),clean(p[cols.email]).toLowerCase(),clean(p[cols.phone]),clean(p[cols.sector]),['activo','inactivo','pendiente','baja'].includes(status)?status:'activo','v1',clean(p[cols.member])||d].map(v=>String(v).replaceAll(';',',')).join(';'));}
fs.writeFileSync(output,out.join('\n')); console.log(`Preparados: ${out.length-1}. Omitidos: ${errors.length}. Archivo: ${output}`); if(errors.length) console.log(errors.slice(0,20).join('\n'));

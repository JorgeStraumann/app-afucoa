import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method!=='POST') return json({error:'method_not_allowed'},405)
  const {document_number}=await req.json(); const document=String(document_number||'').replace(/\D/g,'')
  // Respuesta deliberadamente neutra para evitar enumeración de socios.
  if(document.length<6) return json({ok:true})
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:profile}=await supabase.from('profiles').select('id,email,status').eq('document_number',document).maybeSingle()
  if(!profile || profile.status==='baja' || !profile.email) return json({ok:true})
  const raw=String(Math.floor(100000+Math.random()*900000)); const enc=new TextEncoder().encode(raw); const digest=await crypto.subtle.digest('SHA-256',enc); const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
  await supabase.from('password_recovery_codes').update({consumed_at:new Date().toISOString()}).eq('profile_id',profile.id).is('consumed_at',null)
  await supabase.from('password_recovery_codes').insert({profile_id:profile.id,code_hash:hash,expires_at:new Date(Date.now()+10*60*1000).toISOString()})
  // Integrar proveedor transaccional aquí. Nunca registrar el código en logs de producción.
  // En desarrollo puede usarse un proveedor local o bandeja de pruebas.
  return json({ok:true})
})

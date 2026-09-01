import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
async function sha(value:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
Deno.serve(async(req)=>{
  if(req.method!=='POST') return json({error:'method_not_allowed'},405)
  const {document_number,code,new_password}=await req.json(); const document=String(document_number||'').replace(/\D/g,'')
  if(String(new_password||'').length<8) return json({error:'invalid_password'},400)
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:profile}=await supabase.from('profiles').select('id,auth_user_id').eq('document_number',document).maybeSingle(); if(!profile?.auth_user_id) return json({error:'invalid_code'},400)
  const {data:row}=await supabase.from('password_recovery_codes').select('*').eq('profile_id',profile.id).is('consumed_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(!row || row.attempts>=5 || row.code_hash!==await sha(String(code||''))){if(row)await supabase.from('password_recovery_codes').update({attempts:row.attempts+1}).eq('id',row.id);return json({error:'invalid_code'},400)}
  const {error}=await supabase.auth.admin.updateUserById(profile.auth_user_id,{password:String(new_password)}); if(error)return json({error:'update_failed'},500)
  await supabase.from('password_recovery_codes').update({consumed_at:new Date().toISOString()}).eq('id',row.id)
  return json({ok:true})
})

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const DEV='https://imiplnspvmsrsuikulwm.supabase.co';
const origins=new Set(['https://jorgestraumann.github.io','http://localhost:5173','http://localhost:4173']);
export function respond(request,body,status=200) {
  const origin=request.headers.get('origin');
  return new Response(body===null?null:JSON.stringify(body),{status,headers:{
    'content-type':'application/json','cache-control':'no-store','vary':'Origin',
    'access-control-allow-origin':origins.has(origin)?origin:'https://jorgestraumann.github.io',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods':'POST, OPTIONS',
  }});
}
export function preflight(request) {
  if(request.headers.has('origin') && !origins.has(request.headers.get('origin'))) return respond(request,{error:'forbidden'},403);
  if(request.method==='OPTIONS') return respond(request,null,204);
  if(request.method!=='POST') return respond(request,{error:'method_not_allowed'},405);
  return null;
}
export async function authenticate(request,adminOnly=false) {
  const jwt=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!jwt) return {error:401};
  if(Deno.env.get('SUPABASE_URL')!==DEV) return {error:503};
  const db=createClient(DEV,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const user=await db.auth.getUser(jwt);
  if(user.error || !user.data.user) return {error:401};
  const profile=await db.from('profiles').select('id,role').eq('auth_user_id',user.data.user.id).eq('status','activo').maybeSingle();
  if(profile.error) return {error:503};
  if(!profile.data || (adminOnly && !['admin','superadmin'].includes(profile.data.role))) return {error:403};
  return {db,profile:profile.data};
}
export async function pushEnabled(db) {
  const result=await db.from('app_settings').select('value').eq('key','features').maybeSingle();
  if(result.error) throw new Error('configuration_unavailable');
  return result.data?.value?.allowPush===true;
}
export async function readBody(request) {
  if(Number(request.headers.get('content-length'))>1024) return null;
  const reader=request.body?.getReader(); if(!reader) return null;
  const chunks=[]; let size=0;
  try {
    while(true) {const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();return null;}chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {return null;} finally {reader.releaseLock();}
}

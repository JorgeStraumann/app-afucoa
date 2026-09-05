import {authenticate,loadRuntimeConfig,preflight,pushEnabled,respond} from '../_shared/push-http.ts';
Deno.serve(async request => {
  let config;
  try {config=loadRuntimeConfig();} catch {return respond(request,null,{error:'unavailable'},503);}
  const early=preflight(request,config);if(early)return early;
  try {
    const context=await authenticate(request,config);if(context.error)return respond(request,config,{error:'not_authorized'},context.error);
    const enabled=await pushEnabled(context.db);
    const publicKey=Deno.env.get('VAPID_PUBLIC_KEY');
    const configured=Boolean(publicKey && Deno.env.get('VAPID_PRIVATE_KEY') && Deno.env.get('VAPID_SUBJECT'));
    return respond(request,config,{enabled:enabled && configured,publicKey:enabled && configured?publicKey:null});
  } catch {return respond(request,config,{error:'unavailable'},503);}
});

import {authenticate,preflight,pushEnabled,respond} from '../_shared/push-http.ts';
Deno.serve(async request => {
  const early=preflight(request);if(early)return early;
  try {
    const context=await authenticate(request);if(context.error)return respond(request,{error:'not_authorized'},context.error);
    const enabled=await pushEnabled(context.db);
    const publicKey=Deno.env.get('VAPID_PUBLIC_KEY');
    const configured=Boolean(publicKey && Deno.env.get('VAPID_PRIVATE_KEY') && Deno.env.get('VAPID_SUBJECT'));
    return respond(request,{enabled:enabled && configured,publicKey:enabled && configured?publicKey:null});
  } catch {return respond(request,{error:'unavailable'},503);}
});

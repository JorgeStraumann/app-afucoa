import webpush from 'npm:web-push@3.6.7';
import {authenticate,preflight,pushEnabled,readBody,respond} from '../_shared/push-http.ts';
import {dispatchPush} from '../_shared/push-policy.ts';
Deno.serve(async request => {
  const early=preflight(request);if(early)return early;
  try {
    const context=await authenticate(request,true);if(context.error)return respond(request,{error:'not_authorized'},context.error);
    const {db}=context;
    const body=await readBody(request);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.notification_id || '')) return respond(request,{error:'invalid_notification'},400);
    const result=await db.from('notifications').select('id,type,target_path').eq('id',body.notification_id).maybeSingle();
    if(result.error)throw new Error('notification_unavailable');
    if(!result.data)return respond(request,{error:'not_found'},404);
    if(!await pushEnabled(db))return respond(request,{status:'disabled',found:0,sent:0,failed:0,deactivated:0});
    const vapidDetails={publicKey:Deno.env.get('VAPID_PUBLIC_KEY'),privateKey:Deno.env.get('VAPID_PRIVATE_KEY'),subject:Deno.env.get('VAPID_SUBJECT')};
    if(!vapidDetails.publicKey || !vapidDetails.privateKey || !vapidDetails.subject) return respond(request,{status:'not_configured',found:0,sent:0,failed:0,deactivated:0});
    // DEV bound prevents unbounded edge invocations; repeated calls skip completed deliveries.
    const found=await db.rpc('get_notification_push_targets',{p_notification_id:result.data.id}).order('device_id').range(0,39);
    if(found.error)throw new Error('targets_unavailable');
    const summary=await dispatchPush({db,notification:result.data,targets:found.data || [],send:async (target,payload) => {
      const details=webpush.generateRequestDetails({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},payload,{vapidDetails,TTL:300,contentEncoding:'aes128gcm',urgency:'normal'});
      const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:new Uint8Array(details.body),redirect:'error',signal:AbortSignal.timeout(8000)});
      await response.body?.cancel();
      return response.status;
    }});
    return respond(request,{...summary,limited:found.data?.length===40});
  } catch {return respond(request,{error:'push_unavailable'},503);}
});

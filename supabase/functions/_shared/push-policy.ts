export function safeTarget(value) {
  return typeof value === 'string' && /^#\/(?:notificaciones|tramites|carnet|convenios|noticias|documentos|propuestas|cuenta|solicitudes\/[0-9a-f-]{36})?$/.test(value)
    ? value : '#/notificaciones';
}
export function preferenceFor(type) {
  return ({convenio:'agreements',evento:'events',tramite:'request_updates'})[type] || 'news';
}
export function allowedEndpoint(endpoint) {
  try {
    const url=new URL(endpoint);
    return url.protocol==='https:' && !url.port && !url.username && !url.password && !url.hash &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/.test(url.hostname);
  } catch {return false;}
}
export function genericPayload(notification,profileId) {
  return JSON.stringify({target_path:safeTarget(notification.target_path),...(profileId?{profile_id:profileId}:{})});
}

export async function dispatchPush({db,notification,targets,send}) {
  const summary={status:'complete',found:targets.length,sent:0,failed:0,deactivated:0,skipped:0};
  // Bounded parallelism; claim is atomic and retries cannot duplicate a sent push.
  for(let offset=0;offset<targets.length;offset+=4) {
    await Promise.all(targets.slice(offset,offset+4).map(async target => {
      if(!allowedEndpoint(target.endpoint)) {summary.failed++;return;}
      const claim=await db.rpc('claim_notification_push',{p_notification_id:notification.id,p_device_id:target.device_id,p_profile_id:target.profile_id});
      if(claim.error) {summary.failed++;return;}
      if(claim.data!==true) {summary.skipped++;return;}
      let status=0;
      try {status=await send(target,genericPayload(notification,target.profile_id));} catch { /* Never log provider errors: they contain endpoints/headers. */ }
      const dead=status===404 || status===410, ok=status>=200 && status<300;
      if(ok) summary.sent++; else summary.failed++;
      if(dead) {
        const result=await db.from('push_devices').update({active:false}).eq('id',target.device_id).eq('profile_id',target.profile_id);
        if(!result.error) summary.deactivated++;
      }
      const recorded=await db.from('notification_push_deliveries')
        .update({status:ok?'sent':dead?'inactive':'failed',updated_at:new Date().toISOString()})
        .eq('notification_id',notification.id).eq('device_id',target.device_id).eq('profile_id',target.profile_id);
      if(recorded.error) summary.status='incidents';
    }));
  }
  if(summary.failed) summary.status='incidents';
  return summary;
}

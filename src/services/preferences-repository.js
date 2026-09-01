import { appMode, requireSupabase } from './supabase.js';

const defaults={agreements:true,news:true,events:true,request_updates:true};
export async function getNotificationPreferences(){
  if(appMode!=='supabase') return defaults;
  const { data, error }=await requireSupabase().from('notification_preferences').select('*').maybeSingle();
  if(error) throw error;
  return data || defaults;
}
export async function saveNotificationPreferences(values){
  if(appMode!=='supabase') return values;
  const db=requireSupabase();
  const { data: profileId, error: profileError }=await db.rpc('current_profile_id');
  if(profileError) throw profileError;
  const payload={profile_id:profileId,agreements:Boolean(values.agreements),news:Boolean(values.news),events:Boolean(values.events),request_updates:Boolean(values.request_updates),updated_at:new Date().toISOString()};
  const { data, error }=await db.from('notification_preferences').upsert(payload,{onConflict:'profile_id'}).select().single();
  if(error) throw error;
  return data;
}

import { appMode, requireSupabase } from './supabase.js';

export async function listMyNotifications() {
  if (appMode !== 'supabase') return [];
  const { data, error } = await requireSupabase().from('notification_recipients').select('read_at, notifications(*)').order('notification_id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId) {
  if (appMode !== 'supabase') return;
  const { error } = await requireSupabase().rpc('mark_my_notification_read', { p_notification_id: notificationId });
  if (error) throw error;
}

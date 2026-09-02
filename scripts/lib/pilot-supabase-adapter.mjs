export const PROFILE_ACTIVITY_REFERENCES = Object.freeze([
  ['agreement_favorites', 'profile_id'],
  ['app_settings', 'updated_by'],
  ['audit_log', 'actor_profile_id'],
  ['content_items', 'created_by'],
  ['document_favorites', 'profile_id'],
  ['document_versions', 'created_by'],
  ['membership_verification_tokens', 'profile_id'],
  ['notification_campaigns', 'created_by'],
  ['notification_preferences', 'profile_id'],
  ['notification_recipients', 'profile_id'],
  ['password_recovery_codes', 'profile_id'],
  ['proposal_moderation_events', 'actor_profile_id'],
  ['proposal_supports', 'profile_id'],
  ['proposals', 'profile_id'],
  ['push_devices', 'profile_id'],
  ['request_drafts', 'profile_id'],
  ['request_events', 'actor_profile_id'],
  ['request_files', 'uploaded_by'],
  ['request_messages', 'author_profile_id'],
  ['requests', 'assigned_to'],
  ['requests', 'profile_id'],
]);

export function createPilotSupabaseAdapter(client) {
  const authByEmail = new Map();
  let authLoaded = false;

  async function loadAuthUsers() {
    if (authLoaded) return;
    for (let page = 1; ; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const user of data?.users || []) if (user.email) authByEmail.set(user.email.toLowerCase(), user);
      if ((data?.users || []).length < 1000) break;
    }
    authLoaded = true;
  }

  async function selectProfiles(column, value) {
    if (!value) return [];
    const { data, error } = await client.from('profiles').select('*').eq(column, value);
    if (error) throw error;
    return data || [];
  }

  return {
    async findProfiles(row) {
      const [migration, document, member] = await Promise.all([
        client.from('profiles').select('*').eq('migration_source', row.migration_source).eq('migration_external_id', row.migration_external_id),
        client.from('profiles').select('*').eq('document_number', row.document_number),
        client.from('profiles').select('*').eq('member_number', row.member_number),
      ]);
      for (const result of [migration, document, member]) if (result.error) throw result.error;
      return [...(migration.data || []), ...(document.data || []), ...(member.data || [])];
    },
    async findProfileByAuthUser(authUserId) {
      const rows = await selectProfiles('auth_user_id', authUserId);
      return rows[0] || null;
    },
    async getProfile(profileId) {
      const rows = await selectProfiles('id', profileId);
      return rows[0] || null;
    },
    async getProfileActivity(profileId) {
      const checks = await Promise.all(PROFILE_ACTIVITY_REFERENCES.map(async ([table, column]) => {
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq(column, profileId);
        if (error) throw new Error(`No se pudo verificar actividad en ${table}.${column}: ${error.message || error}`);
        return { table, column, count: count || 0 };
      }));
      const dependencies = checks.filter(check => check.count > 0);
      return { has_activity: dependencies.length > 0, dependencies };
    },
    async findAuthUserByEmail(email) {
      await loadAuthUsers();
      return authByEmail.get(email.toLowerCase()) || null;
    },
    async getAuthUser(authUserId) {
      const { data, error } = await client.auth.admin.getUserById(authUserId);
      if (error) {
        if (error.status === 404) return null;
        throw error;
      }
      return data?.user || null;
    },
    async createAuthUser(attributes) {
      const { data, error } = await client.auth.admin.createUser(attributes);
      if (error) throw error;
      if (!data?.user) throw new Error('Supabase Auth no devolvió el usuario creado.');
      if (data.user.email) authByEmail.set(data.user.email.toLowerCase(), data.user);
      return data.user;
    },
    async deleteAuthUser(authUserId) {
      const { error } = await client.auth.admin.deleteUser(authUserId);
      if (error && error.status !== 404) throw error;
      for (const [email, user] of authByEmail) if (user.id === authUserId) authByEmail.delete(email);
    },
    async createProfile(payload) {
      const { data, error } = await client.from('profiles').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async updateProfile(profileId, patch) {
      const { data, error } = await client.from('profiles').update(patch).eq('id', profileId).select().single();
      if (error) throw error;
      return data;
    },
    async deleteProfile(profileId) {
      const { error } = await client.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
    },
  };
}

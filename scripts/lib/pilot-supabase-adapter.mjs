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

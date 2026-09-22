import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

async function loadRepository(client, appMode = 'supabase') {
  const source = (await readFile(new URL('src/services/admin-repository.js', root), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return vm.runInNewContext(`${source};({listAdminProposals})`, {
    appMode,
    requireSupabase: () => client,
    adminMembers: [], adminRequests: [], adminAgreements: [], adminActivity: [],
    adminContent: [], adminDocuments: [], adminProposals: [], adminNotifications: [], auditEvents: [], adminSettings: {},
    sendNotificationPush: async () => ({}),
    console,
  });
}

function proposalClient(rows) {
  const calls = { table: null, select: null, order: null };
  return {
    calls,
    from(table) {
      calls.table = table;
      return {
        select(selection) {
          calls.select = selection;
          return {
            async order(column, options) {
              calls.order = { column, options };
              if (!selection.includes('profiles!proposals_profile_id_fkey')) {
                return { data: null, error: { code: 'PGRST201', message: 'ambiguous embedding' } };
              }
              return { data: rows, error: null };
            },
          };
        },
      };
    },
  };
}

test('consulta Admin Propuestas desambigua autor por proposals_profile_id_fkey', async () => {
  const client = proposalClient([{
    id: 'proposal-1', title: 'Propuesta sintética', status: 'en_evaluacion', response: null,
    created_at: '2026-09-21T12:00:00Z', profile: { first_name: 'Socio', last_name: 'Sintético' },
    supports: [{ count: 3 }],
  }]);
  const { listAdminProposals } = await loadRepository(client);
  const rows = await listAdminProposals();

  assert.equal(client.calls.table, 'proposals');
  assert.match(client.calls.select, /profile:profiles!proposals_profile_id_fkey\(first_name,last_name\)/);
  assert.match(client.calls.select, /supports:proposal_supports\(count\)/);
  assert.equal(client.calls.order.column, 'created_at');
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(({ id, title, author, status, supports }) => ({ id, title, author, status, supports })))), [{
    id: 'proposal-1', title: 'Propuesta sintética', author: 'Socio Sintético', status: 'En evaluación', supports: 3,
  }]);
});

async function loadAdminPage({ appMode, listAdminProposals }) {
  const source = (await readFile(new URL('src/pages/admin/admin-advanced.js', root), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  const demo = [{ id: 'demo-1', title: 'Propuesta demo visible', author: 'Socio demo', status: 'En evaluación', supports: 0, received: 'Hoy' }];
  const rootElement = { innerHTML: '', addEventListener() {} };
  const countElement = { textContent: '' };
  const notices = [];
  const host = { prepend: note => notices.push(note.textContent) };
  const noop = async () => [];
  const document = {
    querySelector(selector) {
      if (selector === '#admin-proposal-list') return rootElement;
      if (selector === '#proposal-admin-count') return countElement;
      if (selector === '.admin-main') return host;
      return null;
    },
    querySelectorAll: () => [],
    createElement: () => ({ className: '', textContent: '', remove() {} }),
  };
  const api = vm.runInNewContext(`${source};({renderAdminProposals,bindAdminProposals})`, {
    appMode, document, window: { prompt: () => '' }, setTimeout: () => 0,
    console: { error() {} }, escapeHtml: value => String(value ?? ''),
    adminContent: [], adminDocuments: [], adminProposals: demo, adminNotifications: [], auditEvents: [], adminSettings: {},
    listAdminContent: noop, saveAdminContent: noop, listAdminDocuments: noop, saveAdminDocument: noop,
    listAdminProposals, moderateProposal: noop, listAdminNotifications: noop, createAdminNotification: noop,
    listAuditEvents: noop, getAdminSettings: async () => ({}), saveAdminSettings: noop,
  });
  return { api, rootElement, countElement, notices };
}

test('modo Supabase nunca pinta propuestas demo y deja error persistente si falla la API', async () => {
  const page = await loadAdminPage({ appMode: 'supabase', listAdminProposals: async () => { throw new Error('PGRST201'); } });
  const initial = page.api.renderAdminProposals();
  assert.doesNotMatch(initial, /Propuesta demo visible/);
  assert.match(initial, /0 propuestas/);

  await page.api.bindAdminProposals();
  assert.match(page.rootElement.innerHTML, /role="alert"/);
  assert.match(page.rootElement.innerHTML, /Propuestas no disponibles/);
  assert.doesNotMatch(page.rootElement.innerHTML, /Propuesta demo visible/);
  assert.equal(page.countElement.textContent, 'Propuestas no disponibles');
  assert.deepEqual(page.notices, ['No se pudieron cargar las propuestas.']);
});

test('modo demo conserva las propuestas de demostración', async () => {
  const demoRows = [{ id: 'demo-1', title: 'Propuesta demo visible', author: 'Socio demo', status: 'En evaluación', supports: 0, received: 'Hoy' }];
  const page = await loadAdminPage({ appMode: 'demo', listAdminProposals: async () => demoRows });
  assert.match(page.api.renderAdminProposals(), /Propuesta demo visible/);
  await page.api.bindAdminProposals();
  assert.match(page.rootElement.innerHTML, /Propuesta demo visible/);
  assert.equal(page.countElement.textContent, '1 propuestas');
});

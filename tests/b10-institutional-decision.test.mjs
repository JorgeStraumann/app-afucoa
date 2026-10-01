import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const draft = await readFile(new URL('../docs/B10_INSTITUTIONAL_DECISION_DRAFT.md', import.meta.url), 'utf8');
const packet = await readFile(new URL('../docs/PROD_GO_NO_GO_PACKET.md', import.meta.url), 'utf8');

test('decisión B10 queda aprobada solo hasta dry-run y no autoriza usuarios ni apply', () => {
  assert.match(draft, /APPROVED — GO CON CONDICIONES, SOLO HASTA DRY-RUN/);
  assert.match(draft, /no reactiva Pilot 01 masivo/);
  assert.match(draft, /no autoriza un `--apply`/);
  assert.match(draft, /autorización separada/);
  assert.match(packet, /GO CON CONDICIONES — AUTORIZADO SOLO HASTA DRY-RUN/);
});

test('recomendación limita cohorte y exige dry-run sin conflictos', () => {
  assert.match(draft, /máxima de 5 socios/);
  assert.match(draft, /`5 ready`, `0 rejected`, `0 conflicts`/);
  assert.match(draft, /una sola ventana de alta/);
  assert.match(draft, /Criterios de aborto/);
});

test('I01 I02 I03 conservan condiciones pendientes antes de apply', () => {
  for (const token of ['I01', 'I02', 'I03', 'Aprobador negocio', 'Responsable privacidad/datos', 'Incident Commander']) {
    if (token === 'Aprobador negocio') assert.match(draft, /Aprobador\/solicitante/);
    else assert.match(draft, new RegExp(token));
  }
  assert.match(draft, /PENDING antes de `--apply`/);
  assert.match(draft, /Jorge, temporal/);
});

test('borrador no incorpora contactos, cédulas, credenciales ni secretos', () => {
  assert.doesNotMatch(draft, /sb_secret_[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(draft, /xkeysib-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(draft, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(draft, /\b[0-9]{8}\b/);
  assert.doesNotMatch(draft, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
});

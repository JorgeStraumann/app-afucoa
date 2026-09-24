import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('B10 permanece abierto y el paquete no autoriza personas reales ni Pilot 01', async () => {
  const [packet, readiness] = await Promise.all([
    read('docs/PROD_GO_NO_GO_PACKET.md'),
    read('docs/PRODUCTION_READINESS.md'),
  ]);

  assert.match(packet, /NO DECISION — B10 OPEN/);
  assert.match(packet, /NO-GO OPERATIVO \/ GO TÉCNICO/);
  assert.match(packet, /Pilot 01 permanece `PARKED`/);
  assert.match(packet, /autorización posterior, explícita y acotada/);
  assert.match(packet, /E01[\s\S]*PENDING RISK DECISION/);
  assert.match(packet, /E02[\s\S]*PENDING RISK DECISION/);
  assert.match(readiness, /B10 — \*\*OPEN\*\*/);
});

test('checklist separa gates técnicos cerrados de aprobaciones humanas pendientes', async () => {
  const checklist = await read('docs/PRODUCTION_CUTOVER_CHECKLIST.md');

  assert.match(checklist, /\[x\] \*\*B01 cerrado:/);
  assert.match(checklist, /\[x\] \*\*Mecanismo de piloto:/);
  assert.match(checklist, /\[ \] \*\*Soporte:/);
  assert.match(checklist, /\[ \] \*\*Datos reales:/);
  assert.match(checklist, /\[ \] \*\*Activación de cohorte real:/);
  assert.match(checklist, /\[ \] \*\*Decisión B10:/);
});

test('plantillas de soporte y datos siguen fail-closed mientras haya PENDING', async () => {
  const [support, data] = await Promise.all([
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
  ]);

  assert.match(support, /PENDING INSTITUTIONAL APPROVAL/);
  assert.match(support, /Mientras exista un campo `PENDING`, I01 y B10 permanecen abiertos/);
  assert.match(data, /PENDING POLICY\/LEGAL\/BUSINESS APPROVAL/);
  assert.match(data, /Mientras exista un campo `PENDING`, I02 y B10 permanecen abiertos/);
});

test('paquete documental no contiene material privilegiado literal', async () => {
  const docs = await Promise.all([
    read('docs/PROD_GO_NO_GO_PACKET.md'),
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
    read('docs/PRODUCTION_CUTOVER_CHECKLIST.md'),
  ]);
  const combined = docs.join('\n');

  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /xkeysib-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
});

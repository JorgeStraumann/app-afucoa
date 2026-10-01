import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('B10 autoriza apply solo para el batch exacto y mantiene Pilot 01 masivo bloqueado', async () => {
  const [packet, readiness] = await Promise.all([
    read('docs/PROD_GO_NO_GO_PACKET.md'),
    read('docs/PRODUCTION_READINESS.md'),
  ]);

  assert.match(packet, /GO CON CONDICIONES — APPLY AUTORIZADO PARA LOTE EXACTO/);
  assert.match(packet, /GO TÉCNICO \/ APPLY DEL LOTE EXACTO \/ AMPLIACIÓN NO AUTORIZADA/);
  assert.match(packet, /Pilot 01 masivo permanece `PARKED`/);
  assert.match(packet, /autorización posterior, explícita y acotada/);
  assert.match(packet, /E01[\s\S]*CLOSED — 112\/112, cleanup 0/);
  assert.match(packet, /E02[\s\S]*CLOSED — sin SLA inferido/);
  assert.match(readiness, /B10 — \*\*GO CON CONDICIONES\*\*/);
});

test('checklist registra gates técnicos y aprobación humana acotada al batch', async () => {
  const checklist = await read('docs/PRODUCTION_CUTOVER_CHECKLIST.md');

  assert.match(checklist, /\[x\] \*\*B01 cerrado:/);
  assert.match(checklist, /\[x\] \*\*Mecanismo de piloto:/);
  assert.match(checklist, /\[x\] \*\*Soporte para alta inicial:/);
  assert.match(checklist, /\[x\] \*\*Datos reales para alta inicial:/);
  assert.match(checklist, /\[x\] \*\*Activación de cohorte inicial:/);
  assert.match(checklist, /\[x\] \*\*Decisión B10:/);
});

test('plantillas de soporte y datos autorizan el lote exacto pero bloquean ampliación', async () => {
  const [support, data] = await Promise.all([
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
  ]);

  assert.match(support, /CONDITIONED — RESPONSABLES TEMPORALES ACTIVOS/);
  assert.match(support, /impiden ampliar la cohorte/);
  assert.match(data, /CONDITIONED — LOTE INICIAL DE 5 AUTORIZADO/);
  assert.match(data, /bloqueando cualquier ampliación/);
});

test('paquete documental no contiene material privilegiado literal', async () => {
  const docs = await Promise.all([
    read('docs/PROD_GO_NO_GO_PACKET.md'),
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
    read('docs/PRODUCTION_CUTOVER_CHECKLIST.md'),
    read('docs/PROD_SYNTHETIC_READINESS.md'),
  ]);
  const combined = docs.join('\n');

  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /xkeysib-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
});

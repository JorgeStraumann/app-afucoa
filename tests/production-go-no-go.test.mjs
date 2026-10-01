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
  assert.match(checklist, /\[x\] \*\*Provisionamiento técnico de cohorte inicial:/);
  assert.match(checklist, /\[x\] \*\*Seguimiento individual cerrado por decisión del responsable/);
  assert.match(checklist, /\[x\] \*\*Decisión B10:/);
});

test('plantillas de soporte y datos autorizan el lote exacto pero bloquean ampliación', async () => {
  const [support, data] = await Promise.all([
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
  ]);

  assert.match(support, /CONDITIONED — RESPONSABLES TEMPORALES ACTIVOS/);
  assert.match(support, /impiden ampliar la cohorte/);
  assert.match(data, /LOTE INICIAL EXACTO DE 5 APLICADO BAJO AUTORIZACIÓN B10/);
  assert.match(data, /no autoriza otros lotes, ampliación, purgas ni automatizaciones/);
  assert.match(data, /bloqueando cualquier ampliación/);
});

test('paquete documental no contiene material privilegiado literal', async () => {
  const docs = await Promise.all([
    read('docs/PROD_GO_NO_GO_PACKET.md'),
    read('docs/PRODUCTION_SUPPORT_MODEL.md'),
    read('docs/PRODUCTION_DATA_APPROVAL.md'),
    read('docs/PRODUCTION_CUTOVER_CHECKLIST.md'),
    read('docs/PROD_SYNTHETIC_READINESS.md'),
    read('docs/GUIA_PRIMER_ACCESO_SOCIOS.md'),
    read('docs/PROD_COHORT_ACTIVATION_TRACKER.md'),
  ]);
  const combined = docs.join('\n');

  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /xkeysib-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(combined, /\b\d{8}\b/);
  assert.doesNotMatch(combined, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.match(docs.at(-2), /https:\/\/afucoa-v2-prod\.pages\.dev/);
  assert.match(docs.at(-1), /No completar por persona/);
});

test('readiness vigente distingue el lote aplicado del cierre operativo de seguimiento individual', async () => {
  const [readiness, cohort, synthetic, tracker] = await Promise.all([
    read('docs/PRODUCTION_READINESS.md'),
    read('docs/PROD_COHORT_DRY_RUN.md'),
    read('docs/PROD_SYNTHETIC_READINESS.md'),
    read('docs/PROD_COHORT_ACTIVATION_TRACKER.md'),
  ]);

  assert.match(readiness, /B10 quedó en \*\*GO CON CONDICIONES para el lote exacto de cinco\*\*/);
  assert.match(cohort, /COHORTE INICIAL CREADA Y VERIFICADA/);
  assert.match(cohort, /El responsable decidió cerrar el seguimiento de confirmaciones directas adicionales/);
  assert.match(cohort, /evidencia sigue siendo 1\/5 primeros accesos informados personalmente y 0\/5 recuperaciones por email confirmadas/);
  assert.match(synthetic, /baseline posterior a la prueba sintética y anterior al batch real/);
  assert.match(tracker, /primer acceso confirmado personalmente \| 1\/5 confirmado/);
  assert.match(tracker, /recuperación confirmada por titular \| 0\/5 confirmada/);
});

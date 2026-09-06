import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const productionPipeline = Object.freeze({
  branch: 'afucoa-v2',
  projectRef: 'rywdochyzhgfaymrmxek',
  cloudflareProject: 'afucoa-v2-prod',
  canonicalOrigin: 'https://afucoa-v2-prod.pages.dev',
});

function invalid(message) {
  throw new Error(`Pipeline PROD inválido: ${message}`);
}

export function assertReleaseSha(value) {
  if (!/^[0-9a-f]{40}$/.test(String(value || ''))) {
    invalid('release_sha debe ser un SHA Git completo de 40 caracteres hexadecimales minúsculos.');
  }
  return value;
}

export function assertDeploymentId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))) {
    invalid('deployment_id debe ser un UUID v4 de Cloudflare.');
  }
  return String(value).toLowerCase();
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const candidate = path.join(directory, entry);
    if ((await stat(candidate)).isDirectory()) files.push(...await filesUnder(candidate));
    else files.push(candidate);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function portable(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export async function verifyProductionRelease({
  manifestPath,
  distDirectory,
  expectedReleaseSha,
  expectedProjectRef = productionPipeline.projectRef,
  expectedPublicBase = '/',
}) {
  const releaseSha = assertReleaseSha(expectedReleaseSha);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schemaVersion !== 1) invalid('schemaVersion del manifest no es 1.');
  if (manifest.gitSha !== releaseSha) invalid('el manifest no corresponde al release_sha solicitado.');
  if (manifest.projectRef !== expectedProjectRef) invalid('el manifest no corresponde a Supabase PROD.');
  if (manifest.publicBase !== expectedPublicBase) invalid('el manifest no usa la base pública PROD.');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) invalid('el manifest no contiene archivos.');

  const expected = new Map();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256 || '')) {
      invalid('una entrada de archivo del manifest es inválida.');
    }
    if (path.isAbsolute(file.path) || file.path.includes('..') || file.path.includes('\\')) {
      invalid('el manifest contiene una ruta no portable.');
    }
    if (expected.has(file.path)) invalid(`el manifest duplica ${file.path}.`);
    expected.set(file.path, file);
  }

  const actualFiles = await filesUnder(distDirectory);
  const actualPaths = actualFiles.map((file) => portable(distDirectory, file));
  if (actualPaths.length !== expected.size || actualPaths.some((file) => !expected.has(file))) {
    invalid('el árbol dist no coincide exactamente con el manifest.');
  }

  for (const file of actualFiles) {
    const relative = portable(distDirectory, file);
    const bytes = await readFile(file);
    const entry = expected.get(relative);
    if (bytes.length !== entry.bytes) invalid(`tamaño inesperado en ${relative}.`);
    if (sha256(bytes) !== entry.sha256) invalid(`SHA-256 inesperado en ${relative}.`);
  }

  return Object.freeze({
    releaseSha,
    manifestSha256: sha256(manifestBytes),
    fileCount: actualFiles.length,
    manifest,
  });
}

export function assertProductionDeployment(deployment, {
  expectedDeploymentId,
  expectedReleaseSha,
  expectedProject = productionPipeline.cloudflareProject,
  expectedBranch = productionPipeline.branch,
} = {}) {
  if (!deployment || typeof deployment !== 'object') invalid('Cloudflare no devolvió un deployment.');
  if (expectedDeploymentId && deployment.id !== assertDeploymentId(expectedDeploymentId)) {
    invalid('Cloudflare devolvió otro deployment_id.');
  }
  if (deployment.project_name && deployment.project_name !== expectedProject) {
    invalid('el deployment pertenece a otro proyecto Cloudflare Pages.');
  }
  if (deployment.environment !== 'production') invalid('el deployment no es production.');
  if (deployment.latest_stage?.status !== 'success') invalid('el deployment no terminó exitosamente.');
  const metadata = deployment.deployment_trigger?.metadata || {};
  if (metadata.branch !== expectedBranch) invalid('el deployment no pertenece a afucoa-v2.');
  if (expectedReleaseSha && metadata.commit_hash !== assertReleaseSha(expectedReleaseSha)) {
    invalid('el deployment no corresponde al release_sha esperado.');
  }
  if (typeof deployment.url !== 'string' || !/^https:\/\/[a-z0-9-]+\.afucoa-v2-prod\.pages\.dev$/i.test(deployment.url)) {
    invalid('el deployment no tiene una URL inmutable del proyecto esperado.');
  }
  return deployment;
}

export function publicDeploymentRecord(deployment) {
  const metadata = deployment.deployment_trigger?.metadata || {};
  return Object.freeze({
    deployment_id: deployment.id,
    environment: deployment.environment,
    project: deployment.project_name || productionPipeline.cloudflareProject,
    branch: metadata.branch,
    release_sha: metadata.commit_hash,
    url: deployment.url,
    created_on: deployment.created_on,
    modified_on: deployment.modified_on,
    status: deployment.latest_stage?.status,
  });
}

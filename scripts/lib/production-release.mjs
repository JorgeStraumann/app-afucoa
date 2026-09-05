import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    if ((await stat(fullPath)).isDirectory()) result.push(...await filesUnder(fullPath));
    else result.push(fullPath);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function portablePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export function readGitSha(repositoryRoot) {
  return execFileSync(
    'git',
    ['-c', `safe.directory=${repositoryRoot.split(path.sep).join('/')}`, 'rev-parse', 'HEAD'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).trim();
}

export function assertCleanGitWorktree(repositoryRoot) {
  const status = execFileSync(
    'git',
    ['-c', `safe.directory=${repositoryRoot.split(path.sep).join('/')}`, 'status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).trim();
  if (status) throw new Error('El release manifest exige un working tree limpio.');
}

async function hashTree(root, files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(portablePath(root, file));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function createProductionReleaseManifest({
  repositoryRoot,
  distDirectory,
  gitSha,
  createdAt,
  projectRef,
  publicBase,
}) {
  if (!/^[0-9a-f]{40}$/.test(gitSha)) throw new Error('El SHA de release debe tener 40 caracteres hexadecimales.');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('La fecha de release no es válida.');

  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const migrationManifestPath = path.join(repositoryRoot, 'supabase', 'migrations', 'MANIFEST.json');
  const functionsManifestPath = path.join(repositoryRoot, 'supabase', 'functions', 'PRODUCTION_FUNCTIONS.json');
  const securityPolicyPath = path.join(repositoryRoot, 'config', 'production-security-headers.json');
  const functionsManifest = JSON.parse(await readFile(functionsManifestPath, 'utf8'));

  const distFiles = await filesUnder(distDirectory);
  const files = await Promise.all(distFiles.map(async (file) => {
    const bytes = await readFile(file);
    return {
      path: portablePath(distDirectory, file),
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  }));

  const sharedFiles = await filesUnder(path.join(repositoryRoot, 'supabase', 'functions', '_shared'));
  const edgeFunctions = [];
  for (const name of functionsManifest.functions) {
    const functionFiles = await filesUnder(path.join(repositoryRoot, 'supabase', 'functions', name));
    const sourceFiles = [...sharedFiles, ...functionFiles].sort((a, b) => a.localeCompare(b));
    edgeFunctions.push({
      name,
      sourceVersion: `sha256:${await hashTree(repositoryRoot, sourceFiles)}`,
    });
  }

  return {
    schemaVersion: 1,
    gitSha,
    createdAt,
    packageVersion: packageJson.version,
    projectRef,
    publicBase,
    files,
    migrationManifest: {
      path: 'supabase/migrations/MANIFEST.json',
      sha256: sha256(await readFile(migrationManifestPath)),
    },
    securityHeadersPolicy: {
      path: 'config/production-security-headers.json',
      sha256: sha256(await readFile(securityPolicyPath)),
    },
    edgeFunctionsManifest: {
      path: 'supabase/functions/PRODUCTION_FUNCTIONS.json',
      sha256: sha256(await readFile(functionsManifestPath)),
    },
    edgeFunctions,
  };
}

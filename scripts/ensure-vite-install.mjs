#!/usr/bin/env node
// Verifies the installed Vite package is structurally complete before running
// `vite`. If Vite's CLI references an internal `./chunks/dep-*.js` file that
// does not exist on disk, we treat the install as corrupted and repair it by
// removing `node_modules/vite` and reinstalling from the lockfile.
//
// This guards against the recurring publish/preview failure:
//   ERR_MODULE_NOT_FOUND ... node_modules/vite/dist/node/chunks/dep-XXXX.js

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viteDir = join(projectRoot, 'node_modules', 'vite');
const cliPath = join(viteDir, 'dist', 'node', 'cli.js');

function log(msg) {
  console.log(`[ensure-vite] ${msg}`);
}

function detectMissingChunks() {
  if (!existsSync(cliPath)) {
    return { broken: true, reason: `missing ${cliPath}` };
  }
  const cli = readFileSync(cliPath, 'utf8');
  // Match all `./chunks/dep-*.js` imports referenced by the CLI bundle.
  const refs = [...cli.matchAll(/['"](\.\/chunks\/dep-[A-Za-z0-9_-]+\.js)['"]/g)].map(
    (m) => m[1],
  );
  for (const ref of refs) {
    const abs = join(viteDir, 'dist', 'node', ref);
    if (!existsSync(abs)) {
      return { broken: true, reason: `missing chunk ${ref}` };
    }
  }
  return { broken: false };
}

function reinstallVite() {
  log('removing node_modules/vite');
  try {
    rmSync(viteDir, { recursive: true, force: true });
  } catch (err) {
    log(`failed to remove vite dir: ${err?.message || err}`);
  }

  // Pick an installer: prefer bun (project pinned), fall back to npm.
  const tryRun = (cmd, args) => {
    log(`running: ${cmd} ${args.join(' ')}`);
    const r = spawnSync(cmd, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });
    return r.status === 0;
  };

  const ok =
    tryRun('bun', ['install']) ||
    tryRun('npm', ['install', '--no-audit', '--no-fund']);

  if (!ok) {
    log('reinstall failed with both bun and npm');
    return false;
  }
  return true;
}

function main() {
  const first = detectMissingChunks();
  if (!first.broken) return;

  log(`vite install looks corrupted (${first.reason}); repairing...`);
  const reinstalled = reinstallVite();
  if (!reinstalled) {
    console.error('[ensure-vite] reinstall failed; cannot continue');
    process.exit(1);
  }

  const second = detectMissingChunks();
  if (second.broken) {
    console.error(
      `[ensure-vite] vite is still incomplete after reinstall (${second.reason}). ` +
        'The published vite tarball appears broken in this environment. ' +
        'Try changing the pinned vite version in package.json.',
    );
    process.exit(1);
  }
  log('vite install repaired successfully');
}

main();

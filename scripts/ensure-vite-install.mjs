#!/usr/bin/env node
// Verifies that key build/runtime packages installed under node_modules are
// structurally complete before running `vite`. The Lovable sandbox sometimes
// ends up with packages whose `dist/` directory was partially removed or
// whose internal chunk files are missing, surfacing as confusing errors:
//   ERR_MODULE_NOT_FOUND ... node_modules/vite/dist/node/chunks/dep-XXXX.js
//   Failed to resolve entry for package "react-router"...
//
// If we detect a broken package, we repair it by removing it and reinstalling
// from the lockfile.

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(projectRoot, 'node_modules');

function log(msg) {
  console.log(`[ensure-deps] ${msg}`);
}

function checkVite() {
  const viteDir = join(nodeModules, 'vite');
  const cliPath = join(viteDir, 'dist', 'node', 'cli.js');
  if (!existsSync(cliPath)) {
    return { name: 'vite', broken: true, reason: `missing ${cliPath}` };
  }
  const cli = readFileSync(cliPath, 'utf8');
  const refs = [...cli.matchAll(/['"](\.\/chunks\/dep-[A-Za-z0-9_-]+\.js)['"]/g)].map(
    (m) => m[1],
  );
  for (const ref of refs) {
    const abs = join(viteDir, 'dist', 'node', ref);
    if (!existsSync(abs)) {
      return { name: 'vite', broken: true, reason: `missing chunk ${ref}` };
    }
  }
  return { name: 'vite', broken: false };
}

function checkPackageMain(name) {
  const pkgDir = join(nodeModules, name);
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return { name, broken: false, missing: true };
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  } catch (err) {
    return { name, broken: true, reason: `invalid package.json: ${err.message}` };
  }
  const candidates = new Set();
  for (const field of ['main', 'module', 'browser', 'types', 'unpkg']) {
    if (typeof pkg[field] === 'string') candidates.add(pkg[field]);
  }
  for (const c of candidates) {
    const abs = join(pkgDir, c);
    if (!existsSync(abs)) {
      return { name, broken: true, reason: `missing ${c}` };
    }
  }
  return { name, broken: false };
}

const checks = [
  checkVite,
  () => checkPackageMain('react-router'),
  () => checkPackageMain('react-router-dom'),
  () => checkPackageMain('@remix-run/router'),
  () => checkPackageMain('rollup'),
  () => checkPackageMain('esbuild'),
  () => checkPackageMain('@vitejs/plugin-react-swc'),
];

function detectBroken() {
  const broken = [];
  for (const c of checks) {
    const r = c();
    if (r?.broken) broken.push(r);
  }
  return broken;
}

function reinstall(brokenNames) {
  for (const name of brokenNames) {
    const dir = join(nodeModules, name);
    if (existsSync(dir)) {
      log(`removing node_modules/${name}`);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        log(`failed to remove ${name}: ${err?.message || err}`);
      }
    }
  }

  const tryRun = (cmd, args) => {
    log(`running: ${cmd} ${args.join(' ')}`);
    const r = spawnSync(cmd, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });
    return r.status === 0;
  };

  return (
    tryRun('bun', ['install']) ||
    tryRun('npm', ['install', '--no-audit', '--no-fund'])
  );
}

function main() {
  let broken = detectBroken();
  if (broken.length === 0) return;

  for (const b of broken) log(`broken: ${b.name} (${b.reason})`);
  if (!reinstall(broken.map((b) => b.name))) {
    console.error('[ensure-deps] reinstall command failed');
    process.exit(1);
  }

  broken = detectBroken();
  if (broken.length > 0) {
    for (const b of broken) console.error(`[ensure-deps] still broken: ${b.name} (${b.reason})`);
    console.error(
      '[ensure-deps] dependencies are still incomplete after reinstall. ' +
        'Try changing the pinned version of the offending package in package.json.',
    );
    process.exit(1);
  }
  log('dependencies repaired successfully');
}

main();

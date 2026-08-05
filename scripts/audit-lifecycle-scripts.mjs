import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const DEPENDENCY_HOOKS = ['preinstall', 'install', 'postinstall'];
const ROOT_HOOKS = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prebuild',
  'build',
  'postbuild',
];

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const root = resolve(option('--root', process.cwd()));
const policyPath = resolve(
  option('--policy', join(root, 'config', 'npm-lifecycle-policy.json')),
);
const packageJsonPath = join(root, 'package.json');
const lockfilePath = join(root, 'package-lock.json');
const nodeModulesPath = join(root, 'node_modules');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const policy = readJson(policyPath);
const rootPackage = readJson(packageJsonPath);
const lockfile = readJson(lockfilePath);
const failures = [];
const approvals = [];

if (policy.version !== 1) {
  failures.push(`unsupported policy version: ${policy.version}`);
}
if (lockfile.lockfileVersion !== 3 || !lockfile.packages) {
  failures.push('package-lock.json must use lockfileVersion 3 with packages metadata');
}
if (!existsSync(nodeModulesPath)) {
  failures.push('node_modules is missing; run npm ci --ignore-scripts first');
}

for (const hook of ROOT_HOOKS) {
  const expected = policy.rootLifecycleScripts?.[hook] ?? null;
  const actual = rootPackage.scripts?.[hook] ?? null;
  if (actual !== expected) {
    failures.push(
      `root script ${hook} changed: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`,
    );
  }
}

const approvedByKey = new Map();
for (const approval of policy.approvedDependencies ?? []) {
  const key = `${approval.name}@${approval.version}`;
  if (approvedByKey.has(key)) failures.push(`duplicate approval: ${key}`);
  approvedByKey.set(key, approval);
}

const installedApprovedKeys = new Set();
const visited = new Set();

function packageDirectories(nodeModules) {
  const directories = [];
  const entries = readdirSync(nodeModules, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    if (entry.name === '.bin' || entry.name === '.package-lock.json') continue;
    const entryPath = join(nodeModules, entry.name);
    if (entry.name.startsWith('@')) {
      if (!entry.isDirectory()) continue;
      for (const scopedEntry of readdirSync(entryPath, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name),
      )) {
        if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
          directories.push(join(entryPath, scopedEntry.name));
        }
      }
    } else if (entry.isDirectory() || entry.isSymbolicLink()) {
      directories.push(entryPath);
    }
  }

  return directories;
}

function inspectPackage(packageDirectory) {
  const realLocation = resolve(packageDirectory);
  if (visited.has(realLocation)) return;
  visited.add(realLocation);

  const relativeLocation = relative(root, realLocation).split(sep).join('/');
  const stats = lstatSync(packageDirectory);
  if (stats.isSymbolicLink()) {
    failures.push(`dependency package is a symbolic link: ${relativeLocation}`);
    return;
  }

  const manifestPath = join(realLocation, 'package.json');
  if (!existsSync(manifestPath)) {
    failures.push(`dependency is missing package.json: ${relativeLocation}`);
    return;
  }

  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    failures.push(`cannot parse ${relativeLocation}/package.json: ${error.message}`);
    return;
  }

  const key = `${manifest.name}@${manifest.version}`;
  const lockEntry = lockfile.packages?.[relativeLocation];
  if (!lockEntry) {
    failures.push(`${key} at ${relativeLocation} is not present in package-lock.json`);
  } else if (lockEntry.version !== manifest.version) {
    failures.push(
      `${key} at ${relativeLocation} does not match lockfile version ${lockEntry.version}`,
    );
  }

  const scripts = {};
  for (const hook of DEPENDENCY_HOOKS) {
    if (typeof manifest.scripts?.[hook] === 'string') scripts[hook] = manifest.scripts[hook];
  }

  if (
    !scripts.install &&
    manifest.gypfile !== false &&
    existsSync(join(realLocation, 'binding.gyp'))
  ) {
    scripts.install = 'node-gyp rebuild (implicit from binding.gyp)';
  }

  const declaredHooks = Object.keys(scripts).sort();
  if (declaredHooks.length > 0) {
    const approval = approvedByKey.get(key);
    if (!approval) {
      failures.push(
        `${key} at ${relativeLocation} declares unapproved lifecycle scripts: ${declaredHooks.join(', ')}`,
      );
    } else {
      installedApprovedKeys.add(key);
      const expectedScripts = approval.scripts ?? {};
      const allHooks = [...new Set([...declaredHooks, ...Object.keys(expectedScripts)])].sort();
      for (const hook of allHooks) {
        if (scripts[hook] !== expectedScripts[hook]) {
          failures.push(
            `${key} ${hook} changed: expected ${JSON.stringify(expectedScripts[hook])}, found ${JSON.stringify(scripts[hook])}`,
          );
        }
      }
      approvals.push({ key, location: relativeLocation, scripts, reason: approval.reason });
    }
  }

  if (lockEntry?.hasInstallScript && declaredHooks.length === 0) {
    failures.push(
      `${key} at ${relativeLocation} is marked hasInstallScript in the lockfile but no lifecycle script was found`,
    );
  }

  const nestedNodeModules = join(realLocation, 'node_modules');
  if (existsSync(nestedNodeModules)) inspectNodeModules(nestedNodeModules);
}

function inspectNodeModules(nodeModules) {
  for (const packageDirectory of packageDirectories(nodeModules)) {
    inspectPackage(packageDirectory);
  }
}

if (existsSync(nodeModulesPath)) inspectNodeModules(nodeModulesPath);

for (const key of [...approvedByKey.keys()].sort()) {
  if (!installedApprovedKeys.has(key)) {
    failures.push(`approved dependency ${key} is not installed with its reviewed scripts`);
  }
}

approvals.sort((a, b) => a.location.localeCompare(b.location));
for (const approval of approvals) {
  for (const hook of Object.keys(approval.scripts).sort()) {
    console.log(
      `[approved] ${approval.key} ${hook}=${JSON.stringify(approval.scripts[hook])} at ${approval.location}`,
    );
  }
  console.log(`[reason] ${approval.key}: ${approval.reason}`);
}

if (failures.length > 0) {
  for (const failure of failures.sort()) console.error(`[lifecycle-audit] ${failure}`);
  process.exit(1);
}

console.log(
  `[lifecycle-audit] passed: ${visited.size} installed dependencies; ${approvals.length} approved scripted package(s); no unexplained lifecycle scripts`,
);

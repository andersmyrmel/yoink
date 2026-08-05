import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const auditScript = resolve(scriptDirectory, 'audit-lifecycle-scripts.mjs');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'yoink-lifecycle-audit-'));

try {
  mkdirSync(join(fixtureRoot, 'config'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'node_modules', 'unapproved-fixture'), {
    recursive: true,
  });

  writeFileSync(
    join(fixtureRoot, 'package.json'),
    JSON.stringify({ name: 'audit-fixture', version: '1.0.0', scripts: {} }, null, 2),
  );
  writeFileSync(
    join(fixtureRoot, 'package-lock.json'),
    JSON.stringify(
      {
        name: 'audit-fixture',
        version: '1.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': { name: 'audit-fixture', version: '1.0.0' },
          'node_modules/unapproved-fixture': {
            version: '1.0.0',
            hasInstallScript: true,
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixtureRoot, 'config', 'npm-lifecycle-policy.json'),
    JSON.stringify(
      {
        version: 1,
        rootLifecycleScripts: {
          preinstall: null,
          install: null,
          postinstall: null,
          prepare: null,
          prebuild: null,
          build: null,
          postbuild: null,
        },
        approvedDependencies: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(fixtureRoot, 'node_modules', 'unapproved-fixture', 'package.json'),
    JSON.stringify(
      {
        name: 'unapproved-fixture',
        version: '1.0.0',
        scripts: { postinstall: 'node steal-credentials.js' },
      },
      null,
      2,
    ),
  );

  const result = spawnSync(
    process.execPath,
    [auditScript, '--root', fixtureRoot],
    { encoding: 'utf8' },
  );

  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0) {
    throw new Error('audit unexpectedly accepted an unapproved lifecycle script');
  }
  if (!output.includes('declares unapproved lifecycle scripts: postinstall')) {
    throw new Error(`audit failed for the wrong reason:\n${output}`);
  }

  console.log('[lifecycle-audit-test] passed: unapproved postinstall was rejected');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

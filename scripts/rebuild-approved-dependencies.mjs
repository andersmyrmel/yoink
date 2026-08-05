import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { arch, endianness, platform } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const policy = readJson(join(root, 'config', 'npm-lifecycle-policy.json'));

execFileSync(process.execPath, [resolve(root, 'scripts', 'check-toolchain.mjs')], {
  stdio: 'inherit',
});
execFileSync(process.execPath, [resolve(root, 'scripts', 'audit-lifecycle-scripts.mjs')], {
  stdio: 'inherit',
});

const platformPackages = {
  'aix ppc64 BE': '@esbuild/aix-ppc64',
  'android arm LE': '@esbuild/android-arm',
  'android arm64 LE': '@esbuild/android-arm64',
  'android x64 LE': '@esbuild/android-x64',
  'darwin arm64 LE': '@esbuild/darwin-arm64',
  'darwin x64 LE': '@esbuild/darwin-x64',
  'freebsd arm64 LE': '@esbuild/freebsd-arm64',
  'freebsd x64 LE': '@esbuild/freebsd-x64',
  'linux arm LE': '@esbuild/linux-arm',
  'linux arm64 LE': '@esbuild/linux-arm64',
  'linux ia32 LE': '@esbuild/linux-ia32',
  'linux loong64 LE': '@esbuild/linux-loong64',
  'linux mips64el LE': '@esbuild/linux-mips64el',
  'linux ppc64 LE': '@esbuild/linux-ppc64',
  'linux riscv64 LE': '@esbuild/linux-riscv64',
  'linux s390x BE': '@esbuild/linux-s390x',
  'linux x64 LE': '@esbuild/linux-x64',
  'netbsd arm64 LE': '@esbuild/netbsd-arm64',
  'netbsd x64 LE': '@esbuild/netbsd-x64',
  'openbsd arm64 LE': '@esbuild/openbsd-arm64',
  'openbsd x64 LE': '@esbuild/openbsd-x64',
  'openharmony arm64 LE': '@esbuild/openharmony-arm64',
  'sunos x64 LE': '@esbuild/sunos-x64',
  'win32 arm64 LE': '@esbuild/win32-arm64',
  'win32 ia32 LE': '@esbuild/win32-ia32',
  'win32 x64 LE': '@esbuild/win32-x64',
};

const sensitiveEnvironmentName =
  /(?:token|secret|password|credential|private.?key|api.?key|auth|database_url)/i;
const cleanEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !sensitiveEnvironmentName.test(name)),
);
Object.assign(cleanEnvironment, {
  NPM_CONFIG_USERCONFIG: '/dev/null',
  NPM_CONFIG_AUDIT: 'false',
  NPM_CONFIG_FUND: 'false',
  NPM_CONFIG_OFFLINE: 'true',
  ESBUILD_BINARY_PATH: '',
});

for (const approval of policy.approvedDependencies ?? []) {
  const key = `${approval.name}@${approval.version}`;
  const packageDirectory = join(root, 'node_modules', ...approval.name.split('/'));
  const manifestPath = join(packageDirectory, 'package.json');
  if (!existsSync(manifestPath)) throw new Error(`${key} is not installed`);

  const installed = readJson(manifestPath);
  if (installed.name !== approval.name || installed.version !== approval.version) {
    throw new Error(
      `${key} approval does not match installed ${installed.name}@${installed.version}`,
    );
  }

  if (key !== 'esbuild@0.26.0') {
    throw new Error(`${key} has no reviewed targeted rebuild implementation`);
  }

  const platformKey = `${platform()} ${arch()} ${endianness()}`;
  const platformPackage = platformPackages[platformKey];
  if (!platformPackage) throw new Error(`unsupported esbuild platform: ${platformKey}`);

  const platformDirectory = join(root, 'node_modules', ...platformPackage.split('/'));
  const platformManifest = readJson(join(platformDirectory, 'package.json'));
  if (
    platformManifest.name !== platformPackage ||
    platformManifest.version !== approval.version
  ) {
    throw new Error(
      `expected ${platformPackage}@${approval.version}; found ${platformManifest.name}@${platformManifest.version}`,
    );
  }

  const binaryPath = join(
    platformDirectory,
    platform() === 'win32' ? 'esbuild.exe' : 'bin',
    ...(platform() === 'win32' ? [] : ['esbuild']),
  );
  if (!existsSync(binaryPath)) {
    throw new Error(
      `${platformPackage}@${approval.version} is missing ${binaryPath}; refusing the installer's network fallback`,
    );
  }

  console.log(`[rebuild] rebuilding only ${key} with npm offline`);
  execFileSync(
    'npm',
    [
      'rebuild',
      approval.name,
      '--ignore-scripts=false',
      '--offline',
      '--no-audit',
      '--no-fund',
      '--foreground-scripts',
    ],
    { cwd: root, env: cleanEnvironment, stdio: 'inherit' },
  );

  const version = execFileSync(join(packageDirectory, 'bin', 'esbuild'), ['--version'], {
    encoding: 'utf8',
    env: cleanEnvironment,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
  if (version !== approval.version) {
    throw new Error(`rebuilt esbuild reported ${version}; expected ${approval.version}`);
  }
  console.log(`[rebuild] ${key} binary reports ${version}`);
}

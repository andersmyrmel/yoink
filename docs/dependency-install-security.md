# Dependency installation security

This repository pins Node.js 24.19.0 and npm 11.17.0. npm dependency lifecycle
scripts are disabled by default in `.npmrc`.

Use this sequence for every clean dependency installation:

```bash
node scripts/check-toolchain.mjs
npm ci --ignore-scripts --no-audit --no-fund
node scripts/audit-lifecycle-scripts.mjs
node scripts/rebuild-approved-dependencies.mjs
node scripts/audit-lifecycle-scripts.mjs
```

`npm run deps:safe-install` runs the same sequence for local development. Do not
replace `npm ci` with `npm install`, and never run an untargeted `npm rebuild`.

The committed policy is `config/npm-lifecycle-policy.json`. An approval must pin
the exact package name, version, lifecycle hook, command, and review rationale.
The audit reads installed `package.json` files as data; it does not import or
execute dependency code. It also detects npm's implicit `node-gyp rebuild` hook
when a dependency contains `binding.gyp`.

## Approved dependency lifecycle scripts

`esbuild@0.26.0` declares `postinstall: node install.js`. The installer is needed
to select, link, and validate the platform-specific esbuild binary. Its source
contains conditional npm and HTTPS fallback downloads and child-process calls.
The rebuild wrapper prevents those fallback paths by requiring the matching
lockfile-installed `@esbuild/*@0.26.0` package and binary before execution,
removing credential-bearing environment variables, forcing npm offline, and
running only `npm rebuild esbuild`. The normal reviewed path links the local
binary and executes it with `--version`.

Root `preinstall`, `install`, `postinstall`, `prepare`, `prebuild`, and
`postbuild` are intentionally absent. Root `build` is explicitly reviewed as
`npm run compile && npm run bundle && npm run copy-assets`; it compiles local
TypeScript, bundles the extension, and copies repository assets into `dist/`.

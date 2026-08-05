import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_NODE = '24.19.0';
const EXPECTED_NPM = '11.17.0';

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
);

const configuredNode = packageJson.engines?.node;
const configuredNpm = packageJson.engines?.npm;
const configuredPackageManager = packageJson.packageManager;
const actualNode = process.versions.node;
const actualNpm = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
}).trim();

const errors = [];

if (configuredNode !== EXPECTED_NODE) {
  errors.push(`package.json engines.node must be ${EXPECTED_NODE}`);
}
if (configuredNpm !== EXPECTED_NPM) {
  errors.push(`package.json engines.npm must be ${EXPECTED_NPM}`);
}
if (configuredPackageManager !== `npm@${EXPECTED_NPM}`) {
  errors.push(`package.json packageManager must be npm@${EXPECTED_NPM}`);
}
if (actualNode !== EXPECTED_NODE) {
  errors.push(`Node.js ${EXPECTED_NODE} is required; found ${actualNode}`);
}
if (actualNpm !== EXPECTED_NPM) {
  errors.push(`npm ${EXPECTED_NPM} is required; found ${actualNpm}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[toolchain] ${error}`);
  process.exit(1);
}

console.log(`[toolchain] Node.js ${actualNode}; npm ${actualNpm}`);

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const version = read('package.json').version;
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(process.env.RELEASE_TAG || `v${version}`, `v${version}`, 'Release tag must match the package version');
assert.equal(read('package-lock.json').version, version);
assert.equal(read('package-lock.json').packages[''].version, version);
assert.equal(read('src/manifest.chrome.json').version, version);
assert.equal(read('src/manifest.firefox.json').version, version);
assert.ok(read('src/manifest.chrome.json').key, 'A stable public signing key is required');
if (process.argv.includes('--built')) {
  assert.deepEqual(read('dist/manifest.json'), read('src/manifest.chrome.json'));
}
console.log(`Release version verified: ${version}`);

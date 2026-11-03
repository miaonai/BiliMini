const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { createHash, createPublicKey, verify } = require('node:crypto');
const path = require('node:path');

// Read the length-delimited fields in Chromium's CRX3 header/proof messages.
// https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto
function fields(buffer) {
  let offset = 0;
  const result = new Map();
  function varint() {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      assert.ok(offset < buffer.length && shift < 35, 'Invalid CRX protobuf varint');
      byte = buffer[offset++];
      value += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128);
    return value;
  }
  while (offset < buffer.length) {
    const tag = varint();
    assert.equal(tag % 8, 2, 'Unsupported CRX protobuf field');
    const length = varint();
    assert.ok(offset + length <= buffer.length, 'Truncated CRX protobuf field');
    const number = Math.floor(tag / 8);
    result.set(number, [...(result.get(number) || []), buffer.subarray(offset, offset + length)]);
    offset += length;
  }
  return result;
}

const crx = readFileSync('dist.crx');
assert.equal(crx.subarray(0, 4).toString(), 'Cr24');
assert.equal(crx.readUInt32LE(4), 3, 'Expected CRX3');
const zipOffset = 12 + crx.readUInt32LE(8);
assert.ok(zipOffset < crx.length);
const header = fields(crx.subarray(12, zipOffset));
const signedHeader = header.get(10000)?.[0];
assert.ok(signedHeader, 'Missing signed CRX header');
const zip = crx.subarray(zipOffset);
assert.equal(zip.readUInt32LE(0), 0x04034b50, 'Missing ZIP payload');
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const publicKey = Buffer.from(manifest.key, 'base64');
const proof = (header.get(2) || []).map(fields).find(value => value.get(1)?.[0].equals(publicKey));
assert.ok(proof, 'CRX signing key must match the manifest key');
const length = Buffer.alloc(4);
length.writeUInt32LE(signedHeader.length);
const signedData = Buffer.concat([Buffer.from('CRX3 SignedData\0'), length, signedHeader, zip]);
assert.ok(verify('sha256', signedData, createPublicKey({ key: publicKey, type: 'spki', format: 'der' }), proof.get(2)[0]), 'Invalid CRX signature');
const idBytes = createHash('sha256').update(publicKey).digest().subarray(0, 16);
assert.deepEqual(fields(signedHeader).get(1)[0], idBytes, 'CRX extension ID must match the signing key');

const base = `BiliMini-v${manifest.version}-chrome`;
mkdirSync('release', { recursive: true });
const assets = [[`${base}.crx`, crx], [`${base}.zip`, zip]];
for (const [name, contents] of assets) writeFileSync(path.join('release', name), contents);
writeFileSync('release/SHA256SUMS.txt', assets.map(([name, contents]) => `${createHash('sha256').update(contents).digest('hex')}  ${name}\n`).join(''));
const extensionId = [...idBytes.toString('hex')].map(char => String.fromCharCode(97 + parseInt(char, 16))).join('');
console.log(`Verified CRX3 signature and matching ZIP payload. Extension ID: ${extensionId}`);

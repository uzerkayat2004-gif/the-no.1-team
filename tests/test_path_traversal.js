const path = require('path');
const os = require('os');
const assert = require('assert');

// Mock getSafePath function to test it explicitly
function getSafePath(base, relativePath) {
  const resolvedPath = path.resolve(base, relativePath)
  const rel = path.relative(base, resolvedPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path traversal detected')
  }
  return resolvedPath
}

const base = path.join(os.homedir(), 'no1team', 'brain');

console.log('Testing legitimate path...');
const safePath = getSafePath(base, 'skills/skill1.md');
assert.strictEqual(safePath, path.resolve(base, 'skills/skill1.md'));
console.log('Legitimate path test passed.');

console.log('Testing relative path traversal...');
assert.throws(() => {
  getSafePath(base, '../etc/passwd');
}, /Path traversal detected/);
console.log('Relative path traversal blocked correctly.');

console.log('Testing absolute path traversal...');
assert.throws(() => {
  getSafePath(base, '/etc/passwd');
}, /Path traversal detected/);
console.log('Absolute path traversal blocked correctly.');

console.log('All tests passed.');

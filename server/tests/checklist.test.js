'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createChecklist, toggleItem, loadList } = require('../src/modules/checklist/store');
const deities = require('../data/deities.json');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-')), 'checklists.json');
}

test('createChecklist: builds items from deity offerings + rituals', () => {
  const file = tmpFile();
  const deity = deities.find((d) => d.id === 'tudigong');
  const c = createChecklist({ userIdHash: 'h', deity }, file);
  assert.equal(c.deityId, 'tudigong');
  assert.ok(c.items.length >= deity.common_offerings.length);
  assert.ok(c.items.every((it) => it.checked === false));
  assert.deepEqual(loadList(file).length, 1);
});

test('createChecklist: unknown deity throws 404', () => {
  assert.throws(() => createChecklist({ deity: null }, tmpFile()), (err) => err.status === 404);
});

test('toggleItem: flips checked and persists', () => {
  const file = tmpFile();
  const deity = deities.find((d) => d.id === 'tudigong');
  const c = createChecklist({ deity }, file);
  const updated = toggleItem(c.id, c.items[0].id, true, file);
  assert.equal(updated.items[0].checked, true);
  assert.equal(loadList(file)[0].items[0].checked, true);
});

test('loadList: tolerates UTF-8 BOM (PowerShell Set-Content writes one)', () => {
  const file = tmpFile();
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('[]')]));
  assert.deepEqual(loadList(file), []);
});

test('toggleItem: bad input throws', () => {
  const file = tmpFile();
  const deity = deities.find((d) => d.id === 'tudigong');
  const c = createChecklist({ deity }, file);
  assert.throws(() => toggleItem(c.id, c.items[0].id, 'yes', file), (err) => err.status === 400);
  assert.throws(() => toggleItem('nope', c.items[0].id, true, file), (err) => err.status === 404);
  assert.throws(() => toggleItem(c.id, 'nope', true, file), (err) => err.status === 404);
});

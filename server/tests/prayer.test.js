'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handlePrayer, buildPrayer } = require('../src/modules/prayer/generator');
const deities = require('../data/deities.json');

test('buildPrayer: mandarin contains name + deity + topic', () => {
  const deity = deities.find((d) => d.id === 'tudigong');
  const t = buildPrayer({ name: '王小明', topic: '求財', lang: 'mandarin', deity });
  assert.ok(t.includes('王小明'));
  assert.ok(t.includes('土地公'));
  assert.ok(t.includes('求財'));
});

test('buildPrayer: taiwanese variant differs', () => {
  const deity = deities.find((d) => d.id === 'tudigong');
  const a = buildPrayer({ name: '王小明', topic: '平安', lang: 'mandarin', deity });
  const b = buildPrayer({ name: '王小明', topic: '平安', lang: 'taiwanese', deity });
  assert.notEqual(a, b);
  assert.ok(b.includes('保庇'));
});

test('handlePrayer: mock path returns metadata', async () => {
  const r = await handlePrayer(
    { name: '陳大文', topic: '事業', lang: 'taiwanese', deityId: 'guandi' },
    { deities, demoMode: true, llmApiKey: '' },
  );
  assert.equal(r.topic, '事業');
  assert.equal(r.lang, 'taiwanese');
  assert.equal(r.deity.id, 'guandi');
  assert.equal(r.llmStatus, 'mock');
  assert.ok(r.prayer.includes('陳大文'));
});

test('handlePrayer: empty name throws 400, bad topic/lang defaulted', async () => {
  await assert.rejects(handlePrayer({ name: '  ' }, { deities }), (e) => e.status === 400);
  const r = await handlePrayer({ name: 'A', topic: 'bogus', lang: 'bogus' }, { deities });
  assert.equal(r.topic, '綜合');
  assert.equal(r.lang, 'mandarin');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectIntent } = require('../src/modules/chat/intent');
const { handleChat } = require('../src/modules/chat/service');
const deities = require('../data/deities.json');

test('detectIntent: keyword mapping + explicit override', () => {
  assert.equal(detectIntent('我想求財運'), '求財');
  assert.equal(detectIntent('工作升遷怎麼辦'), '事業');
  assert.equal(detectIntent('家人健康平安'), '平安');
  assert.equal(detectIntent('隨便聊聊'), '綜合');
  assert.equal(detectIntent('我想求財', '平安'), '平安');
  assert.equal(detectIntent('hi', 'bogus'), '綜合');
});

test('handleChat: mock reply cites knowledge + disclaimer + draft', async () => {
  const r = await handleChat(
    { message: '想求財', deityId: 'tudigong' },
    { deities, demoMode: true, llmApiKey: '' },
  );
  assert.equal(r.intent, '求財');
  assert.equal(r.deity.id, 'tudigong');
  assert.equal(r.llmStatus, 'mock');
  assert.ok(r.reply.includes('土地公'));
  assert.ok(r.reply.includes('不同地區'));
  assert.ok(r.sourceNotes.length > 0);
  assert.ok(r.checklistDraft.offerings.length > 0);
  assert.ok(r.checklistDraft.guide.length > 0);
  assert.ok(r.checklistDraft.guide[0].step === 1);
  assert.deepEqual(r.quickReplies, ['求財', '事業', '平安', '綜合']);
});

test('handleChat: empty message throws 400', async () => {
  await assert.rejects(
    handleChat({ message: '  ' }, { deities }),
    (err) => err.status === 400,
  );
});

test('handleChat: falls back to mock when LLM unreachable', async () => {
  const r = await handleChat(
    { message: '事業運如何' },
    { deities, demoMode: false, llmApiKey: 'sk-invalid', llmModel: 'gpt-4o-mini' },
  );
  assert.equal(r.llmStatus, 'mock');
  assert.ok(r.reply.length > 0);
});

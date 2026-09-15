'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyLineSignature, signForTest } = require('../src/middleware/lineSignature');
const { routeLineEvent } = require('../src/modules/line/webhook');
const { buildFestivalFlex, DISCLAIMER } = require('../src/modules/line/flex');
const deities = require('../data/deities.json');
const events = require('../data/events.json');

test('verifyLineSignature: valid signature passes, wrong fails', () => {
  const raw = Buffer.from('{"events":[]}');
  const sig = signForTest(raw, 'secret123');
  assert.equal(verifyLineSignature(raw, 'secret123', sig), true);
  assert.equal(verifyLineSignature(raw, 'secret123', 'bogus'), false);
  assert.equal(verifyLineSignature(raw, '', sig), false);
});

test('routeLineEvent: follow returns welcome', () => {
  const [r] = routeLineEvent({ type: 'follow' }, { deities, events });
  assert.equal(r.action, 'reply');
});

test('routeLineEvent: 攻略 text returns flex + quickReply', () => {
  const [r] = routeLineEvent(
    { type: 'message', message: { type: 'text', text: '開始祭拜攻略' } },
    { deities, events }
  );
  assert.equal(r.action, 'reply');
  assert.equal(r.messages[0].type, 'flex');
  assert.ok(r.messages[1].quickReply.items.length === 4);
});

test('buildFestivalFlex: contains disclaimer and miniapp buttons', () => {
  const msg = buildFestivalFlex(deities[0], events[0], 'https://x/miniapp/index.html');
  const body = JSON.stringify(msg.contents);
  assert.ok(body.includes(DISCLAIMER.slice(0, 6)));
  assert.ok(body.includes('map.html'));
});

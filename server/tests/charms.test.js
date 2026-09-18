'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectCharm, redeemCharm, listByUser } = require('../src/modules/charms/store');
const places = require('../data/places.json');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'am-')), 'amulets.json');
}

const partnerShop = places.find((p) => p.is_partner && p.type !== 'temple');
// Compatibility fixture: the current UI no longer displays amulets, but the
// legacy API remains covered for existing clients.
const partnerTemple = { ...places.find((p) => p.type === 'temple'), is_partner: true };
const plainPlace = places.find((p) => !p.is_partner);

test('collectCharm: partner shop issues a held charm', () => {
  const file = tmpFile();
  const c = collectCharm({ userIdHash: 'u1', place: partnerShop }, file);
  assert.equal(c.status, 'held');
  assert.equal(c.fromPlaceId, partnerShop.id);
  assert.equal(listByUser('u1', file).length, 1);
  assert.equal(listByUser('other', file).length, 0);
});

test('collectCharm: non-partner or missing place rejected', () => {
  const file = tmpFile();
  assert.throws(() => collectCharm({ place: plainPlace }, file), (e) => e.status === 400);
  assert.throws(() => collectCharm({ place: null }, file), (e) => e.status === 404);
});

test('redeemCharm: partner temple redeems, double-redeem 409', () => {
  const file = tmpFile();
  const c = collectCharm({ userIdHash: 'u1', place: partnerShop }, file);
  const r = redeemCharm({ charmId: c.id, userIdHash: 'u1', temple: partnerTemple }, file);
  assert.equal(r.status, 'redeemed');
  assert.equal(r.redeemedAtPlaceId, partnerTemple.id);
  assert.throws(
    () => redeemCharm({ charmId: c.id, userIdHash: 'u1', temple: partnerTemple }, file),
    (e) => e.status === 409,
  );
});

test('redeemCharm: non-temple / non-partner / wrong user rejected', () => {
  const file = tmpFile();
  const c = collectCharm({ userIdHash: 'u1', place: partnerShop }, file);
  assert.throws(() => redeemCharm({ charmId: c.id, temple: partnerShop }, file), (e) => e.status === 400);
  assert.throws(() => redeemCharm({ charmId: c.id, temple: plainPlace }, file), (e) => e.status === 400);
  assert.throws(
    () => redeemCharm({ charmId: c.id, userIdHash: 'u2', temple: partnerTemple }, file),
    (e) => e.status === 403,
  );
  assert.throws(() => redeemCharm({ charmId: 'nope', temple: partnerTemple }, file), (e) => e.status === 404);
});

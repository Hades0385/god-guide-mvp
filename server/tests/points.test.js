'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  earnPoints, redeemReward, balanceOf, couponsOf, AMULET_COST, COUPON_COST,
} = require('../src/modules/points/store');
const places = require('../data/places.json');

function tmpFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pts-'));
  return {
    pointsFile: path.join(dir, 'points.json'),
    couponsFile: path.join(dir, 'coupons.json'),
    charmsFile: path.join(dir, 'amulets.json'),
  };
}

const shop = places.find((p) => p.is_partner && p.type === 'offering_shop');
const temple = places.find((p) => p.is_partner && p.type === 'temple');
const nonPartner = places.find((p) => !p.is_partner);

test('earnPoints: retail spend earns NT$/10, temple rejected', () => {
  const files = tmpFiles();
  const r = earnPoints({ userIdHash: 'u', place: shop, amountNt: 299 }, files);
  assert.equal(r.entry.delta, 29);
  assert.equal(r.balance, 29);
  assert.equal(balanceOf('u', files.pointsFile), 29);
  assert.throws(() => earnPoints({ place: temple, amountNt: 100 }, files), (e) => e.status === 400);
  assert.throws(() => earnPoints({ place: nonPartner, amountNt: 100 }, files), (e) => e.status === 400);
});

test('redeemReward: coupon deducts and issues code', () => {
  const files = tmpFiles();
  earnPoints({ userIdHash: 'u', place: shop, amountNt: 500 }, files); // 50 pts
  const r = redeemReward({ userIdHash: 'u', kind: 'coupon', place: shop }, files);
  assert.equal(r.cost, COUPON_COST);
  assert.equal(r.balance, 50 - COUPON_COST);
  assert.ok(r.reward.code);
  assert.equal(couponsOf('u', files.couponsFile).length, 1);
});

test('redeemReward: amulet creates redeemed charm, insufficient 400', () => {
  const files = tmpFiles();
  assert.throws(
    () => redeemReward({ userIdHash: 'u', kind: 'amulet', place: temple }, files),
    (e) => e.status === 400 && /insufficient/.test(e.message),
  );
  earnPoints({ userIdHash: 'u', place: shop, amountNt: 600 }, files); // 60 pts
  const r = redeemReward({ userIdHash: 'u', kind: 'amulet', place: temple }, files);
  assert.equal(r.cost, AMULET_COST);
  assert.equal(r.reward.status, 'redeemed');
  assert.equal(r.reward.redeemedAtPlaceId, temple.id);
  assert.equal(r.balance, 60 - AMULET_COST);
});

test('redeemReward: wrong kind/place rejected', () => {
  const files = tmpFiles();
  earnPoints({ userIdHash: 'u', place: shop, amountNt: 1000 }, files);
  assert.throws(() => redeemReward({ userIdHash: 'u', kind: 'bogus', place: shop }, files), (e) => e.status === 400);
  assert.throws(() => redeemReward({ userIdHash: 'u', kind: 'amulet', place: shop }, files), (e) => e.status === 400);
  assert.throws(() => redeemReward({ userIdHash: 'u', kind: 'coupon', place: temple }, files), (e) => e.status === 400);
});

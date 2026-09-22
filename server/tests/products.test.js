'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadStore } = require('../src/utils/store');

const store = loadStore();

test('products seed: every offering in knowledge base has a seller', () => {
  const labels = new Set();
  for (const d of store.deities) for (const o of d.common_offerings || []) labels.add(o);
  for (const label of labels) {
    const sellers = store.products.filter((p) => (p.offerings || []).includes(label));
    assert.ok(sellers.length > 0, `no seller for offering ${label}`);
  }
});

test('products seed: every offering has a PARTNER seller (earn/points flow)', () => {
  const partnerIds = new Set(store.places.filter((p) => p.is_partner).map((p) => p.id));
  const labels = new Set();
  for (const d of store.deities) for (const o of d.common_offerings || []) labels.add(o);
  for (const label of labels) {
    const sellers = store.products.filter(
      (p) => (p.offerings || []).includes(label) && partnerIds.has(p.shopId),
    );
    if (label !== '金紙') assert.ok(sellers.length > 0, `no partner seller for offering ${label}`);
  }
});

test('sets seed: every set resolves to a shop and lists contents', () => {
  const ids = new Set(store.places.map((p) => p.id));
  assert.ok(store.sets.length > 0);
  for (const s of store.sets) {
    assert.ok(ids.has(s.shopId), `orphan set ${s.id}`);
    assert.ok(s.price > 0, `bad price ${s.id}`);
    assert.ok(Array.isArray(s.contents) && s.contents.length > 0, `empty contents ${s.id}`);
  }
});

test('products seed: all shopIds resolve to demo shops, never unverified real sellers', () => {
  const ids = new Set(store.places.map((p) => p.id));
  for (const pr of store.products) {
    assert.ok(ids.has(pr.shopId), `orphan product ${pr.id}`);
    assert.ok(pr.price > 0, `bad price ${pr.id}`);
    assert.equal(store.places.find(p => p.id === pr.shopId).is_demo, true);
  }
});

test('demo offerings resolve only to the demo store', () => {
  const sellerIds = new Set(
    store.products.filter((pr) => (pr.offerings || []).includes('鮮花')).map((pr) => pr.shopId),
  );
  const pool = store.places.filter((p) => p.type !== 'temple' && sellerIds.has(p.id));
  assert.deepEqual(pool.map((p) => p.id).sort(), ['demo-store']);
  assert.ok(pool.length >= 1);
  assert.ok(pool.every((p) => p.type !== 'temple'));
});

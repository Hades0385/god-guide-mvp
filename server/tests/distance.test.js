'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateDistance,
  findNearbyPlaces,
  sortNearbyPlaces,
  parseCoordParam,
} = require('../src/utils/distance');

test('parseCoordParam: missing/invalid -> NaN, never 0', () => {
  assert.ok(Number.isNaN(parseCoordParam(null)));
  assert.ok(Number.isNaN(parseCoordParam('')));
  assert.ok(Number.isNaN(parseCoordParam('abc')));
  assert.equal(parseCoordParam('25.033'), 25.033);
  assert.equal(parseCoordParam('0'), 0);
});

test('calculateDistance: Taipei 101 to nearby point is small', () => {
  const d = calculateDistance(25.033, 121.5654, 25.0335, 121.565);
  assert.ok(d > 0 && d < 0.5, `expected <0.5km, got ${d}`);
});

test('calculateDistance: throws on non-numbers', () => {
  assert.throws(() => calculateDistance('a', 0, 0, 0), TypeError);
});

test('findNearbyPlaces: filters outside 3km radius', () => {
  const places = [
    { id: 'near', latitude: 25.0335, longitude: 121.565, is_partner: false, tags: [] },
    { id: 'far', latitude: 25.1, longitude: 121.6, is_partner: false, tags: [] },
  ];
  const found = findNearbyPlaces(25.033, 121.5654, places, 3);
  assert.deepEqual(found.map((p) => p.id), ['near']);
});

test('sortNearbyPlaces: partner > distance > intent', () => {
  const places = [
    { id: 'far-partner', distanceKm: 2, is_partner: true, tags: [] },
    { id: 'near-plain', distanceKm: 0.1, is_partner: false, tags: [] },
    { id: 'near-intent', distanceKm: 0.2, is_partner: false, tags: ['求財'] },
    { id: 'near-no-intent', distanceKm: 0.2, is_partner: false, tags: [] },
  ];
  const sorted = sortNearbyPlaces(places, '求財').map((p) => p.id);
  assert.deepEqual(sorted, ['far-partner', 'near-plain', 'near-intent', 'near-no-intent']);
});

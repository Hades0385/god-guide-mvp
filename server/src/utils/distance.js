'use strict';

// Shared Haversine logic. Keep in sync with app/assets/js/distance.js.
// Sort rule: partner > distance > prayer_intent (see plan.md:9, AGENTS.md).

const EARTH_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Parse a lat/lng query param. Missing/invalid -> NaN (never 0:
// Number(null) === 0 would silently search near (0,0) off Africa).
function parseCoordParam(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  for (const v of [lat1, lng1, lat2, lng2]) {
    if (typeof v !== 'number' || Number.isNaN(v)) throw new TypeError('lat/lng must be numbers');
  }
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

function intentMatchesPlace(place, intent) {
  if (!intent) return false;
  const tags = Array.isArray(place.tags) ? place.tags : [];
  return tags.includes(intent);
}

function findNearbyPlaces(userLat, userLng, places, radiusKm = 3) {
  if (typeof userLat !== 'number' || typeof userLng !== 'number') {
    throw new TypeError('userLat/userLng must be numbers');
  }
  return places
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map((p) => ({
      ...p,
      distanceKm: calculateDistance(userLat, userLng, p.latitude, p.longitude),
    }))
    .filter((p) => p.distanceKm <= radiusKm);
}

function sortNearbyPlaces(places, intent) {
  return [...places].sort((a, b) => {
    const pa = a.is_partner ? 0 : 1;
    const pb = b.is_partner ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const ia = intentMatchesPlace(a, intent) ? 0 : 1;
    const ib = intentMatchesPlace(b, intent) ? 0 : 1;
    return ia - ib;
  });
}

module.exports = { calculateDistance, findNearbyPlaces, sortNearbyPlaces, parseCoordParam };

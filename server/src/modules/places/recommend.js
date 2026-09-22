'use strict';

function enrichPlace(place, deities, intent = '') {
  const worshipped = (place.deity_ids || []).map(id => deities.find(d => d.id === id)).filter(Boolean);
  const matched = worshipped.filter(d => (d.prayer_topics || []).includes(intent));
  return { ...place, deities: worshipped, matchedDeities: matched.map(d => d.name),
    recommendationReason: matched.length ? `奉祀${matched.map(d => d.name).join('、')}，常見祈求包含${intent}。` : '' };
}

function matchesIntent(place, intent) {
  return !intent || intent === '綜合' || (place.matchedDeities || []).length > 0;
}

module.exports = { enrichPlace, matchesIntent };

'use strict';

// JSON-file store: load once at boot, sync reads for MVP concurrency.
// Future PG migration: replace these functions behind the same interface.

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJson(name, fallback) {
  const file = path.join(DATA_DIR, name);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

function loadStore() {
  return {
    deities: readJson('deities.json', []),
    events: readJson('events.json', []),
    places: readJson('places.json', []),
    products: readJson('products.json', []),
    sets: readJson('sets.json', []),
  };
}

module.exports = { DATA_DIR, readJson, loadStore };

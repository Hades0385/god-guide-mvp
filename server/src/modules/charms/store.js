'use strict';

// Ping-an charm (平安符) collection (MVP).
// Collect: buying at a partner shop (any is_partner place).
// Redeem: at a partner temple (is_partner && type === 'temple').
// JSON persistence mirrors checklist store (BOM-safe load, atomic save).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DATA_DIR } = require('../../utils/store');

const DEFAULT_FILE = path.join(DATA_DIR, 'amulets.json');

function loadAmulets(file = DEFAULT_FILE) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw.trim() || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function saveAmulets(list, file = DEFAULT_FILE) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, file);
}

function errWith(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function collectCharm({ userIdHash = '', place }, file = DEFAULT_FILE) {
  if (!place) throw errWith(404, 'place not found');
  if (!place.is_partner) throw errWith(400, 'only partner shops give charms');
  const list = loadAmulets(file);
  const charm = {
    id: crypto.randomUUID(),
    userIdHash,
    label: '平安符',
    fromPlaceId: place.id,
    fromPlaceName: place.name,
    obtainedAt: new Date().toISOString(),
    status: 'held',
    redeemedAt: null,
    redeemedAtPlaceId: null,
    redeemedAtPlaceName: null,
  };
  list.push(charm);
  saveAmulets(list, file);
  return charm;
}

function redeemCharm({ charmId, userIdHash = '', temple }, file = DEFAULT_FILE) {
  const list = loadAmulets(file);
  const charm = list.find((c) => c.id === charmId);
  if (!charm) throw errWith(404, 'charm not found');
  if (charm.userIdHash && userIdHash && charm.userIdHash !== userIdHash) {
    throw errWith(403, 'not your charm');
  }
  if (charm.status === 'redeemed') throw errWith(409, 'already redeemed');
  if (!temple) throw errWith(404, 'place not found');
  if (!temple.is_partner || temple.type !== 'temple') {
    throw errWith(400, 'redeem only at partner temples');
  }
  charm.status = 'redeemed';
  charm.redeemedAt = new Date().toISOString();
  charm.redeemedAtPlaceId = temple.id;
  charm.redeemedAtPlaceName = temple.name;
  saveAmulets(list, file);
  return charm;
}

function listByUser(userIdHash = '', file = DEFAULT_FILE) {
  return loadAmulets(file).filter((c) => (c.userIdHash || '') === (userIdHash || ''));
}

module.exports = { loadAmulets, saveAmulets, collectCharm, redeemCharm, listByUser, DEFAULT_FILE };

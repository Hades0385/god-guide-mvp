'use strict';

// Point economy (concept demo, replaces free charm handouts).
// Earn: spend at partner RETAIL shops (type !== 'temple').
// Redeem: AMULET_COST points -> physical amulet at partner temple;
//         COUPON_COST points -> discount coupon at partner shop.
// Ledger-based (balance = sum). Coupons in coupons.json.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DATA_DIR } = require('../../utils/store');
const { collectCharm, redeemCharm } = require('../charms/store');

const POINTS_FILE = path.join(DATA_DIR, 'points.json');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');

const AMULET_COST = 50;
const COUPON_COST = 30;
const EARN_PER_NTD = 0.1; // 1 point per NT$10 spent

function errWith(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function readList(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw.trim() || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeList(list, file) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, file);
}

function balanceOf(userIdHash = '', file = POINTS_FILE) {
  return readList(file)
    .filter((e) => (e.userIdHash || '') === (userIdHash || ''))
    .reduce((sum, e) => sum + (Number(e.delta) || 0), 0);
}

function ledgerOf(userIdHash = '', file = POINTS_FILE) {
  return readList(file).filter((e) => (e.userIdHash || '') === (userIdHash || ''));
}

function earnPoints({ userIdHash = '', place, amountNt = 0 }, files = {}) {
  const pointsFile = files.pointsFile || POINTS_FILE;
  if (!place) throw errWith(404, 'place not found');
  if (!place.is_partner || place.type === 'temple') {
    throw errWith(400, 'earn only at partner retail shops');
  }
  const earned = Math.max(1, Math.floor(Number(amountNt || 0) * EARN_PER_NTD));
  const list = readList(pointsFile);
  const entry = {
    id: crypto.randomUUID(),
    userIdHash,
    delta: earned,
    reason: `智慧零售消費集點（${place.name} NT$${amountNt}）`,
    placeId: place.id,
    placeName: place.name,
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  writeList(list, pointsFile);
  return { entry, balance: balanceOf(userIdHash, pointsFile) };
}

function redeemReward({ userIdHash = '', kind, place }, files = {}) {
  const pointsFile = files.pointsFile || POINTS_FILE;
  const couponsFile = files.couponsFile || COUPONS_FILE;
  const charmsFile = files.charmsFile;
  if (kind !== 'amulet' && kind !== 'coupon') throw errWith(400, 'kind must be amulet|coupon');
  if (!place) throw errWith(404, 'place not found');
  const cost = kind === 'amulet' ? AMULET_COST : COUPON_COST;
  if (kind === 'amulet' && (!place.is_partner || place.type !== 'temple')) {
    throw errWith(400, 'amulet redeem only at partner temples');
  }
  if (kind === 'coupon' && (!place.is_partner || place.type === 'temple')) {
    throw errWith(400, 'coupon redeem only at partner retail shops');
  }
  const balance = balanceOf(userIdHash, pointsFile);
  if (balance < cost) throw errWith(400, `insufficient points (need ${cost}, have ${balance})`);

  const list = readList(pointsFile);
  const deduct = {
    id: crypto.randomUUID(),
    userIdHash,
    delta: -cost,
    reason: kind === 'amulet' ? `兌換實體平安符（${place.name}）` : `兌換消費折扣券（${place.name}）`,
    placeId: place.id,
    placeName: place.name,
    createdAt: new Date().toISOString(),
  };
  list.push(deduct);
  writeList(list, pointsFile);

  if (kind === 'amulet') {
    // Issue + immediately mark redeemed at the temple (physical handout).
    const charm = collectCharm({ userIdHash, place }, charmsFile);
    const redeemed = redeemCharm({ charmId: charm.id, userIdHash, temple: place }, charmsFile);
    return { reward: redeemed, balance: balance - cost, cost };
  }
  const coupons = readList(couponsFile);
  const coupon = {
    id: crypto.randomUUID(),
    userIdHash,
    shopId: place.id,
    shopName: place.name,
    title: `${place.name} 消費折扣券`,
    code: crypto.randomBytes(4).toString('hex').toUpperCase(),
    status: 'valid',
    createdAt: new Date().toISOString(),
  };
  coupons.push(coupon);
  writeList(coupons, couponsFile);
  return { reward: coupon, balance: balance - cost, cost };
}

function couponsOf(userIdHash = '', file = COUPONS_FILE) {
  return readList(file).filter((c) => (c.userIdHash || '') === (userIdHash || ''));
}

module.exports = {
  earnPoints, redeemReward, balanceOf, ledgerOf, couponsOf,
  AMULET_COST, COUPON_COST, POINTS_FILE, COUPONS_FILE,
};

'use strict';

// Ultra-light server: native http only, zero deps.
// Serves app/ static + /api/* same origin (see plan.md:2, plan.md:11).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('./config');
const { loadStore } = require('./utils/store');
const { findNearbyPlaces, sortNearbyPlaces, parseCoordParam } = require('./utils/distance');
const { getTodayFestival } = require('./modules/events/calendar');
const { verifyLineSignature } = require('./middleware/lineSignature');
const { routeLineEvent } = require('./modules/line/webhook');
const { buildFestivalFlex, buildCouponFlex } = require('./modules/line/flex');
const { buildRichMenu, installRichMenu } = require('./modules/line/richMenu');
const { handleChat } = require('./modules/chat/service');
const { createChecklist, toggleItem } = require('./modules/checklist/store');
const { collectCharm, redeemCharm, listByUser } = require('./modules/charms/store');
const { handlePrayer } = require('./modules/prayer/generator');
const { earnPoints, redeemReward, balanceOf, ledgerOf, couponsOf } = require('./modules/points/store');

const APP_DIR = path.join(__dirname, '..', '..', 'app');
const store = loadStore();

function placeWithDeities(place) {
  const deities = (place.deity_ids || [])
    .map((id) => store.deities.find((deity) => deity.id === id))
    .filter(Boolean);
  return { ...place, deities };
}

function placeMatchesIntent(place, intent) {
  if (!intent) return true;
  if ((place.tags || []).includes(intent)) return true;
  return (place.deity_ids || []).some((id) => {
    const deity = store.deities.find((candidate) => candidate.id === id);
    return deity && (deity.prayer_topics || []).includes(intent);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function log(req, status, extra) {
  // Minimal structured log (see AGENTS.md logging). No PII.
  const line = JSON.stringify({
    t: new Date().toISOString(),
    m: req.method,
    u: req.url,
    s: status,
    ...(extra ? { extra } : {}),
  });
  console.log(line);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(APP_DIR, safe);
  if (!file.startsWith(APP_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    log(req, 403);
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      log(req, 404);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
    log(req, 200);
  });
}

async function handleApi(req, res, rawBody) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ['api','deities',':id']

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, demoMode: config.demoMode });
    log(req, 200);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/line/rich-menu') {
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:3000'}`;
    sendJson(res, 200, {
      installed: false,
      definition: buildRichMenu(baseUrl),
      imageUrl: '/assets/images/line-rich-menu.jpg',
      readyToInstall: Boolean(config.lineChannelAccessToken),
    });
    log(req, 200, { event: 'line.rich_menu.preview' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/line/rich-menu/install') {
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:3000'}`;
    try {
      const result = await installRichMenu({ token: config.lineChannelAccessToken, baseUrl });
      sendJson(res, 201, { installed: true, ...result });
      log(req, 201, { event: 'line.rich_menu.install', id: result.richMenuId });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message || 'install failed' });
      log(req, error.status || 500, { event: 'line.rich_menu.error' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/events/today') {
    const result = getTodayFestival(new Date(), store.events, { demoMode: config.demoMode });
    // Attach deity details for convenience.
    const events = result.events.map((e) => ({
      ...e,
      deity: store.deities.find((d) => d.id === e.deity_id) || null,
    }));
    sendJson(res, 200, { ...result, events });
    log(req, 200, { event: 'events.today', count: events.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/line/webhook') {
    const signature = req.headers['x-line-signature'] || '';
    if (config.lineChannelSecret) {
      if (!verifyLineSignature(rawBody, config.lineChannelSecret, signature)) {
        sendJson(res, 401, { error: 'invalid signature' });
        log(req, 401, { event: 'line.webhook.auth_fail' });
        return;
      }
    } else {
      log(req, 200, { event: 'line.webhook.no_secret_skip_verify' });
    }
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:3000'}`;
    const results = (body.events || []).map((ev) =>
      routeLineEvent(ev, { deities: store.deities, events: store.events, miniappUrl: `${baseUrl}/miniapp/index.html` })
    );
    // MVP: log intended replies; real push requires LINE_CHANNEL_ACCESS_TOKEN.
    log(req, 200, { event: 'line.webhook', received: (body.events || []).length });
    sendJson(res, 200, { ok: true, results });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/demo/simulate') {
    if (!config.demoMode) {
      sendJson(res, 403, { error: 'DEMO_MODE is off' });
      log(req, 403);
      return;
    }
    const result = getTodayFestival(new Date(), store.events, { demoMode: true });
    const event = result.events[0] || null;
    const deity = event ? store.deities.find((d) => d.id === event.deity_id) : store.deities[0];
    sendJson(res, 200, {
      ...result,
      pushPreview: buildFestivalFlex(deity, event, null),
      mockGps: { lat: 23.4801, lng: 120.4491 },
    });
    log(req, 200, { event: 'demo.simulate' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      const result = await handleChat(body, {
        deities: store.deities,
        demoMode: config.demoMode,
        llmApiKey: config.llmApiKey,
        llmModel: config.llmModel,
      });
      sendJson(res, 200, result);
      log(req, 200, { event: 'chat', intent: result.intent, llm: result.llmStatus });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'chat failed' });
      log(req, err.status || 500, { event: 'chat.error' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/checklists') {
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      const deity = store.deities.find((d) => d.id === body.deityId) || null;
      const checklist = createChecklist(
        { userIdHash: body.userIdHash || '', deity, title: body.title },
      );
      sendJson(res, 201, checklist);
      log(req, 201, { event: 'checklist.create', id: checklist.id });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'create failed' });
      log(req, err.status || 500, { event: 'checklist.error' });
    }
    return;
  }

  if (
    req.method === 'PATCH' &&
    parts[0] === 'api' && parts[1] === 'checklists' &&
    parts[3] === 'items' && parts.length === 5
  ) {
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      const checklist = toggleItem(parts[2], parts[4], body.checked);
      sendJson(res, 200, checklist);
      log(req, 200, { event: 'checklist.toggle', id: checklist.id });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'update failed' });
      log(req, err.status || 500, { event: 'checklist.error' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/recommendations') {
    const intent = url.searchParams.get('intent') || '';
    const lat = parseCoordParam(url.searchParams.get('lat'));
    const lng = parseCoordParam(url.searchParams.get('lng'));
    let pool = store.places.filter((place) => place.type === 'temple');
    if (intent) pool = pool.filter((place) => placeMatchesIntent(place, intent));
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      try {
        const found = findNearbyPlaces(lat, lng, pool, 3);
        sendJson(res, 200, sortNearbyPlaces(found, intent).slice(0, 10).map(placeWithDeities));
      } catch (err) {
        sendJson(res, 400, { error: String(err.message) });
      }
    } else {
      const sorted = [...pool].sort((a, b) =>
        (b.is_partner - a.is_partner) || String(a.name).localeCompare(String(b.name)));
      sendJson(res, 200, sorted.slice(0, 10).map(placeWithDeities));
    }
    log(req, 200, { event: 'recommendations', intent });
    return;
  }

  if (parts[0] === 'api' && parts[1] === 'amulets') {
    if (req.method === 'GET' && parts.length === 2) {
      sendJson(res, 200, listByUser(url.searchParams.get('userIdHash') || ''));
      log(req, 200, { event: 'amulets.list' });
      return;
    }
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'collect') {
        const place = store.places.find((p) => p.id === body.placeId) || null;
        const charm = collectCharm({ userIdHash: body.userIdHash || '', place });
        sendJson(res, 201, charm);
        log(req, 201, { event: 'amulets.collect', id: charm.id });
        return;
      }
      if (req.method === 'POST' && parts.length === 4 && parts[2] !== 'collect' && parts[3] === 'redeem') {
        const temple = store.places.find((p) => p.id === body.placeId) || null;
        const charm = redeemCharm({ charmId: parts[2], userIdHash: body.userIdHash || '', temple });
        sendJson(res, 200, charm);
        log(req, 200, { event: 'amulets.redeem', id: charm.id });
        return;
      }
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'amulet failed' });
      log(req, err.status || 500, { event: 'amulets.error' });
      return;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/prayer') {
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      const result = await handlePrayer(body, {
        deities: store.deities,
        demoMode: config.demoMode,
        llmApiKey: config.llmApiKey,
        llmModel: config.llmModel,
      });
      sendJson(res, 200, result);
      log(req, 200, { event: 'prayer', topic: result.topic, llm: result.llmStatus });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'prayer failed' });
      log(req, err.status || 500, { event: 'prayer.error' });
    }
    return;
  }

  if (parts[0] === 'api' && parts[1] === 'points') {
    if (req.method === 'GET' && parts.length === 2) {
      const uid = url.searchParams.get('userIdHash') || '';
      sendJson(res, 200, { balance: balanceOf(uid), ledger: ledgerOf(uid) });
      log(req, 200, { event: 'points.balance' });
      return;
    }
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    try {
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'earn') {
        const place = store.places.find((p) => p.id === body.placeId) || null;
        const r = earnPoints({ userIdHash: body.userIdHash || '', place, amountNt: body.amountNt || 0 });
        sendJson(res, 201, r);
        log(req, 201, { event: 'points.earn', earned: r.entry.delta });
        return;
      }
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'redeem') {
        const place = store.places.find((p) => p.id === body.placeId) || null;
        const r = redeemReward({ userIdHash: body.userIdHash || '', kind: body.kind, place });
        sendJson(res, 200, r);
        log(req, 200, { event: 'points.redeem', kind: body.kind });
        return;
      }
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'points failed' });
      log(req, err.status || 500, { event: 'points.error' });
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/coupons') {
    sendJson(res, 200, couponsOf(url.searchParams.get('userIdHash') || ''));
    log(req, 200, { event: 'coupons.list' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/beacon/enter') {
    if (!config.demoMode) {
      sendJson(res, 403, { error: 'DEMO_MODE is off (beacon is concept-demo only)' });
      log(req, 403);
      return;
    }
    let body;
    try {
      body = JSON.parse(rawBody.length ? rawBody.toString('utf8') : '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      log(req, 400);
      return;
    }
    const place = store.places.find((p) => p.id === body.placeId) || null;
    if (!place) {
      sendJson(res, 404, { error: 'place not found' });
      log(req, 404);
      return;
    }
    // Concept demo: simulate the LINE push a real Beacon would trigger.
    sendJson(res, 200, {
      place: { id: place.id, name: place.name, type: place.type, is_partner: place.is_partner },
      message: place.is_partner
        ? `歡迎來到${place.name}！合作店家限量優惠＋消費集點中`
        : `你經過${place.name}，今日祭拜提醒：記得帶供品`,
      pushPreview: buildCouponFlex(place, null),
    });
    log(req, 200, { event: 'beacon.enter', place: place.id });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/sets') {
    const shopId = url.searchParams.get('shopId') || '';
    let sets = store.sets;
    if (shopId) sets = sets.filter((s) => s.shopId === shopId);
    sendJson(res, 200, sets.map((s) => {
      const shop = store.places.find((p) => p.id === s.shopId) || null;
      return {
        ...s,
        shop: shop ? {
          id: shop.id, name: shop.name, type: shop.type, address: shop.address,
          phone: shop.phone, is_partner: shop.is_partner, promotion: shop.promotion,
        } : null,
      };
    }));
    log(req, 200, { event: 'sets.list', count: sets.length });
    return;
  }

  if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'deities') {
    if (parts.length === 2) {
      sendJson(res, 200, store.deities);
      log(req, 200);
      return;
    }
    if (parts.length === 3) {
      const d = store.deities.find((x) => x.id === parts[2]);
      if (!d) {
        sendJson(res, 404, { error: 'deity not found' });
        log(req, 404);
        return;
      }
      sendJson(res, 200, d);
      log(req, 200);
      return;
    }
  }

  if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'places') {
    if (parts[2] === 'nearby') {
      const lat = parseCoordParam(url.searchParams.get('lat'));
      const lng = parseCoordParam(url.searchParams.get('lng'));
      const radius = Number(url.searchParams.get('radius') || '3');
      const intent = url.searchParams.get('intent') || '';
      const type = url.searchParams.get('type') || '';
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        sendJson(res, 400, { error: 'lat and lng query params are required numbers' });
        log(req, 400);
        return;
      }
      let pool = store.places;
      if (type) pool = pool.filter((p) => p.type === type);
      const offering = url.searchParams.get('offering') || '';
      if (offering) {
        // Only shops can sell; match via products.json offerings link.
        const sellerIds = new Set(
          store.products.filter((pr) => (pr.offerings || []).includes(offering)).map((pr) => pr.shopId),
        );
        pool = pool.filter((p) => p.type !== 'temple' && sellerIds.has(p.id));
      }
      try {
        const found = findNearbyPlaces(lat, lng, pool, Number.isNaN(radius) ? 3 : radius);
        sendJson(res, 200, sortNearbyPlaces(found, intent).map(placeWithDeities));
      } catch (err) {
        sendJson(res, 400, { error: String(err.message) });
      }
      log(req, 200, { event: 'places.nearby', offering: offering || undefined });
      return;
    }
    if (parts.length === 4 && parts[3] === 'products') {
      const p = store.places.find((x) => x.id === parts[2]);
      if (!p) {
        sendJson(res, 404, { error: 'place not found' });
        log(req, 404);
        return;
      }
      sendJson(res, 200, store.products.filter((pr) => pr.shopId === p.id));
      log(req, 200, { event: 'places.products', id: p.id });
      return;
    }
    if (parts.length === 3) {
      const p = store.places.find((x) => x.id === parts[2]);
      if (!p) {
        sendJson(res, 404, { error: 'place not found' });
        log(req, 404);
        return;
      }
      sendJson(res, 200, placeWithDeities(p));
      log(req, 200);
      return;
    }
  }

  sendJson(res, 404, { error: 'not found' });
  log(req, 404);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    // Buffer raw body FIRST so HMAC verification sees exact bytes (plan.md:19).
    const rawBody = (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT')
      ? await readRawBody(req)
      : Buffer.alloc(0);
    handleApi(req, res, rawBody);
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end('method not allowed');
    log(req, 405);
    return;
  }
  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`gods-guide listening on http://localhost:${config.port}`);
  });
}

module.exports = { server, handleApi };

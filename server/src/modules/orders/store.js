'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DATA_DIR } = require('../../utils/store');
const { earnPoints } = require('../points/store');

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

function createOrder(body, store, files = {}) {
  const { items, userIdHash, requestId, customer, payment, pickup } = body || {};
  if (typeof userIdHash !== 'string' || !/^[\w-]{8,100}$/.test(userIdHash)) fail('使用者識別無效');
  if (typeof requestId !== 'string' || !/^[\w-]{8,100}$/.test(requestId)) fail('訂單識別無效');
  if (!customer || typeof customer.name !== 'string' || !customer.name.trim() || customer.name.length > 50 || !/^09\d{8}$/.test(customer.phone)) fail('請填寫姓名與正確手機');
  if (!['linepay', 'pickup'].includes(payment) || pickup !== 'store') fail('取貨或付款方式無效');
  if (!Array.isArray(items) || !items.length || items.length > 20) fail('購物車不可為空或超過20項');
  const ids = new Set();
  const lines = items.map(item => {
    const set = store.sets.find(s => s.id === item.id);
    if (!set || !set.is_demo || ids.has(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) fail('商品或數量無效');
    ids.add(item.id);
    return { id: set.id, name: set.name, shopId: set.shopId, price: set.price, qty: item.qty };
  });
  const file = files.ordersFile || path.join(DATA_DIR, 'orders.json');
  const orders = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const fingerprint = JSON.stringify({ lines, payment, pickup });
  let order = orders.find(o => o.userIdHash === userIdHash && o.requestId === requestId);
  if (order && order.fingerprint !== fingerprint) fail('重試訂單內容不一致', 409);
  if (!order) {
    order = { id: crypto.randomUUID(), requestId, userIdHash, items: lines, fingerprint,
      total: lines.reduce((sum, line) => sum + line.price * line.qty, 0), payment, pickup,
      status: payment === 'linepay' ? 'demo_paid' : 'awaiting_pickup', is_demo: true, createdAt: new Date().toISOString() };
    orders.push(order);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(orders, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  }
  // Demo contact details are validated but never persisted or sent to a merchant.
  let earned = 0;
  if (order.status === 'demo_paid') {
    for (const shopId of new Set(order.items.map(i => i.shopId))) {
      const amountNt = order.items.filter(i => i.shopId === shopId).reduce((sum, i) => sum + i.price * i.qty, 0);
      const result = earnPoints({ userIdHash, place: store.places.find(p => p.id === shopId), amountNt, orderId: `${order.id}:${shopId}` }, files);
      earned += result.entry.delta;
    }
  }
  return { id: order.id, total: order.total, status: order.status, payment, pickup, items: order.items, earnedPoints: earned, is_demo: true };
}
module.exports = { createOrder };

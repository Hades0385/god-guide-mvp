'use strict';

// LINE Signature verification (plan.md:7, AGENTS.md secrets).
// HMAC-SHA256(rawBody, channelSecret) base64 === x-line-signature.

const crypto = require('node:crypto');

function verifyLineSignature(rawBody, channelSecret, signature) {
  if (!channelSecret || !signature || !rawBody) return false;
  const hash = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signForTest(rawBody, channelSecret) {
  return crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
}

module.exports = { verifyLineSignature, signForTest };

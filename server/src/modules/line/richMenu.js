'use strict';

const fs = require('node:fs');
const path = require('node:path');

const IMAGE_PATH = path.join(__dirname, '..', '..', '..', '..', 'app', 'assets', 'images', 'line-rich-menu.jpg');

function buildRichMenu(baseUrl = 'https://example.com') {
  const root = String(baseUrl).replace(/\/$/, '');
  const width = 1527;
  const height = 1030;
  const cellWidth = Math.floor(width / 3);
  const cellHeight = Math.floor(height / 2);
  const links = [
    ['/miniapp/home.html', '首頁'],
    ['/miniapp/index.html', 'AI 問事'],
    ['/miniapp/map.html', '找宮廟'],
    ['/miniapp/encyclopedia.html', '祭拜百科'],
    ['/miniapp/shop.html', '購物'],
    ['/miniapp/more.html', '更多'],
  ];
  return {
    size: { width, height },
    selected: true,
    name: '神引路主選單',
    chatBarText: '開啟神引路',
    areas: links.map(([href, label], i) => ({
      bounds: {
        x: (i % 3) * cellWidth,
        y: Math.floor(i / 3) * cellHeight,
        width: i % 3 === 2 ? width - (2 * cellWidth) : cellWidth,
        height: Math.floor(i / 3) === 1 ? height - cellHeight : cellHeight,
      },
      action: { type: 'uri', label, uri: `${root}${href}` },
    })),
  };
}

async function lineRequest(pathname, token, options = {}) {
  const host = pathname.endsWith('/content') ? 'https://api-data.line.me' : 'https://api.line.me';
  const response = await fetch(`${host}${pathname}`, {
    signal: AbortSignal.timeout(15000),
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`LINE API ${response.status}: ${detail}`);
    error.status = 502;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function installRichMenu({ token, baseUrl }) {
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw Object.assign(new Error('PUBLIC_BASE_URL 必須為公開 HTTPS 網址'), { status:400 }); }
  if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', 'example.com'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw Object.assign(new Error('PUBLIC_BASE_URL 必須為公開 HTTPS 網站根網址'), { status:400 });
  }
  if (!token) {
    const error = new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
    error.status = 503;
    throw error;
  }
  const definition = buildRichMenu(baseUrl);
  const created = await lineRequest('/v2/bot/richmenu', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(definition),
  });
  const richMenuId = created.richMenuId;
  try {
    await lineRequest(`/v2/bot/richmenu/${richMenuId}/content`, token, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: fs.readFileSync(IMAGE_PATH),
    });
    await lineRequest(`/v2/bot/user/all/richmenu/${richMenuId}`, token, { method: 'POST' });
  } catch (error) {
    await lineRequest(`/v2/bot/richmenu/${richMenuId}`, token, { method: 'DELETE' }).catch(() => {});
    throw error;
  }
  return { richMenuId, definition, imagePath: '/assets/images/line-rich-menu.jpg' };
}

module.exports = { buildRichMenu, installRichMenu, IMAGE_PATH };

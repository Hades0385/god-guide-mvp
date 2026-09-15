'use strict';
// Minimal fetch wrapper (shared by all miniapp pages).
async function apiGet(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}
async function apiSend(path, method, body) {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`${method} ${path} -> ${r.status}: ${err.error || ''}`);
  }
  return r.json();
}
const apiPost = (path, body) => apiSend(path, 'POST', body);
const apiPatch = (path, body) => apiSend(path, 'PATCH', body);

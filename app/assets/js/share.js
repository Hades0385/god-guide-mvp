'use strict';
// Community share (concept demo).
// Real LINE path: liff.shareTargetPicker (needs LIFF SDK + login).
// Fallbacks: Web Share API -> clipboard. Returns which path was used.
async function shareToLine(message, altText) {
  const text = altText || '神引路 — 祭拜攻略';
  try {
    if (window.liff && typeof window.liff.shareTargetPicker === 'function') {
      await window.liff.shareTargetPicker([message]);
      return 'liff';
    }
  } catch (_) { /* fall through */ }
  if (navigator.share) {
    try {
      await navigator.share({ title: text, text: typeof message === 'string' ? message : text });
      return 'webshare';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }
  const body = typeof message === 'string' ? message : text;
  await navigator.clipboard.writeText(body + '\n' + location.href);
  return 'clipboard';
}

// Minimal Flex bubble for family sharing (mirrors server flex.js).
function buildShareFlex(deityName, eventName, replySnippet) {
  return {
    type: 'flex',
    altText: `神引路：幫家人祈福（${deityName}）`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '神引路 · 代家人祈福', weight: 'bold', color: '#8B0000', size: 'sm' },
          { type: 'text', text: `${deityName} ${eventName || ''}`, weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: String(replySnippet || '').slice(0, 120), size: 'sm', color: '#555555', wrap: true },
        ],
      },
    },
  };
}

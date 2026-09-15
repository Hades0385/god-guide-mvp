'use strict';
// Shared app chrome: top header + bottom tab bar.
// Back button rule (hierarchy-based, NOT history-based):
// - Tab roots (home/chat/map/charms/more) NEVER show back.
// - Child pages (e.g. place.html) set data-back="/miniapp/map.html" to show it.
// Usage: <script src="/assets/js/layout.js" data-title="諮詢" data-tab="chat"></script>
//        <script src="/assets/js/layout.js" data-title="店家詳情" data-back="/miniapp/map.html"></script>
(function () {
  const script = document.currentScript;
  const title = (script && script.dataset.title) || '神引路';
  const tab = (script && script.dataset.tab) || '';
  const backTarget = (script && script.dataset.back) || '';

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML =
    (backTarget ? `<button class="back show" aria-label="返回">‹</button>` : `<span class="back"></span>`) +
    `<div class="title">🏮 ${title} <span class="brand">God's Guide</span></div>`;
  if (backTarget) {
    header.querySelector('.back').addEventListener('click', () => { location.href = backTarget; });
  }
  document.body.prepend(header);

  // Child pages hide the tab bar (they belong to a tab's flow).
  if (backTarget) return;

  const tabs = [
    { id: 'home', href: '/miniapp/home.html', ico: '🏠', label: '首頁' },
    { id: 'chat', href: '/miniapp/index.html', ico: '💬', label: '諮詢' },
    { id: 'map', href: '/miniapp/map.html', ico: '🗺️', label: '地圖' },
    { id: 'shop', href: '/miniapp/shop.html', ico: '🛒', label: '購物' },
    { id: 'charms', href: '/miniapp/charms.html', ico: '🪙', label: '集點' },
    { id: 'more', href: '/miniapp/demo.html', ico: '🧰', label: '更多' },
  ];
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.innerHTML = tabs.map((t) =>
    `<a href="${t.href}" class="${t.id === tab ? 'active' : ''}"><span class="ico">${t.ico}</span>${t.label}</a>`
  ).join('');
  document.body.appendChild(bar);
})();

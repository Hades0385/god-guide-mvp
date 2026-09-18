'use strict';
// Shared app chrome: top header + bottom tab bar.
// Back button rule (hierarchy-based, NOT history-based):
// - Tab roots (home/chat/map/shop/more) NEVER show back.
// - Child pages (e.g. place.html) set data-back="/miniapp/map.html" to show it.
// Usage: <script src="/assets/js/layout.js" data-title="諮詢" data-tab="chat"></script>
//        <script src="/assets/js/layout.js" data-title="店家詳情" data-back="/miniapp/map.html"></script>
(function () {
  const script = document.currentScript;
  const title = (script && script.dataset.title) || '神引路';
  const tab = (script && script.dataset.tab) || '';
  const backTarget = (script && script.dataset.back) || '';

  if (!document.querySelector('link[data-bootstrap-icons]')) {
    const icons = document.createElement('link');
    icons.rel = 'stylesheet';
    icons.href = '/assets/vendor/bootstrap-icons/bootstrap-icons.min.css';
    icons.dataset.bootstrapIcons = 'true';
    document.head.appendChild(icons);
  }

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML =
    (backTarget ? `<button class="back show" aria-label="返回"><i class="bi bi-chevron-left"></i></button>` : `<span class="back"></span>`) +
    `<div class="title">${title}<span class="brand">神引路</span></div>` +
    `<span class="topbar-spacer"></span>`;
  if (backTarget) {
    header.querySelector('.back').addEventListener('click', () => { location.href = backTarget; });
  }
  document.body.prepend(header);

  // Child pages hide the tab bar (they belong to a tab's flow).
  if (backTarget) return;

  const tabs = [
    { id: 'home', href: '/miniapp/home.html', ico: 'bi-house-door', label: '首頁' },
    { id: 'chat', href: '/miniapp/index.html', ico: 'bi-chat-dots', label: 'AI 問事' },
    { id: 'map', href: '/miniapp/map.html', ico: 'bi-geo-alt', label: '找宮廟' },
    { id: 'shop', href: '/miniapp/shop.html', ico: 'bi-bag', label: '購物' },
    { id: 'more', href: '/miniapp/more.html', ico: 'bi-grid', label: '更多' },
  ];
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.innerHTML = tabs.map((t) =>
    `<a href="${t.href}" class="${t.id === tab ? 'active' : ''}"><i class="bi ${t.ico}" aria-hidden="true"></i><span>${t.label}</span></a>`
  ).join('');
  document.body.appendChild(bar);
})();

'use strict';
// Hybrid map: old fullscreen + bottom sheet UI, new filtering / locate / null-coord logic.
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const state = {
  lat: 23.4801, lng: 120.4491,
  cat: params.has('offering') ? 'shop' : params.has('intent') || params.has('deity') ? 'temple' : 'all',
  intent: params.get('intent') || localStorage.getItem('gg-intent') || '',
  offering: params.get('offering') || '',
  deity: params.get('deity') || '',
};
if (state.intent) { try { localStorage.setItem('gg-intent', state.intent); } catch { /* ignore */ } }
const provider = new LeafletProvider();
const byId = new Map();
let revision = 0;
const typeLabel = { temple: '宮廟', offering_shop: '供品店', joss_paper_shop: '金香店', flower_shop: '花店' };

function navHref(p) {
  const dest = p.address || (Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? `${p.latitude},${p.longitude}` : p.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

function closeSheet() { $('sheet').classList.remove('open'); $('backdrop').classList.remove('open'); }
function openSheetMode(listMode) {
  $('sheet-detail').hidden = listMode;
  $('sheet-list').hidden = !listMode;
  $('sheet').classList.add('open'); $('backdrop').classList.add('open');
}

async function openSheet(id) {
  let p = byId.get(id);
  if (!p) {
    try { p = await apiGet(`/api/places/${encodeURIComponent(id)}`); }
    catch { return; }
  }
  $('s-name').textContent = p.name;
  $('s-tags').innerHTML = `<span class="tag">${typeLabel[p.type] || p.type}</span>` + (p.is_partner ? '<span class="tag partner">合作</span>' : '');
  const dist = p.distanceKm != null ? ` · ${p.distanceKm.toFixed(2)} km` : (p.latitude == null ? ' · 座標待確認' : '');
  const approx = p.coordinate_source === 'approx' ? ' · 位置僅供參考' : '';
  $('s-meta').textContent = [p.address, p.opening_hours, p.phone].filter(Boolean).join(' · ') + dist + approx;
  $('s-desc').textContent = p.recommendationReason || p.description || '';
  $('s-deities').innerHTML = p.type === 'temple' && p.deities?.length
    ? `<div class="deity-pill-list">${p.deities.map(d => `<span class="deity-pill">${d.name}</span>`).join('')}</div>` : '';
  $('s-nav').href = navHref(p);
  $('s-detail').href = `/miniapp/place.html?id=${encodeURIComponent(p.id)}`;
  openSheetMode(false);
}

function renderBanner(places) {
  const bar = $('offerbanner');
  const label = state.offering ? `可買到「${state.offering}」` : state.deity ? '僅顯示奉祀所選神明的宮廟' : state.intent ? `「${state.intent}」推薦結果` : '';
  $('filter-label').textContent = state.offering ? `尋找「${state.offering}」店家，供貨請先電話確認。` : state.deity ? '僅顯示奉祀所選神明的宮廟。' : state.intent ? `符合「${state.intent}」的宮廟，以奉祀神明比對。` : '';
  $('clear-filter').hidden = !(state.intent || state.offering || state.deity || state.cat !== 'all');
  if (!label) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.replaceChildren();
  const span = document.createElement('span');
  span.textContent = `${label} · ${places.length} 個地點`;
  const btn = document.createElement('button');
  btn.textContent = '清除';
  btn.onclick = clearFilter;
  bar.append(span, btn);
}

function renderList(places) {
  const box = $('places');
  box.replaceChildren();
  $('count').textContent = places.length ? `(${places.length})` : '';
  $('list-count').textContent = `${places.length} 個地點`;
  for (const p of places) {
    const article = document.createElement('article');
    article.className = 'card sheet-card';
    const heading = document.createElement('h3');
    heading.textContent = p.name;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = p.address + (p.distanceKm != null ? ` · ${p.distanceKm.toFixed(2)} km` : ' · 座標待確認') + (p.coordinate_source === 'approx' ? ' · 位置僅供參考' : '');
    const desc = document.createElement('p');
    desc.textContent = p.recommendationReason || (p.deities?.length ? '奉祀：' + p.deities.map(d => d.name).join('、') : p.description);
    const row = document.createElement('div');
    row.className = 'row';
    const detail = document.createElement('a');
    detail.className = 'btn secondary';
    detail.textContent = '詳情';
    detail.href = '/miniapp/place.html?id=' + encodeURIComponent(p.id);
    const nav = document.createElement('a');
    nav.className = 'btn secondary';
    nav.textContent = '導航';
    nav.href = navHref(p);
    nav.target = '_blank';
    nav.rel = 'noopener';
    row.append(detail, nav);
    article.append(heading, meta, desc, row);
    box.append(article);
  }
  if (!places.length) box.textContent = '目前沒有符合的地點，請清除篩選或更換祈求主題。';
}

function visiblePlaces(all) {
  return all.filter(p => (state.cat === 'all' || (state.cat === 'temple' ? p.type === 'temple' : p.type !== 'temple'))
    && (!state.deity || (p.deity_ids || []).includes(state.deity)));
}

async function reload() {
  const request = ++revision;
  $('intent').value = state.intent;
  document.querySelectorAll('#chips [data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === state.cat));
  const query = new URLSearchParams({ lat: state.lat, lng: state.lng, radius: 3, intent: state.intent, offering: state.offering });
  try {
    const [nearby, directory] = await Promise.all([
      apiGet('/api/places/nearby?' + query),
      apiGet('/api/places?' + new URLSearchParams({ offering: state.offering })),
    ]);
    if (request !== revision) return;
    byId.clear();
    for (const p of [...nearby, ...directory]) byId.set(p.id, p);
    const merged = [...nearby];
    for (const p of directory) {
      if ((p.latitude == null || p.longitude == null) && !merged.some(x => x.id === p.id)) merged.push(p);
    }
    const places = visiblePlaces(merged);
    provider.clearMarkers();
    for (const p of places) {
      if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
        provider.addMarker({ id: p.id, lat: p.latitude, lng: p.longitude, type: p.type, is_partner: p.is_partner, title: p.name, onClick: openSheet });
      }
    }
    renderBanner(places);
    renderList(places);
  } catch {
    $('status').textContent = '地點載入失敗，請檢查網路連線';
  }
}

function clearFilter() {
  Object.assign(state, { cat: 'all', intent: '', offering: '', deity: '' });
  try { localStorage.removeItem('gg-intent'); } catch { /* ignore */ }
  history.replaceState(null, '', '/miniapp/map.html');
  reload();
}

$('intent').onchange = e => {
  state.intent = e.target.value;
  state.deity = '';
  state.cat = state.intent ? 'temple' : state.cat;
  try { state.intent ? localStorage.setItem('gg-intent', state.intent) : localStorage.removeItem('gg-intent'); } catch { /* ignore */ }
  reload();
};
$('chips').onclick = e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.cat = b.dataset.cat;
  reload();
};
$('clear-filter').onclick = clearFilter;
$('show-list').onclick = () => openSheetMode(true);
$('backdrop').onclick = closeSheet;
$('locate').onclick = () => {
  if (!navigator.geolocation) { $('status').textContent = '裝置不支援定位，目前顯示嘉義市中心。'; return; }
  $('locate').disabled = true;
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude: lat, longitude: lng } = position.coords;
    $('locate').disabled = false;
    if (lat < 23.43 || lat > 23.53 || lng < 120.38 || lng > 120.52) { $('status').textContent = '目前僅提供嘉義市資料，繼續顯示市中心。'; return; }
    Object.assign(state, { lat, lng });
    provider.moveTo(lat, lng);
    provider.showUserLocation(lat, lng);
    $('status').textContent = '已定位 · 周邊 3 公里 · 不保存座標';
    reload();
  }, () => { $('locate').disabled = false; $('status').textContent = '未取得定位，繼續顯示嘉義市中心。'; }, { timeout: 8000 });
};
(async () => {
  try {
    await provider.initialize('map', { center: [state.lat, state.lng], zoom: 14, onTileError: () => { $('tile-error').hidden = false; } });
  } catch { $('tile-error').hidden = false; }
  $('status').textContent = '嘉義市 · 周邊 3 公里 · 不保存座標';
  await reload();
})();

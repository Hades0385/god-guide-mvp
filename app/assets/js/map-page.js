'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const state = { lat: 23.4801, lng: 120.4491, cat: params.has('offering') ? 'shop' : params.has('intent') || params.has('deity') ? 'temple' : 'all', intent: params.get('intent') || '', offering: params.get('offering') || '', deity: params.get('deity') || '' };
const provider = new LeafletProvider();
let revision = 0;
async function reload() {
  const request = ++revision;
  $('intent').value = state.intent;
  document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === state.cat));
  const query = new URLSearchParams({ lat: state.lat, lng: state.lng, radius: 3, intent: state.intent, offering: state.offering });
  try {
    const [nearby, directory] = await Promise.all([apiGet('/api/places/nearby?' + query), apiGet('/api/places?' + new URLSearchParams({ offering: state.offering }))]);
    if (request !== revision) return;
    const places = [...nearby, ...directory.filter(p => p.latitude == null || p.longitude == null)]
      .filter(p => (state.cat === 'all' || (state.cat === 'temple' ? p.type === 'temple' : p.type !== 'temple')) && (!state.deity || p.deity_ids.includes(state.deity)));
    $('filter-label').textContent = state.offering ? `尋找「${state.offering}」店家，供貨請先電話確認。` : state.deity ? '僅顯示奉祀所選神明的宮廟。' : state.intent ? `符合「${state.intent}」的宮廟，以奉祀神明比對。` : '';
    $('places').replaceChildren(); provider.clearMarkers(); $('count').textContent = `${places.length} 個地點`;
    for (const p of places) {
      const article = document.createElement('article'); article.className = 'card';
      const heading = document.createElement('h3'); heading.textContent = p.name;
      const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = p.address + (p.distanceKm != null ? ` · ${p.distanceKm.toFixed(2)} km` : ' · 座標待確認');
      const description = document.createElement('p'); description.textContent = p.recommendationReason || (p.deities?.length ? '奉祀：' + p.deities.map(d => d.name).join('、') : p.description);
      const link = document.createElement('a'); link.className = 'btn secondary'; link.textContent = '查看詳情'; link.href = '/miniapp/place.html?id=' + encodeURIComponent(p.id);
      article.append(heading, meta, description, link); $('places').append(article);
      if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) provider.addMarker({ id:p.id, lat:p.latitude, lng:p.longitude, type:p.type, title:p.name, onClick:() => { article.scrollIntoView({ behavior:'smooth', block:'center' }); } });
    }
    if (!places.length) $('places').textContent = '目前沒有符合的地點，請清除篩選或更換祈求主題。';
  } catch { $('places').textContent = '地點載入失敗，請重新整理。'; }
}
$('intent').onchange = e => { state.intent = e.target.value; state.deity = ''; state.cat = 'temple'; reload(); };
$('chips').onclick = e => { const button = e.target.closest('[data-cat]'); if (button) { state.cat = button.dataset.cat; reload(); } };
$('clear-filter').onclick = () => { Object.assign(state, { cat:'all', intent:'', offering:'', deity:'' }); history.replaceState(null,'','/miniapp/map.html'); reload(); };
$('locate').onclick = () => {
  if (!navigator.geolocation) { $('status').textContent = '裝置不支援定位，目前顯示嘉義市中心。'; return; }
  $('locate').disabled = true;
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude: lat, longitude: lng } = position.coords;
    $('locate').disabled = false;
    if (lat < 23.43 || lat > 23.53 || lng < 120.38 || lng > 120.52) { $('status').textContent = '目前僅提供嘉義市資料，繼續顯示市中心。'; return; }
    Object.assign(state, { lat, lng }); provider.moveTo(lat,lng); provider.showUserLocation(lat,lng);
    $('status').textContent = '已定位 · 周邊 3 公里 · 不保存座標'; reload();
  }, () => { $('locate').disabled = false; $('status').textContent = '未取得定位，繼續顯示嘉義市中心。'; }, { timeout:8000 });
};
(async () => { try { await provider.initialize('map', { center:[state.lat,state.lng], zoom:14, onTileError:() => { $('tile-error').hidden = false; } }); } catch { $('tile-error').hidden = false; } await reload(); })();

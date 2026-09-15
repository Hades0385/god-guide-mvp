'use strict';
// Demo console: each button hits a REAL endpoint (except nav/shop which
// demonstrate client-side navigation / promotion rendering).
// Needs server running (npm run dev). DEMO_MODE=true recommended.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const out = document.getElementById('out');
  const act = btn.dataset.act;
  if (act === 'map') { location.href = '/miniapp/map.html'; return; }
  out.textContent = '執行中…';
  try {
    if (act === 'festival') {
      const r = await apiGet('/api/events/today');
      out.textContent = `今日農曆 ${r.lunarDate}\n` +
        (r.events.map(v => `・${v.event_name}（${v.deity ? v.deity.name : v.deity_id}）`).join('\n') || '（今日無節慶）') +
        (r.mocked ? '\n[DEMO_MODE 固定日期]' : '');
    } else if (act === 'push') {
      const r = await apiPost('/api/demo/simulate', {});
      out.textContent = `Flex altText：${r.pushPreview.altText}\n（正式推播需填 LINE_CHANNEL_ACCESS_TOKEN，見 README「需要你填入」）`;
    } else if (act === 'query') {
      const r = await apiPost('/api/chat', { message: '想求財', deityId: 'tudigong' });
      out.textContent = `intent=${r.intent}（${r.llmStatus}）\n${r.reply.slice(0, 200)}…`;
    } else if (act === 'checklist') {
      const r = await apiPost('/api/checklists', { deityId: 'tudigong' });
      out.textContent = `已產生清單 ${r.id.slice(0, 8)}…，共 ${r.items.length} 項\n` +
        r.items.slice(0, 5).map(i => `□ ${i.label}`).join('\n');
    } else if (act === 'shops') {
      const r = await apiGet('/api/recommendations?intent=' + encodeURIComponent('求財') + '&lat=25.033&lng=121.5654');
      out.textContent = r.map(p => `・${p.name}（${p.type}${p.is_partner ? '【合作】' : ''} ${p.distanceKm != null ? p.distanceKm.toFixed(2) + 'km' : ''}）`).join('\n') || '（無結果）';
    } else if (act === 'nav') {
      out.textContent = '導航連結格式：\nhttps://www.google.com/maps/dir/?api=1&destination=25.0335,121.565\n（地圖頁每家店皆有此連結）';
    } else if (act === 'shop') {
      const r = await apiGet('/api/places/t1');
      out.textContent = `合作店家：${r.name}\n優惠：${r.promotion || '—'}\n電話：${r.phone || '—'}`;
    } else if (act === 'beacon') {
      const r = await apiPost('/api/beacon/enter', { placeId: 't1' });
      out.textContent = `Beacon 模擬：走進 ${r.place.name}\n推播：${r.message}\nFlex altText：${r.pushPreview.altText}`;
    } else if (act === 'prayer') {
      const r = await apiPost('/api/prayer', { name: '王小明', topic: '求財', lang: 'taiwanese', deityId: 'tudigong' });
      out.textContent = `祝禱詞（${r.lang}，${r.llmStatus}）：\n${r.prayer}`;
    }
  } catch (err) {
    out.textContent = '失敗：' + err.message + '\n（server 有啟動嗎？DEMO 按鈕需 DEMO_MODE=true）';
  }
});

'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let selectedDeity = params.get('deity') || 'tudigong';
let currentPlace = null, busy = true;
const history = [];
function addMessage(text, role = 'assistant') {
  const row = document.createElement('div'); row.className = `message ${role}`;
  if (role === 'assistant') row.innerHTML = '<div class="avatar"><i class="bi bi-stars"></i></div>';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  row.append(bubble); $('chat-log').append(row); return row;
}
async function ask(message) {
  if (busy || !message.trim()) return;
  busy = true; $('composer').querySelector('button').disabled = true;
  addMessage(message, 'user'); $('message').value = '';
  const waiting = addMessage('正在整理資料…');
  waiting.scrollIntoView({ block: 'center' });
  try {
    const result = await apiPost('/api/chat', { message, deityId: selectedDeity, placeId: currentPlace?.id, history: history.slice(-10) });
    localStorage.setItem('gg-intent', result.intent);
    waiting.querySelector('.bubble').textContent = result.reply;
    const mode = document.createElement('p'); mode.className = 'meta';
    mode.textContent = result.llmStatus === 'llm' ? 'Gemini 3.5 Flash-Lite' : '知識庫回覆' + (result.fallbackReason === 'unavailable' ? '（AI 暫時無法連線）' : '');
    waiting.querySelector('.bubble').append(mode);
    history.push({ role: 'user', text: message }, { role: 'assistant', text: result.reply });
    if (result.components?.some(c => c.type === 'worship_guide')) renderWorshipGuide($('chat-log'), result.deity, result.checklistDraft, result.sourceNotes);
    else { const sources = document.createElement('p'); sources.className = 'meta'; sources.textContent = '出處：' + result.sourceNotes.join('；'); waiting.querySelector('.bubble').append(sources); }
  } catch { waiting.querySelector('.bubble').textContent = '暫時無法回答，請重試。'; }
  finally { busy = false; $('composer').querySelector('button').disabled = false; }
}
$('composer').onsubmit = event => { event.preventDefault(); ask($('message').value); };
$('quick-replies').onclick = event => { const b = event.target.closest('[data-message]'); if (b) ask(b.dataset.message); };
$('deity').onchange = event => { selectedDeity = event.target.value; history.length = 0; };
(async () => {
  try {
    const deities = await apiGet('/api/deities');
    if (params.get('place')) currentPlace = await apiGet('/api/places/' + encodeURIComponent(params.get('place')));
    for (const deity of deities) { const option = document.createElement('option'); option.value = deity.id; option.textContent = deity.name; $('deity').append(option); }
    $('deity').value = selectedDeity;
    if (!$('deity').value) $('deity').value = selectedDeity = deities[0].id;
    addMessage(currentPlace ? `你正在查看${currentPlace.name}。想了解奉祀神明或參拜方式？` : '你好，想為什麼事情祈求？也可以直接問我需要準備哪些供品。');
    busy = false;
  } catch { addMessage('資料載入失敗，請重新整理。'); }
})();

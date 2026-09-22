'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const CHAT_KEY = 'gg-chat';
const KEEP_ENTRIES = 20;
let selectedDeity = params.get('deity') || 'tudigong';
let currentPlace = null, busy = true;
const history = [];

function readStored() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string') : [];
  } catch { return []; }
}
function saveStored() {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-KEEP_ENTRIES))); }
  catch { /* private mode: keep memory only */ }
}
function clearStored() {
  history.length = 0;
  try { localStorage.removeItem(CHAT_KEY); } catch { /* ignore */ }
}
function greeting() {
  return currentPlace ? `你正在查看${currentPlace.name}。想了解奉祀神明或參拜方式？` : '你好，想為什麼事情祈求？也可以直接問我需要準備哪些供品。';
}
function addMessage(text, role = 'assistant') {
  const row = document.createElement('div'); row.className = `message ${role}`;
  if (role === 'assistant') row.innerHTML = '<div class="avatar"><i class="bi bi-stars"></i></div>';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  row.append(bubble); $('chat-log').append(row); return row;
}
function addAssistantMeta(row, entry) {
  if (entry.mode) { const mode = document.createElement('p'); mode.className = 'meta'; mode.textContent = entry.mode; row.querySelector('.bubble').append(mode); }
  if (entry.sources) { const sources = document.createElement('p'); sources.className = 'meta'; sources.textContent = entry.sources; row.querySelector('.bubble').append(sources); }
}
function renderStored(entries) {
  for (const entry of entries.slice(-KEEP_ENTRIES)) {
    history.push(entry);
    if (entry.role === 'user') addMessage(entry.text, 'user');
    else addAssistantMeta(addMessage(entry.text), entry);
  }
}
async function ask(message) {
  if (busy || !message.trim()) return;
  busy = true; $('composer').querySelector('button').disabled = true;
  addMessage(message, 'user'); $('message').value = '';
  const waiting = addMessage('正在整理資料…');
  waiting.scrollIntoView({ block: 'center' });
  try {
    const payload = history.slice(-10).map(t => ({ role: t.role, text: t.text }));
    const result = await apiPost('/api/chat', { message, deityId: selectedDeity, placeId: currentPlace?.id, history: payload });
    localStorage.setItem('gg-intent', result.intent);
    waiting.querySelector('.bubble').textContent = result.reply;
    const entry = { role: 'assistant', text: result.reply };
    entry.mode = result.llmStatus === 'llm' ? 'Gemini 3.5 Flash-Lite' : '知識庫回覆' + (result.fallbackReason === 'unavailable' ? '（AI 暫時無法連線）' : '');
    const mode = document.createElement('p'); mode.className = 'meta'; mode.textContent = entry.mode;
    waiting.querySelector('.bubble').append(mode);
    history.push({ role: 'user', text: message }, entry);
    if (result.components?.some(c => c.type === 'worship_guide')) renderWorshipGuide($('chat-log'), result.deity, result.checklistDraft, result.sourceNotes);
    else {
      entry.sources = '出處：' + result.sourceNotes.join('；');
      const sources = document.createElement('p'); sources.className = 'meta'; sources.textContent = entry.sources;
      waiting.querySelector('.bubble').append(sources);
    }
    saveStored();
  } catch { waiting.querySelector('.bubble').textContent = '暫時無法回答，請重試。'; }
  finally { busy = false; $('composer').querySelector('button').disabled = false; }
}
function startNewChat() {
  if (busy) return;
  clearStored();
  $('chat-log').replaceChildren();
  addMessage(greeting());
}
$('composer').onsubmit = event => { event.preventDefault(); ask($('message').value); };
$('quick-replies').onclick = event => { const b = event.target.closest('[data-message]'); if (b) ask(b.dataset.message); };
$('deity').onchange = event => { selectedDeity = event.target.value; history.length = 0; clearStored(); };
$('new-chat').onclick = startNewChat;
(async () => {
  try {
    const deities = await apiGet('/api/deities');
    if (params.get('place')) currentPlace = await apiGet('/api/places/' + encodeURIComponent(params.get('place')));
    for (const deity of deities) { const option = document.createElement('option'); option.value = deity.id; option.textContent = deity.name; $('deity').append(option); }
    $('deity').value = selectedDeity;
    if (!$('deity').value) $('deity').value = selectedDeity = deities[0].id;
    const stored = readStored();
    if (stored.length) renderStored(stored);
    else addMessage(greeting());
    busy = false;
  } catch { addMessage('資料載入失敗，請重新整理。'); }
})();

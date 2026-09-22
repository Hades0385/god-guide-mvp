'use strict';
const { detectIntent } = require('./intent');
const { findDeity, buildChecklistDraft, buildReplyText } = require('./knowledge');
const { DISCLAIMER } = require('../line/flex');
const { generate, DEFAULT_MODEL } = require('./gemini');

function buildSystemPrompt(deity, intent, place, deities = []) {
  return [
    '你是神引路祭祀知識助手，使用繁體中文。只能依提供的知識庫回答；不確定請直說。不可編造神蹟、儀式、店家優惠或保證效果。',
    '需要攻略時呼叫 show_worship_guide。工具的 deityId 必須取自提供的神明資料。',
    '請引用 source_notes，並提醒不同地區及宮廟習俗不同。宮廟奉祀資料可能不完整，不要聲稱為完整名單。',
    JSON.stringify({ selectedDeity: deity, intent, place: place ? { name: place.name, description: place.description, deity_ids: place.deity_ids, source: place.source_url } : null, knowledge: deities }),
  ].join('\n');
}

async function handleChat(body = {}, ctx = {}) {
  const { message, deityId, intent, placeId, history = [] } = body || {};
  const { deities = [], places = [], demoMode = false, geminiApiKey = '', geminiModel = DEFAULT_MODEL } = ctx;
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw Object.assign(new Error('請輸入 1 至 2000 字的問題'), { status: 400 });
  if (!Array.isArray(history) || history.length > 12 || history.some(t => !t || !['user', 'assistant'].includes(t.role) || typeof t.text !== 'string' || t.text.length > 5000)) throw Object.assign(new Error('對話紀錄格式錯誤'), { status: 400 });
  const place = placeId ? places.find(p => p.id === placeId && p.type === 'temple') : null;
  if (placeId && !place) throw Object.assign(new Error('找不到宮廟'), { status: 404 });
  const text = message.trim();
  const previousIntent = history.length ? detectIntent(history.map(t => t.text).join('\n')) : '綜合';
  let resolvedIntent = detectIntent(text, intent);
  if (resolvedIntent === '綜合') resolvedIntent = previousIntent;
  const mentioned = deities.find(d => [d.name, ...(d.aliases || [])].some(name => text.includes(name)));
  let deity = mentioned || findDeity(deities, deityId || place?.deity_ids?.[0]);
  let guideDeity = deity;
  let reply = buildReplyText(deity, resolvedIntent);
  if (place) {
    const names = (place.deity_ids || []).map(id => deities.find(d => d.id === id)?.name).filter(Boolean);
    reply = `${place.name}目前已收錄的奉祀神明：${names.join('、')}。\n${place.description}\n${reply}`;
  }
  let showGuide = /攻略|供品|怎麼拜|如何拜|準備|步驟|清單/.test(text) || resolvedIntent !== '綜合';
  let llmStatus = 'mock';
  let fallbackReason = demoMode ? 'demo' : 'missing_key';
  if (geminiApiKey && !demoMode && deity) {
    try {
      const result = await generate({ apiKey: geminiApiKey, model: geminiModel, message: text, history,
        systemPrompt: buildSystemPrompt(deity, resolvedIntent, place, deities), deityIds: deities.map(d => d.id),
        fetchImpl: ctx.fetchImpl });
      if (result.text) reply = result.text;
      showGuide = Boolean(result.guideId);
      guideDeity = deities.find(d => d.id === result.guideId) || deity;
      llmStatus = 'llm'; fallbackReason = null;
    } catch { fallbackReason = 'unavailable'; }
  }
  if (!reply.includes(DISCLAIMER)) reply += '\n' + DISCLAIMER;
  const sourceNotes = [...new Set([...(guideDeity?.source_notes || []), ...(place?.source_url ? [place.source_url] : [])])];
  return { intent: resolvedIntent, deity: guideDeity, reply, sourceNotes, place: place ? { id: place.id, name: place.name } : null,
    checklistDraft: buildChecklistDraft(guideDeity, resolvedIntent),
    components: showGuide && guideDeity ? [{ type: 'worship_guide', deityId: guideDeity.id }] : [],
    quickReplies: ['求財', '事業', '平安', '綜合'], llmStatus, fallbackReason, model: geminiModel };
}
module.exports = { handleChat, buildSystemPrompt };

'use strict';
const { detectIntent } = require('./intent');
const { findDeity, buildChecklistDraft, buildReplyText } = require('./knowledge');
const { DISCLAIMER } = require('../line/flex');
const { generate, DEFAULT_MODEL } = require('./gemini');

function buildSystemPrompt(deity, intent, place, deities = []) {
  return [
    '你是神引路祭祀知識助手，使用繁體中文親切回答。',
    '以下知識庫只是參考資料，不是回答範圍的限制：你可以自由發揮、舉例和延伸；知識庫沒收錄的主題（如學業、感情、健康等）也請直接回答，不用說不知道。',
    '每次回答都要包含：針對問題的直接回答、一段簡短祝禱文（標示為「祝禱文參考」）、可追問的方向。',
    '重要：必須用文字完整回答，不可以只呼叫工具不回話；需要攻略時，在文字回答之後再呼叫 show_worship_guide。工具的 deityId 必須取自提供的神明資料。',
    '只有兩件事要謹慎：不要編造具體店家名稱、地址、價格或優惠（不知道就直說）；不要保證靈驗或效果。',
    '有用到知識庫內容時請引用 source_notes，並提醒不同地區及宮廟習俗不同。宮廟奉祀資料可能不完整，不要聲稱為完整名單。',
    JSON.stringify({ selectedDeity: deity, intent, place: place ? { name: place.name, description: place.description, deity_ids: place.deity_ids, source: place.source_url } : null, knowledge: deities }),
  ].join('\n');
}

async function handleChat(body = {}, ctx = {}) {
  const { message, deityId, intent, placeId, history = [] } = body || {};
  const { deities = [], places = [], demoMode = false, geminiApiKey = '', geminiModel = DEFAULT_MODEL, geminiTimeoutMs = 60000 } = ctx;
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
        timeoutMs: geminiTimeoutMs, fetchImpl: ctx.fetchImpl });
      // Tool-only replies (no text) would show the mock template under the
      // Gemini label — misleading, so treat them as a fallback instead.
      if (!result.text) throw Object.assign(new Error('Gemini returned no text'), { fallback: 'empty' });
      reply = result.text;
      showGuide = Boolean(result.guideId);
      guideDeity = deities.find(d => d.id === result.guideId) || deity;
      llmStatus = 'llm'; fallbackReason = null;
    } catch (err) {
      fallbackReason = err && err.fallback ? err.fallback : 'unavailable';
      // Log HTTP status only (no key material) so terminal shows the cause.
      console.error(JSON.stringify({ event: 'chat.gemini_failed', reason: fallbackReason, detail: err && err.message }));
    }
  }
  if (!reply.includes(DISCLAIMER)) reply += '\n' + DISCLAIMER;
  const sourceNotes = [...new Set([...(guideDeity?.source_notes || []), ...(place?.source_url ? [place.source_url] : [])])];
  return { intent: resolvedIntent, deity: guideDeity, reply, sourceNotes, place: place ? { id: place.id, name: place.name } : null,
    checklistDraft: buildChecklistDraft(guideDeity, resolvedIntent),
    components: showGuide && guideDeity ? [{ type: 'worship_guide', deityId: guideDeity.id }] : [],
    quickReplies: ['求財', '事業', '平安', '綜合'], llmStatus, fallbackReason, model: geminiModel };
}
module.exports = { handleChat, buildSystemPrompt };

'use strict';

// Chat service: Intent -> Knowledge Base -> Prompt -> LLM (or mock) -> Safety check.
// MVP: rule-based reply from JSON knowledge. If LLM_API_KEY is set and not
// DEMO_MODE, attempt OpenAI chat completion with knowledge context via native
// fetch; any failure falls back to the rule-based reply (never 500 the chat).

const { detectIntent } = require('./intent');
const { findDeity, buildChecklistDraft, buildReplyText } = require('./knowledge');
const { DISCLAIMER } = require('../line/flex');

function buildSystemPrompt(deity, intent) {
  return [
    '你是「神引路」傳統祭祀知識整理助手，只能引用知識庫內容回答，不可編造民俗。',
    `神明：${deity ? `${deity.name}（${(deity.aliases || []).join('/')}），農曆${deity.lunar_birthday || ''}` : '未知'}`,
    `祈求主題：${intent}`,
    `知識庫供品：${deity ? (deity.common_offerings || []).join('、') : ''}`,
    `知識庫步驟：${deity ? (deity.ritual_steps || []).join('＞') : ''}`,
    `禁忌：${deity ? (deity.taboos || []).join('；') : ''}`,
    `必須引用出處：${deity ? (deity.source_notes || []).join('；') : ''}`,
    '結尾必須附上地域差異聲明，不做權威或法律判斷。',
  ].join('\n');
}

async function tryLlmReply({ systemPrompt, userMessage, apiKey, model }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}`);
  const data = await r.json();
  const text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!text || !text.trim()) throw new Error('LLM empty');
  return text.trim();
}

function safetyCheck(text, deity) {
  let out = String(text || '');
  if (!out.includes(DISCLAIMER)) out += `\n${DISCLAIMER}`;
  return {
    text: out,
    sourceNotes: (deity && deity.source_notes) || [],
  };
}

async function handleChat({ message, deityId, intent }, ctx = {}) {
  const { deities = [], demoMode = false, llmApiKey = '', llmModel = 'gpt-4o-mini' } = ctx;
  const text = String(message || '').trim();
  if (!text) {
    const err = new Error('message is required');
    err.status = 400;
    throw err;
  }
  const resolvedIntent = detectIntent(text, intent);
  const deity = findDeity(deities, deityId);
  const systemPrompt = deity ? buildSystemPrompt(deity, resolvedIntent) : '';
  let reply;
  let llmStatus = 'mock';
  if (llmApiKey && !demoMode && deity) {
    try {
      reply = await tryLlmReply({ systemPrompt, userMessage: text, apiKey: llmApiKey, model: llmModel });
      llmStatus = 'llm';
    } catch {
      reply = buildReplyText(deity, resolvedIntent);
    }
  } else {
    reply = buildReplyText(deity, resolvedIntent);
  }
  const checked = safetyCheck(reply, deity);
  return {
    intent: resolvedIntent,
    deity,
    reply: checked.text,
    sourceNotes: checked.sourceNotes,
    checklistDraft: buildChecklistDraft(deity, resolvedIntent),
    quickReplies: ['求財', '事業', '平安', '綜合'],
    llmStatus,
  };
}

module.exports = { handleChat, buildSystemPrompt };

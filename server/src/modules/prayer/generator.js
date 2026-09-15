'use strict';

// AI 祝禱小助手 (concept demo).
// Rule-based templates from knowledge base (name + topic + deity).
// If LLM_API_KEY is set and not DEMO_MODE, try LLM polish; else template.
// Never invent folklore: only deity name / topics from JSON are used.

const { VALID_INTENTS } = require('../chat/intent');
const { findDeity } = require('../chat/knowledge');

const LANGS = ['mandarin', 'taiwanese'];

const TOPIC_WISH = {
  '求財': { mandarin: '財運亨通、生意興隆', taiwanese: '趁錢、有好頭路、生理興旺' },
  '事業': { mandarin: '事業順利、步步高升', taiwanese: '頭路順序、逐日進步' },
  '平安': { mandarin: '闔家平安、身體健康', taiwanese: '全家平安、身體勇健' },
  '綜合': { mandarin: '心想事成、萬事如意', taiwanese: '心想事成、逐項如意' },
};

function sanitizeName(name) {
  const s = String(name || '').trim().slice(0, 20);
  if (!s) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }
  return s;
}

function buildPrayer({ name, topic, lang, deity }) {
  const clean = sanitizeName(name);
  const t = VALID_INTENTS.includes(topic) ? topic : '綜合';
  const l = LANGS.includes(lang) ? lang : 'mandarin';
  const god = deity ? deity.name : '眾神';
  const wish = (TOPIC_WISH[t] || TOPIC_WISH['綜合'])[l];
  if (l === 'taiwanese') {
    return `今仔日，信士 ${clean} 誠心誠意，來到 ${god} 神明頭前參拜。\n` +
      `弟子所求的是「${t}」，向望 ${wish}。\n` +
      `祈求 ${god} 保庇弟子出入平安、逢凶化吉，所求如願。\n` +
      `弟子一定會時常來參拜、多做善事。叩謝神恩。`;
  }
  return `今日，信士 ${clean} 誠心誠意，於 ${god} 神前參拜。\n` +
    `所求之事為「${t}」，惟願 ${wish}。\n` +
    `祈求 ${god} 庇佑出入平安、逢凶化吉，所求如願。\n` +
    `日後必常來參拜、多行善事。叩謝神恩。`;
}

async function tryLlmPolish({ systemHint, draft, apiKey, model }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemHint },
        { role: 'user', content: `請潤飾以下祝禱詞，保持原意與人名，不添加民俗內容：\n${draft}` },
      ],
      max_tokens: 400,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}`);
  const data = await r.json();
  const text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  if (!text || !text.trim()) throw new Error('LLM empty');
  return text.trim();
}

async function handlePrayer({ name, topic, lang, deityId }, ctx = {}) {
  const { deities = [], demoMode = false, llmApiKey = '', llmModel = 'gpt-4o-mini' } = ctx;
  const clean = sanitizeName(name);
  const t = VALID_INTENTS.includes(topic) ? topic : '綜合';
  const l = LANGS.includes(lang) ? lang : 'mandarin';
  const deity = findDeity(deities, deityId);
  const draft = buildPrayer({ name: clean, topic: t, lang: l, deity });
  let text = draft;
  let llmStatus = 'mock';
  if (llmApiKey && !demoMode) {
    try {
      text = await tryLlmPolish({
        systemHint: '你是祝禱詞潤飾助手，只能潤飾文字，不可編造民俗知識。',
        draft, apiKey: llmApiKey, model: llmModel,
      });
      llmStatus = 'llm';
    } catch { text = draft; }
  }
  return {
    name: clean, topic: t, lang: l,
    deity: deity ? { id: deity.id, name: deity.name } : null,
    prayer: text,
    sourceNotes: (deity && deity.source_notes) || [],
    llmStatus,
  };
}

module.exports = { handlePrayer, buildPrayer, LANGS };

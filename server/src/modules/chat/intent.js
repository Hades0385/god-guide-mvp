'use strict';

// Intent detection: keyword rule-based for MVP (plan.md:6, plan.md:11).
// Valid intents: 求財 / 事業 / 平安 / 綜合. Explicit param wins if valid.

const VALID = ['求財', '事業', '平安', '綜合'];

const RULES = [
  { intent: '求財', kws: ['財', '錢', '發', '中獎', '業績', '加薪', '投資'] },
  { intent: '事業', kws: ['事業', '工作', '升', '職', '考試', '面試', '創業', '學業'] },
  { intent: '平安', kws: ['平安', '健康', '家庭', '保佑', '消災', '順利', '闔家'] },
];

function detectIntent(message, explicit) {
  if (explicit && VALID.includes(explicit)) return explicit;
  const text = String(message || '');
  for (const { intent, kws } of RULES) {
    if (kws.some((k) => text.includes(k))) return intent;
  }
  return '綜合';
}

module.exports = { detectIntent, VALID_INTENTS: VALID };

'use strict';

// Knowledge lookup over deities.json (plan.md:5, plan.md:6).
// Mock fallback only cites fields + source_notes (never invent folklore).
// LLM path (service.js system prompt) may elaborate within the soft tier.

const { DISCLAIMER } = require('../line/flex');

function findDeity(deities, deityId) {
  if (deityId) {
    const d = (deities || []).find((x) => x.id === deityId);
    if (d) return d;
  }
  return (deities || []).find((x) => x.id === 'tudigong') || (deities || [])[0] || null;
}

// Draft is split by design (frontend renders differently):
// - offerings: checkable shopping list (persistable via POST /api/checklists)
// - guide: ordered ritual steps, shown as a stepper, never checkboxes.
function buildChecklistDraft(deity, intent) {
  void intent;
  if (!deity) return { offerings: [], guide: [] };
  return {
    offerings: (deity.common_offerings || []).map((label, i) => ({
      id: `offer-${i + 1}`,
      label,
      category: 'offering',
    })),
    guide: (deity.ritual_steps || []).map((label, i) => ({
      id: `ritual-${i + 1}`,
      label,
      step: i + 1,
    })),
  };
}

function buildReplyText(deity, intent) {
  if (!deity) return '知識庫尚無資料，請稍後再試。';
  const topics = (deity.prayer_topics || []).join('、');
  const offerings = (deity.common_offerings || []).slice(0, 5).join('、');
  const taboos = (deity.taboos || []).join('；');
  const lines = [
    `今天想拜${deity.name}（${deity.lunar_birthday || ''}），為你的「${intent}」準備了一份簡易祭拜清單：`,
    offerings ? `供品建議：${offerings}。` : '',
    taboos ? `提醒：${taboos}。` : '',
    topics ? `此尊神明常見祈求：${topics}。` : '',
    DISCLAIMER,
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = { findDeity, buildChecklistDraft, buildReplyText };

'use strict';

// Webhook event router (plan.md:7 Phase 4 skeleton).
// Returns a list of intended replies; MVP logs instead of calling LINE API
// (wire-up happens once LINE_CHANNEL_ACCESS_TOKEN is set).

const { buildFestivalFlex } = require('./flex');

function routeLineEvent(event, ctx = {}) {
  const { deities = [], events = [], miniappUrl = '' } = ctx;
  if (!event || !event.type) return [{ action: 'ignore', reason: 'empty event' }];

  if (event.type === 'follow') {
    return [{ action: 'reply', messages: [{ type: 'text', text: '歡迎加入神引路！點 Rich Menu 開始祭拜攻略。' }] }];
  }

  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const text = event.message.text || '';
    if (/開始|攻略|拜/.test(text)) {
      const deity = deities.find((d) => d.id === 'tudigong') || deities[0];
      const ev = events.find((e) => e.deity_id === (deity && deity.id)) || events[0];
      return [{
        action: 'reply',
        messages: [
          buildFestivalFlex(deity, ev, miniappUrl),
          {
            type: 'text',
            text: '你主要想祈求什麼？',
            quickReply: {
              items: ['求財', '事業', '闔家平安', '綜合'].map((label) => ({
                type: 'action',
                action: { type: 'message', label, text: label },
              })),
            },
          },
        ],
      }];
    }
    return [{ action: 'reply', messages: [{ type: 'text', text: `收到「${text}」。請點「開始祭拜攻略」繼續。` }] }];
  }

  if (event.type === 'postback') {
    return [{ action: 'reply', messages: [{ type: 'text', text: '已收到你的選擇，祭拜清單更新中。' }] }];
  }

  return [{ action: 'ignore', reason: `unsupported type ${event.type}` }];
}

module.exports = { routeLineEvent };

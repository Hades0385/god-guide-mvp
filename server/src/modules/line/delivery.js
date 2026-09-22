'use strict';
const { routeLineEvent } = require('./webhook');
const { handleChat } = require('../chat/service');

async function processLineEvent(event, ctx, fetchImpl = fetch) {
  let replies = routeLineEvent(event, ctx);
  if (event.type === 'message' && event.message?.type === 'text') {
    const answer = await handleChat({ message: event.message.text }, ctx);
    const sources = answer.sourceNotes.length ? `\n來源：${answer.sourceNotes.join('；')}` : '';
    replies = [{ action: 'reply', messages: [{ type: 'text', text: (answer.reply + sources).slice(0, 4500),
      quickReply: { items: [
        { type: 'action', action: { type: 'uri', label: '開啟祭拜攻略', uri: `${ctx.baseUrl}/miniapp/encyclopedia.html?id=${answer.deity.id}` } },
        { type: 'action', action: { type: 'uri', label: '找宮廟', uri: `${ctx.baseUrl}/miniapp/map.html?deity=${answer.deity.id}` } },
      ] },
    }] }];
  }
  const messages = replies.filter(r => r.action === 'reply').flatMap(r => r.messages).slice(0, 5);
  if (!ctx.token || !event.replyToken || !messages.length) return { sent: false, preview: replies };
  const response = await fetchImpl('https://api.line.me/v2/bot/message/reply', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { authorization: `Bearer ${ctx.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ replyToken: event.replyToken, messages }),
  });
  if (!response.ok) throw new Error(`LINE reply HTTP ${response.status}`);
  return { sent: true };
}
module.exports = { processLineEvent };

'use strict';

// Flex Message builders (plan.md:7). Pure functions returning LINE message JSON.
// No network calls here — sending is done by caller with LINE_CHANNEL_ACCESS_TOKEN.

const DISCLAIMER = '不同地區 / 宮廟習俗不同，以下僅供參考，細節請依該宮廟為準。';

function buildFestivalFlex(deity, event, miniappUrl) {
  const name = (deity && deity.name) || '神明';
  const eventName = (event && event.event_name) || '祭祀日';
  const topics = ((deity && deity.prayer_topics) || []).join('、') || '祈福';
  return {
    type: 'flex',
    altText: `神引路：今天是${name}${eventName}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '神引路', weight: 'bold', color: '#8B0000', size: 'sm' },
          { type: 'text', text: `今天是${name}${eventName}`, weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: `求財、事業、平安 — ${topics}`, size: 'sm', color: '#555555', wrap: true },
          { type: 'text', text: DISCLAIMER, size: 'xs', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#8B0000',
            action: { type: 'uri', label: '開始祭拜攻略', uri: miniappUrl || 'https://example.com/miniapp/index.html' },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: '附近哪裡可以拜？', uri: miniappUrl ? miniappUrl.replace('index.html', 'map.html') : 'https://example.com/miniapp/map.html' },
          },
        ],
      },
    },
  };
}

function buildChecklistFlex(deity, checklistUrl) {
  const items = ((deity && deity.common_offerings) || []).slice(0, 5);
  return {
    type: 'flex',
    altText: `神引路：${(deity && deity.name) || ''}祭拜清單`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `${(deity && deity.name) || ''}祭拜清單`, weight: 'bold', size: 'lg' },
          ...items.map((label) => ({ type: 'text', text: `□ ${label}`, size: 'sm', wrap: true })),
          { type: 'text', text: DISCLAIMER, size: 'xs', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#8B0000',
            action: { type: 'uri', label: '開始尋找附近店家', uri: checklistUrl || 'https://example.com/miniapp/map.html' },
          },
        ],
      },
    },
  };
}

// Beacon / coupon push (concept demo): "you walked into ..." style card.
function buildCouponFlex(place, miniappUrl) {
  const promo = (place && place.promotion) || '合作店家優惠';
  return {
    type: 'flex',
    altText: `神引路：${place ? place.name : ''} 有優惠`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '你走進合作商圈了！', weight: 'bold', color: '#8B0000', size: 'sm' },
          { type: 'text', text: place ? place.name : '', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: `🎁 ${promo}`, size: 'sm', color: '#555555', wrap: true },
          { type: 'text', text: '消費集點可兌換合作店家折扣券', size: 'xs', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#8B0000',
            action: { type: 'uri', label: '開啟集點中心', uri: miniappUrl || 'https://example.com/miniapp/charms.html' },
          },
        ],
      },
    },
  };
}

module.exports = { buildFestivalFlex, buildChecklistFlex, buildCouponFlex, DISCLAIMER };

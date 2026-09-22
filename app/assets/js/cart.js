'use strict';
const Cart = {
  read() {
    try { const data = JSON.parse(localStorage.getItem('gg-cart') || '[]'); return Array.isArray(data) ? data.filter(x => x && typeof x.id === 'string' && Number.isInteger(x.qty) && x.qty > 0 && x.qty <= 20).map(x => ({ id:x.id, qty:x.qty })) : []; }
    catch { return []; }
  },
  write(items) { localStorage.setItem('gg-cart', JSON.stringify(items)); },
  resolve(items, sets) { return items.map(item => { const set = sets.find(s => s.id === item.id); return set ? { ...set, qty:item.qty } : null; }).filter(Boolean); },
  total(items) { return items.reduce((sum, i) => sum + i.price * i.qty, 0); },
};

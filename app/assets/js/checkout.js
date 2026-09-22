'use strict';
const $ = id => document.getElementById(id);
let sets = [], cart = [], busy = false;
let requestId = sessionStorage.getItem('gg-order-request') || crypto.randomUUID();
sessionStorage.setItem('gg-order-request', requestId);
function render() {
  $('cart-items').replaceChildren();
  $('subtotal').textContent = $('total').textContent = `NT$${Cart.total(cart)}`;
  $('submit-order').disabled = busy || !cart.length;
  if (!cart.length) { $('cart-items').textContent = '購物車是空的，請返回購物。'; return; }
  for (const item of cart) {
    const row = document.createElement('div'); row.className = 'order-line';
    const name = document.createElement('strong'); name.textContent = item.name;
    const quantity = document.createElement('div'); quantity.className = 'qty-control';
    for (const delta of [-1, 0, 1]) {
      if (!delta) { const count = document.createElement('span'); count.textContent = item.qty; quantity.append(count); continue; }
      const button = document.createElement('button'); button.textContent = delta < 0 ? '-' : '+'; button.setAttribute('aria-label', delta < 0 ? '減少數量' : '增加數量'); button.disabled = busy || delta > 0 && item.qty >= 20;
      button.onclick = () => { item.qty += delta; cart = cart.filter(i => i.qty); Cart.write(cart); requestId = crypto.randomUUID(); sessionStorage.setItem('gg-order-request',requestId); render(); }; quantity.append(button);
    }
    const amount = document.createElement('span'); amount.textContent = `NT$${item.price * item.qty}`;
    row.append(name, quantity, amount); $('cart-items').append(row);
  }
}
$('submit-order').onclick = async () => {
  if (busy || !cart.length) return;
  const customer = { name:$('name').value.trim(), phone:$('phone').value.trim() };
  if (!customer.name || customer.name.length > 50 || !/^09\d{8}$/.test(customer.phone)) { $('error').textContent = '請填寫姓名與 10 碼手機號碼。'; return; }
  busy = true; render(); $('error').textContent = '';
  try {
    const result = await apiPost('/api/orders', { requestId, userIdHash:MiniApp.uid(), items:cart.map(i=>({id:i.id,qty:i.qty})), customer, pickup:'store', payment:document.querySelector('[name=payment]:checked').value });
    Cart.write([]); sessionStorage.removeItem('gg-order-request');
    $('checkout-view').hidden = true; $('checkout-view').style.display = 'none'; $('success-view').style.display = 'block';
    $('order-number').textContent = `訂單 ${result.id} · NT$${result.total} · ${result.status === 'demo_paid' ? '模擬付款完成，獲得 ' + result.earnedPoints + ' 點' : '待取貨付款，尚未集點'}`;
    window.scrollTo(0,0);
  } catch (error) { $('error').textContent = '訂單未完成：' + error.message; }
  finally { busy = false; render(); }
};
(async () => { try { sets = await apiGet('/api/sets'); cart = Cart.resolve(Cart.read(),sets); Cart.write(cart); render(); } catch { $('error').textContent = '商品載入失敗，請重新整理。'; $('submit-order').disabled = true; } })();

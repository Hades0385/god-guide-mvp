'use strict';

// Optional local visual check. Set PLAYWRIGHT_MODULE to a Playwright package
// path and SCREENSHOT_DIR to keep screenshots outside the repository.
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (!process.env.PLAYWRIGHT_MODULE) throw new Error('PLAYWRIGHT_MODULE is required');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
  const outputDir = process.env.SCREENSHOT_DIR || path.join(process.cwd(), '.screenshots');
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  const checks = [
    ['home', '/miniapp/home.html'],
    ['chat', '/miniapp/index.html'],
    ['map', '/miniapp/map.html'],
    ['place', '/miniapp/place.html?id=chiayi-chenghuang'],
    ['shop', '/miniapp/shop.html'],
    ['encyclopedia', '/miniapp/encyclopedia.html?id=chenghuang'],
    ['points', '/miniapp/charms.html'],
    ['line-menu', '/miniapp/line-menu.html'],
    ['more', '/miniapp/more.html'],
  ];
  const results = [];
  for (const [name, url] of checks) {
    await page.goto(`http://localhost:3000${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(name === 'map' ? 1800 : 500);
    const metrics = await page.evaluate(() => ({
      title: document.title,
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      text: document.body.innerText.slice(0, 120),
    }));
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: name !== 'map' });
    results.push({ name, ...metrics, overflow: metrics.width > metrics.viewport });
  }

  await page.goto('http://localhost:3000/miniapp/shop.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-add]');
  await page.click('[data-add]');
  await page.goto('http://localhost:3000/miniapp/checkout.html', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(outputDir, 'checkout.png'), fullPage: true });
  results.push({ name: 'checkout', hasOrder: await page.locator('#cart-items').innerText() });

  await page.goto('http://localhost:3000/miniapp/index.html?place=chiayi-chenghuang&deity=chenghuang', { waitUntil: 'domcontentloaded' });
  await page.fill('#message', '我想求平安');
  await page.click('#composer button');
  await page.waitForSelector('.strategy');
  await page.screenshot({ path: path.join(outputDir, 'chat-strategy.png'), fullPage: true });
  results.push({ name: 'chat-strategy', strategy: await page.locator('.strategy summary').innerText() });

  await page.goto('http://localhost:3000/miniapp/checkout.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('gg-cart', JSON.stringify([{ id:'set-fruit-1', name:'鮮果敬神組', price:499, qty:1, shopId:'chiayi-whole-fruits', shopName:'日日好菓' }])));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.fill('#name', '測試使用者');
  await page.fill('#phone', '0912345678');
  await page.click('#submit-order');
  await page.waitForSelector('#success-view', { state: 'visible' });
  await page.screenshot({ path: path.join(outputDir, 'checkout-success.png'), fullPage: true });
  results.push({ name: 'checkout-success', text: await page.locator('#success-view').innerText() });

  await browser.close();
  console.log(JSON.stringify({ outputDir, results, errors }, null, 2));
  if (errors.length || results.some((result) => result.overflow)) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

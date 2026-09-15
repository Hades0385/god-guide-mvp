# 神引路 God's Guide — MVP

LINE Mini App (pure HTML/CSS/JS) + Node.js (native http + lunar-javascript) + JSON files.

## Quick start

```powershell
Copy-Item .env.example .env
npm install
npm run dev   # http://localhost:3000/miniapp/index.html
npm test      # 20 tests: distance, calendar, webhook, chat, checklist
```

Set `DEMO_MODE=true` in `.env` for fixed Tudigong festival (lunar 二月初二) + mock GPS.

## 需要你填入（接 LINE 真實服務前）

> 沒填也能跑：本地 `npm run dev` + Demo 控制台全流程可走。以下只在要接真實 LINE / LLM 時填。

| 變數 | 去哪取得 | 沒填會怎樣 |
|------|----------|------------|
| `LINE_CHANNEL_SECRET` | [LINE Developers Console](https://developers.line.biz/console/) → 建 Messaging API Channel → Basic settings → Channel secret | webhook 不驗簽（僅開發方便，正式環境必須填） |
| `LINE_CHANNEL_ACCESS_TOKEN` | 同一 Channel → Messaging API 分頁 → Channel access token → Issue | 只收得到事件、發不出推播/回覆（目前回覆僅 log） |
| `MINIAPP_CHANNEL_ID` | 另建 Service Channel（Mini App 類型）；MVP 可先留空 | 地圖頁改用瀏覽器 GPS 定位，功能照常用 |
| `LLM_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) → Create secret key | 自動用內建 mock 回覆（知識庫模板，零費用） |
| `DEMO_MODE` | 自己填 `true`（競賽現場用） | 用真實日期判斷節慶 |

填完後：

```powershell
# 1. 本地暴露 HTTPS（LINE 只接受 https webhook）
ngrok http 3000
# 2. 把 https://xxx.ngrok.io/api/line/webhook 貼到 Channel 的 Webhook URL 並 Verify
# 3. Rich Menu 加一個「開啟 Mini App」按鈕，連結到你的 Mini App URL（或先用 https://xxx.ngrok.io/miniapp/home.html 測試）
```

## 競賽概念 Demo（外部串接皆模擬）

| 概念 | Demo 入口 | 正式接法（得獎後再填） |
|------|----------|----------------------|
| AI 祝禱小助手 | 諮詢頁 §6：輸入姓名＋台語 → 生成＋分享 | 填 `LLM_API_KEY` 即自動改走 LLM 潤飾 |
| 智慧零售＋LINE Pay | 購物頁：套組（店家＋內容物）→ 綠色 LINE Pay 模擬結帳 → 集點中心看餘額 | 串 LINE Pay API（`LINE_PAY_CHANNEL_ID/SECRET`），把 `pay-confirm` 改打真正的 payment request |
| Flex 社群分享 | 祝禱區「分享」鈕：LIFF `shareTargetPicker` → 系統分享 → 剪貼簿三級 fallback | Mini App 改用 LIFF 時載入 `liff SDK` 並 `liff.init`，第一級自動生效 |
| Beacon 進店推播 | Demo 台「模擬 Beacon 進店」＋ `POST /api/beacon/enter` | 買 LINE Beacon 硬體 → 取 `BEACON_HWID` → 在 LINE 後台綁定 → webhook 收 `beacon` 事件後改打真推播（目前僅回傳 Flex 預覽） |
| 點數經濟閉環 | 集點中心：消費集點（NT$10=1點）→ 50點兌平安符／30點兌折扣券 | 點數規則（`AMULET_COST/COUPON_COST`）與核銷碼對接店家 POS |

## App 頁面（6 Tab + 1 子頁）

- `miniapp/home.html` 🏠 — 今日祭拜神明宮廟卡 + 供品（每項「尋找店家」直達篩選地圖）+ 推薦宮廟 + 集點入口（`/` 轉址至此）
- `miniapp/index.html` 💬 — 諮詢：選神明 → intent → AI 回覆 → **供品清單**（勾選/儲存，每項「哪裡買」按鈕）＋ **祭拜流程**（步驟指引）＋ **AI 祝禱小助手**（姓名＋國語/台語＋分享給家人）
- `miniapp/map.html` 🗺️ — 全屏地圖：分類 chips（全部/宮廟/供品店）＋四色標記（紅宮廟/綠供品/橘金紙/粉花店，金框＝合作）＋底部彈窗＋供品篩選（`?offering=` 顯示可買店家＋清除）
- `miniapp/shop.html` 🛒 — **購買**：祭拜套組列表（販售店家＋內容物＋價格）＋ LINE Pay 模擬結帳（結帳即集點）
- `miniapp/charms.html` 🪙 — **集點中心**：餘額＋兌換平安符/折扣券＋持有物＋紀錄（購買已獨立至購物頁）
- `miniapp/place.html?id=` — 店家詳情**子頁**（店內商品價目＋導航/集點；有返回鍵 ← 地圖）
- `miniapp/demo.html` 🧰 — Demo 控制台（10 按鈕：含 Beacon 進店模擬、祝禱詞生成）

## Layout

- `app/assets/js/layout.js` — 頂欄 + Tab Bar；返回鍵僅子頁（`data-back`）顯示
- `server/src/server.js` — static host + `/api/*`
- `server/data/*.json` — deities, events, places, products (seed); checklists/conversations/amulets/points/coupons are gitignored runtime files

## API (Phase 1–4)

- `POST /api/chat {message, deityId?, intent?}` → `{ intent, deity, reply, sourceNotes, checklistDraft: {offerings[], guide[]}, quickReplies, llmStatus }`; rule-based from JSON knowledge + disclaimer; tries OpenAI only if `LLM_API_KEY` set and not DEMO, falls back to mock
- `POST /api/checklists {deityId, userIdHash?, title?}` → persisted checklist (**供品** only, 201); `PATCH /api/checklists/:id/items/:itemId {checked}` → toggle
- `GET /api/amulets?userIdHash=` → list; `POST /api/amulets/collect {placeId}` → 合作店家發符 (201; 非合作 400); `POST /api/amulets/:id/redeem {placeId}` → 合作宮廟兌換 (重複 409, 非宮廟 400)
- `POST /api/prayer {name, topic?, lang? (mandarin|taiwanese), deityId?}` → 客製祝禱詞（mock 模板，有 Key 才走 LLM）
- `GET /api/points?userIdHash=` → `{balance, ledger}`; `POST /api/points/earn {placeId, amountNt?}` → 合作零售消費集點 (NT$10=1點); `POST /api/points/redeem {kind: amulet(50點)|coupon(30點), placeId}` → 兌平安符/折扣券
- `GET /api/coupons?userIdHash=` → 折扣券列表
- `POST /api/beacon/enter {placeId}` → DEMO 限定：模擬進店推播（Flex 優惠卡預覽）
- `GET /api/recommendations?intent&lat&lng` → rule-based top 10 (`partner > distance > intent`), no ML

## API (Phase 1–3)

- `GET /api/health` → `{ ok, demoMode }`
- `GET /api/deities`, `GET /api/deities/:id`
- `GET /api/places/nearby?lat&lng&radius=3&intent&type&offering=` → filtered + sorted (`partner > distance > intent`)；`offering=鮮花` 只回有賣該供品的店（經 `products.json` 反查，宮廟除外）
- `GET /api/places/:id/products` → 店內商品價目（宮廟回 `[]`）
- `GET /api/sets?shopId=` → 祭拜套組（含販售店家資訊與內容物清單）
- `GET /api/places/:id`
- `GET /api/events/today` → `{ solarDate, lunarDate, events (with deity), festivalToday, mocked }`
- `POST /api/line/webhook` → LINE verify (`x-line-signature` HMAC) + routes follow/message/postback; without `LINE_CHANNEL_SECRET` verification is skipped (dev only)
- `POST /api/demo/simulate` → DEMO_MODE only; festival + Flex push preview + mock GPS

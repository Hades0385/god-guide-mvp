# 神引路 God's Guide — MVP

LINE Mini App (pure HTML/CSS/JS) + Node.js (native http + lunar-javascript) + JSON files.

## Quick start

```powershell
Copy-Item .env.example .env
npm install
npm run dev   # http://localhost:3000/miniapp/index.html
npm test      # unit + integration tests
```

Set `DEMO_MODE=true` in `.env` for fixed Tudigong festival (lunar 二月初二) + mock GPS.

## 需要你填入（接 LINE 真實服務前）

> 沒填也能跑：本地 `npm run dev` + Demo 控制台全流程可走。以下只在要接真實 LINE / LLM 時填。

| 變數 | 去哪取得 | 沒填會怎樣 |
|------|----------|------------|
| `LINE_CHANNEL_SECRET` | [LINE Developers Console](https://developers.line.biz/console/) → 建 Messaging API Channel → Basic settings → Channel secret | webhook 不驗簽（僅開發方便，正式環境必須填） |
| `LINE_CHANNEL_ACCESS_TOKEN` | 同一 Channel → Messaging API 分頁 → Channel access token → Issue | 只收得到事件、發不出推播/回覆（目前回覆僅 log） |
| `MINIAPP_CHANNEL_ID` | 另建 Service Channel（Mini App 類型）；MVP 可先留空 | 地圖頁改用瀏覽器 GPS 定位，功能照常用 |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → Create API key | 自動用內建 mock 回覆（知識庫模板，零費用） |
| `GEMINI_MODEL` | AI Studio 上的模型名稱（預設 `gemini-3.5-flash-lite`） | 用預設模型 |
| `GEMINI_TIMEOUT_MS` | 自己填毫秒數（預設 `60000`）；回應慢但後台有成功時調大 | 20 秒→改為預設 60 秒超時，超時自動降級回 mock |
| `DEMO_MODE` | 自己填 `true`（競賽現場用） | 用真實日期判斷節慶；`true` 時強制 mock、不打 Gemini |

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
| AI 問事 | 對話式問答，AI 回覆可展開供品與祭拜步驟元件 | 填 `GEMINI_API_KEY` 即自動改走 Gemini（知識庫僅供參考，每次附祝禱文） |
| 智慧零售＋LINE Pay | 購物頁：套組（店家＋內容物）→ 綠色 LINE Pay 模擬結帳 → 集點中心看餘額 | 串 LINE Pay API（`LINE_PAY_CHANNEL_ID/SECRET`），把 `pay-confirm` 改打真正的 payment request |
| Flex 社群分享 | 祝禱區「分享」鈕：LIFF `shareTargetPicker` → 系統分享 → 剪貼簿三級 fallback | Mini App 改用 LIFF 時載入 `liff SDK` 並 `liff.init`，第一級自動生效 |
| Beacon 進店推播 | Demo 台「模擬 Beacon 進店」＋ `POST /api/beacon/enter` | 買 LINE Beacon 硬體 → 取 `BEACON_HWID` → 在 LINE 後台綁定 → webhook 收 `beacon` 事件後改打真推播（目前僅回傳 Flex 預覽） |
| 點數經濟閉環 | 結帳後集點（NT$10=1點）→ 集點中心兌折扣券 | 點數規則與核銷碼對接店家 POS |

## App 頁面（5 個主分頁 + 次要功能）

- `miniapp/home.html` — 首頁：祈求意圖、神明關聯宮廟推薦、今日神明
- `miniapp/index.html` — AI 問事：對話訊息串，回答內可展開祭拜攻略元件
- `miniapp/map.html` — 找宮廟：嘉義市真實宮廟與供品店家，依奉祀神明＋祈求意圖推薦
- `miniapp/shop.html` — 購物：祭拜套組、購物車；`checkout.html` 為完整 Demo 結帳流程
- `miniapp/more.html` — 更多：祭拜百科、集點中心、LINE 圖文選單與 Demo 控制台
- `miniapp/encyclopedia.html` — 祭拜百科：神明、供品、步驟、注意事項與來源
- `miniapp/place.html?id=` — 地點詳情：宮廟奉祀神明、導航、帶入宮廟背景詢問 AI
- `miniapp/line-menu.html` — LINE Rich Menu 預覽與安裝狀態

## Layout

- `app/assets/js/layout.js` — 頂欄 + 5 項 Tab Bar，使用 Bootstrap Icons；返回鍵僅子頁顯示
- `server/src/server.js` — static host + `/api/*`
- `server/data/*.json` — deities, events, 嘉義市 places, products；執行期資料檔已 gitignore

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
- `GET /api/line/rich-menu` → 圖文選單定義與安裝狀態；`POST /api/line/rich-menu/install` → 上傳圖片並設為預設 Rich Menu
- `POST /api/demo/simulate` → DEMO_MODE only; festival + Flex push preview + mock GPS

# AGENTS.md — 26lineai / 神引路 God's Guide

## Stack
- Node `>=18`, CommonJS, **native `http` only — zero backend deps**. Deps (`leaflet`, `bootstrap-icons`, `lunar-javascript`) are frontend-only.
- No framework / bundler / TS / lint / dotenv. `.env` is parsed by hand in `server/src/config.js`.
- Frontend: pure HTML/CSS/JS in `app/miniapp/*.html` + `app/assets/js/*.js`, served static same-origin by `server/src/server.js`.
- Data: JSON in `server/data/*.json`, loaded once at boot via `server/src/utils/store.js` (`loadStore()`).

## Commands
```powershell
Copy-Item .env.example .env
npm install
npm run dev   # node --watch, http://localhost:3000/miniapp/home.html
npm test      # node --test server/tests/*.test.js
```
- Single test: `node --test server/tests/<name>.test.js` (e.g. `chat`, `webhook`, `distance`).
- No lint/typecheck/build step exists — `npm test` is the only verification.
- Visual smoke (optional): requires `PLAYWRIGHT_MODULE` env (+ optional `SCREENSHOT_DIR`, `CHROME_PATH`); see `scripts/visual-smoke.js`.

## Layout
- `server/src/server.js` — single router (`handleApi` + `serveStatic`); add endpoints there, logic in `server/src/modules/<domain>/`.
- Modules: `chat/` `checklist/` `charms/` `events/` `line/` `points/` `prayer/`; shared `utils/distance.js`, `utils/store.js`, `middleware/lineSignature.js`, `config.js`.
- Seed JSON (commit): `deities`, `events`, `places` (Chiayi temples/shops), `products`, `sets`. Runtime JSON (gitignored, do not commit): `checklists`, `conversations`, `amulets`, `points`, `coupons`.
- App pages: `home` `index` (chat) `map` `shop`/`checkout` `place?id=` `encyclopedia` `charms` `line-menu` `more`; demo console is `miniapp/demo.html`; tab bar in `app/assets/js/layout.js`.

## Gotchas
- **Distance is duplicated**: keep `server/src/utils/distance.js` in sync with `app/assets/js/distance.js`. Sort is `partner > distance > intent`; default radius `3km`. Use `parseCoordParam()` for lat/lng — never raw `Number()` (`Number(null)===0` would search off Africa).
- **Webhook must buffer raw body before JSON parse** — HMAC (`x-line-signature`) is verified against exact bytes. If `LINE_CHANNEL_SECRET` is empty, verification is skipped (dev only); without `LINE_CHANNEL_ACCESS_TOKEN` replies are only logged.
- **Chat/prayer default to mock**: OpenAI is called only when `LLM_API_KEY` is set AND not `DEMO_MODE`; any LLM failure must fall back to mock. Replies must cite `source_notes` + include the regional-variance disclaimer (`不同地區…`). Knowledge base is reference-only for the LLM (free topics, proactive 祝禱文); only shop names/prices and efficacy guarantees are off-limits. Tool-only replies with no text must fall back to mock (`fallbackReason: 'empty'`), never show mock text under the Gemini label.
- **`DEMO_MODE=true` gates**: `POST /api/demo/simulate` and `POST /api/beacon/enter` return 403 otherwise; demo festival pins 土地公 (lunar 二月初二), mock GPS is `23.4801,120.4491`.
- API quirks: `GET /api/places/nearby` requires numeric `lat`+`lng` (400 otherwise); `offering=` filters via `products.json` reverse lookup and excludes temples; `GET /api/recommendations` returns temples only, top 10; checklists store **供品 items only**.
- Logs are single JSON lines via `log()` in `server.js` — never log LINE user IDs in plaintext or persist raw GPS.
- Missing keys still run locally (mock chat, browser GPS, no push). `README.md` “需要你填入” table is source of truth for env vars.
- PowerShell defaults garble CJK: read/write Traditional Chinese files with `-Encoding UTF8`.

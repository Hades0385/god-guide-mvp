# AGENTS.md — 26lineai / 神引路 God's Guide

> Source of truth: `README.md` + code. (`project.md`/`plan.md` spec docs were removed; section refs like `project.md:4` below are historical anchors.) PowerShell `Default` encoding garbles CJK — always read with `-Encoding UTF8` or .NET UTF-8.

## Repo State
- MVP implemented: `app/` (LINE Mini App, pure HTML/CSS/JS) + `server/` (Node.js native http + JSON files). Single `package.json` at root.
- Spec phases done (bootstrap → knowledge → calendar/webhook → chat/checklist → map → demo → concept extensions). Build on existing modules; don't re-bootstrap.

## Expected Stack & Structure (ultra-light MVP — overrides spec)
- `app: LINE Mini App — pure HTML/CSS/JS` (no framework/bundler — see `plan.md:3`) | `server: Hono (or native http) + Node.js` | `data: JSON files` (`server/data/*.json`) | `map: Leaflet CDN + OpenStreetMap`
- Ultra-light layout: single `package.json` at root, `server` serves `app/` static + `/api/*` same origin, no DB/ORM/Docker/Next.js/Vite required for MVP + `.env` only
- Data is JSON (`server/data/*.json`): `deities.json, events.json, places.json, checklists.json, conversations.json` — no DB tables for MVP (future PG migration via Repository interface)

## Critical Invariants
- **Core flow is fixed:** `lunar festival -> LINE push (Flex Message) -> Rich Menu -> AI Chatbot (Quick Reply) -> Knowledge Base -> personalized Checklist -> [View nearby] -> LIFF -> GPS -> map markers -> detail -> navigation`
- **APP is LINE Mini App:** pure HTML/CSS/JS at `app/` opened via Mini App container, zero framework/bundler — `server` serves `app/` static alongside API (see `plan.md:3-4`)
- **MVP first deity:** 土地公 (Tudigong) — knowledge base needs 5 deities min with model `project.md:4` (`id,name,aliases,birthday,lunar_birthday,main_beliefs,prayer_topics,common_offerings,ritual_steps,taboos,related_shops,source_notes`)
- **Map abstraction:** `MapProvider` interface (`initialize/showUserLocation/addMarker/moveTo`) at `project.md:7` — never hardcode Google Maps/Mapbox; keep OSM/Leaflet swappable
- **Distance:** helpers `calculateDistance/findNearbyPlaces/sortNearbyPlaces` outside UI; default radius `3km`; sort by `partner > distance > prayer_intent`
- **Recommendation:** rule-based only (`distance + partner + intent + type`) for MVP, no ML — but architecture must allow future AI swap
- **AI safety:** must cite `source_notes`, show regional-variance disclaimer ("不同地區/宮廟習俗不同..."), never invent folklore; pipeline `Intent -> Knowledge Base -> Prompt -> LLM -> Safety/Fact Check -> LINE Response` (`project.md:12`)
- **Secrets:** `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` via `.env` only, never committed; verify LINE Signature on `POST /api/line/webhook` (`project.md:6`)
- **GPS/privacy:** explicit consent, no persistent raw GPS unless needed, prefer client-side distance, never log LINE User ID in plaintext, auth all APIs (`project.md:21`)

## API Contract + Docs
- Endpoints (`project.md:16`): `POST /api/line/webhook`, `GET /api/deities`, `GET /api/deities/:id`, `GET /api/events/today`, `POST /api/chat`, `GET /api/places/nearby`, `GET /api/places/:id`, `POST /api/checklists`, `PATCH /api/checklists/:id/items/:itemId`, `GET /api/recommendations` — add OpenAPI/Swagger
- Place model (`project.md:9`): `id,name,type(temple|offering_shop|joss_paper_shop|flower_shop),latitude,longitude,address,phone,opening_hours,description,is_partner,promotion,image_url,tags` — seed Demo Data clearly flagged

## Demo Mode (`DEMO_MODE=true`, `project.md:17`)
- Must not break prod architecture; centralize demo data. Enables fixed festival date (simulate 土地公), mock GPS, demo temples/shops, simulated LINE push, full-flow walkthrough
- Required control panel: `/admin/demo` or `/demo` with buttons for simulate festival, push, query, checklist, map, shops, navigation, shopping — critical for competition venue (no real GPS)

## Dev Conventions (spec §24)
- TS Strict, Clean Architecture, SOLID, modular, no mega-components, no business logic in UI, validate all APIs, handle all errors, unit test all functions + integration test APIs, English code naming (UI may use Traditional Chinese), update README on every feature
- Logging required for `LINE Webhook, AI Request/Response, Checklist, Map Search, Place Click, Navigation Click` (`project.md:19`)

'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile() {
  // Minimal .env loader (no dotenv dep). Ignored if file missing.
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

const config = {
  port: Number(process.env.PORT || 3000),
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  miniappChannelId: process.env.MINIAPP_CHANNEL_ID || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  adminToken: process.env.ADMIN_TOKEN || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 60000) || 60000,
};

module.exports = { config };

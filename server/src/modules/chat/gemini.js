'use strict';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

async function generate({ apiKey, model = DEFAULT_MODEL, systemPrompt, message, history = [], deityIds = [], timeoutMs = 60000, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [...history.map(turn => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })), { role: 'user', parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 1800 },
      ...(deityIds.length ? { tools: [{ functionDeclarations: [{
        name: 'show_worship_guide', description: '需要供品清單、祭拜攻略或參拜步驟時，呼叫此工具顯示知識庫攻略元件。',
        parameters: { type: 'OBJECT', properties: { deityId: { type: 'STRING', enum: deityIds } }, required: ['deityId'] },
      }] }] } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
  const guideId = parts.find(p => p.functionCall?.name === 'show_worship_guide')?.functionCall?.args?.deityId;
  if (!text && !deityIds.includes(guideId)) throw new Error('Gemini returned no usable content');
  return { text, guideId: deityIds.includes(guideId) ? guideId : null };
}
module.exports = { generate, DEFAULT_MODEL };

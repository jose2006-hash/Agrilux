/**
 * api/gemini.js — Vercel Serverless Function con OpenAI
 */
 
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
 
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
 
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });
 
  const { prompt, file_urls = [], response_json_schema = null } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });
 
  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt += '\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n' + JSON.stringify(response_json_schema, null, 2);
  }
 
  const content = [{ type: 'text', text: finalPrompt }];
 
  for (const url of file_urls) {
    if (url.startsWith('data:')) {
      content.push({ type: 'image_url', image_url: { url, detail: 'low' } });
    }
  }
 
  const body = {
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 2048,
    temperature: 0.7,
  };
 
  const openaiRes = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
 
  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    return res.status(openaiRes.status).json({ error: 'OpenAI error', details: err });
  }
 
  const data = await openaiRes.json();
  return res.status(200).json(data);
}
 
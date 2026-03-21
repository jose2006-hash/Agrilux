/**
 * gemini.js — usa OpenAI GPT-4o (con soporte de imágenes)
 * Variable de entorno: VITE_OPENAI_API_KEY
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function compressImage(dataUrl) {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 600;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = h * MAX / w; w = MAX; }
      else if (h > MAX) { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

export async function invokeGemini({ prompt, file_urls = [], response_json_schema = null }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt += '\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n' + JSON.stringify(response_json_schema, null, 2);
  }

  const content = [{ type: 'text', text: finalPrompt }];

  for (const url of file_urls) {
    const compressed = await compressImage(url);
    content.push({ type: 'image_url', image_url: { url: compressed, detail: 'low' } });
  }

  const body = {
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 2048,
    temperature: 0.7,
  };

  const parseText = (text) => {
    if (!response_json_schema) return text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  };

  if (apiKey) {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return parseText(data.choices?.[0]?.message?.content || '');
    }

    const errData = await res.json().catch(() => ({}));
    console.warn('OpenAI error:', errData);
  }

  // Fallback backend
  const backendRes = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, file_urls, response_json_schema }),
  });

  if (!backendRes.ok) throw new Error(`Error ${backendRes.status}`);
  const data = await backendRes.json();
  return parseText(data.choices?.[0]?.message?.content || '');
}

export default invokeGemini;
/**
 * gemini.js — usa OpenAI GPT-4o (con soporte de imágenes)
 * Nota: por seguridad, la API key debe estar SOLO en backend (OPENAI_API_KEY).
 */

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
  const parseText = (text) => {
    if (!response_json_schema) return text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  };

  const compressedUrls = await Promise.all(file_urls.map((u) => compressImage(u)));
  const backendRes = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, file_urls: compressedUrls, response_json_schema }),
  });

  if (!backendRes.ok) throw new Error(`Error ${backendRes.status}`);
  const data = await backendRes.json();
  return parseText(data.choices?.[0]?.message?.content || '');
}

export default invokeGemini;
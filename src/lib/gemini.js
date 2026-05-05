const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function compressImage(dataUrl) {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = h * MAX / w; w = MAX; }
      else if (h > MAX) { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function extraerJSON(text) {
  if (!text) return null;

  // 1. Intento directo
  try { return JSON.parse(text.trim()); } catch {}

  // 2. Quitar bloques markdown ```json ... ```
  const sinMarkdown = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(sinMarkdown); } catch {}

  // 3. Extraer el primer objeto JSON { ... } del texto
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // 4. Extraer el primer array JSON [ ... ] del texto
  const matchArr = text.match(/\[[\s\S]*\]/);
  if (matchArr) {
    try { return JSON.parse(matchArr[0]); } catch {}
  }

  return null;
}

export async function invokeGemini({ prompt, file_urls = [], response_json_schema = null }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt += `

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin explicaciones, sin comillas extra. 
El JSON debe seguir exactamente esta estructura:
${JSON.stringify(response_json_schema, null, 2)}

No incluyas markdown, no incluyas \`\`\`json, no incluyas texto antes ni después del JSON.
Responde solo con el JSON puro.`;
  }

  const content = [{ type: 'text', text: finalPrompt }];

  for (const url of file_urls) {
    try {
      const compressed = await compressImage(url);
      content.push({ type: 'image_url', image_url: { url: compressed, detail: 'high' } });
    } catch (e) {
      console.warn('Error comprimiendo imagen:', e);
    }
  }

  const body = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: response_json_schema
          ? 'Eres un asistente experto. Responde SIEMPRE con JSON puro y válido, sin ningún texto adicional.'
          : 'Eres un asistente agrónomo experto en cultivos del Perú.'
      },
      { role: 'user', content }
    ],
    max_tokens: 2048,
    temperature: 0.3, // más bajo = más consistente y menos alucinaciones
  };

  const parseResponse = (text) => {
    if (!response_json_schema) return text;
    const parsed = extraerJSON(text);
    if (parsed) return parsed;
    // Si no se pudo parsear, retornar objeto de error controlado
    console.warn('No se pudo parsear JSON de la respuesta:', text.substring(0, 200));
    return {
      tiene_problema: false,
      nombre_problema: '',
      nombre_cientifico: '',
      gravedad: 'ninguna',
      que_tiene: 'No se pudo analizar la imagen correctamente. Por favor sube una foto más clara y bien iluminada del cultivo afectado.',
      causa: '',
      que_hacer: 'Intenta con otra foto donde se vean claramente las hojas, tallos o frutos afectados.',
      aplicacion_inmediata: '',
      productos: [],
      cuando_aplicar: '',
      prevencion: '',
      alerta_clima: '',
    };
  };

  // Intentar con API key del cliente
  if (apiKey) {
    try {
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
        const text = data.choices?.[0]?.message?.content || '';
        return parseResponse(text);
      }

      const errData = await res.json().catch(() => ({}));
      console.warn('OpenAI error status:', res.status, errData);
    } catch (e) {
      console.warn('Error llamando OpenAI directo:', e);
    }
  }

  // Fallback al backend de Vercel
  try {
    const backendRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: finalPrompt, file_urls, response_json_schema }),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => 'Error desconocido');
      throw new Error(`Backend error ${backendRes.status}: ${errText}`);
    }

    const data = await backendRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseResponse(text);
  } catch (e) {
    console.error('Error en fallback backend:', e);
    throw e;
  }
}

export default invokeGemini;
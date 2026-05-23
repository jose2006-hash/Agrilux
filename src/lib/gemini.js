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

  const limpiaMarkdown = (input) =>
    input.replace(/```json\s*/gi, '')
         .replace(/```\s*/g, '')
         .trim();

  const buscaBalanceado = (input, openChar, closeChar) => {
    let nivel = 0;
    let inicio = -1;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch === openChar) {
        if (nivel === 0) inicio = i;
        nivel += 1;
      } else if (ch === closeChar && nivel > 0) {
        nivel -= 1;
        if (nivel === 0 && inicio >= 0) {
          return input.slice(inicio, i + 1);
        }
      }
    }
    return null;
  };

  const tryParse = (candidate) => {
    if (!candidate) return null;
    try { return JSON.parse(candidate); } catch {
      return null;
    }
  };

  const trimmed = text.trim();
  let parsed = tryParse(trimmed);
  if (parsed) return parsed;

  const withoutMd = limpiaMarkdown(trimmed);
  parsed = tryParse(withoutMd);
  if (parsed) return parsed;

  const candidateObject = buscaBalanceado(withoutMd, '{', '}');
  parsed = tryParse(candidateObject);
  if (parsed) return parsed;

  const candidateArray = buscaBalanceado(withoutMd, '[', ']');
  parsed = tryParse(candidateArray);
  if (parsed) return parsed;

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
    console.log('Respuesta no-JSON:', text.substring(0, 200));
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
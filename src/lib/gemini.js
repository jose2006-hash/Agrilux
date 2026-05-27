import { callChatCompletions, resolveLlmRequest } from './llmConfig';

async function compressImage(dataUrl) {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 768;
      let w = img.width;
      let h = img.height;
      if (w > h && w > MAX) {
        h = (h * MAX) / w;
        w = MAX;
      } else if (h > MAX) {
        w = (w * MAX) / h;
        h = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function extraerJSON(text) {
  if (!text) return null;

  const limpiaMarkdown = (input) =>
    input.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

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
    try {
      return JSON.parse(candidate);
    } catch {
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

const FALLBACK_DIAGNOSTICO = {
  tiene_problema: false,
  nombre_problema: '',
  nombre_cientifico: '',
  gravedad: 'ninguna',
  que_tiene:
    'No se pudo analizar la imagen correctamente. Por favor sube una foto más clara y bien iluminada del cultivo afectado.',
  causa: '',
  que_hacer:
    'Intenta con otra foto donde se vean claramente las hojas, tallos o frutos afectados.',
  aplicacion_inmediata: '',
  productos: [],
  cuando_aplicar: '',
  prevencion: '',
  alerta_clima: '',
};

function parseResponse(text, response_json_schema) {
  if (!response_json_schema) return text;
  const parsed = extraerJSON(text);
  if (parsed) return parsed;
  console.log('Respuesta no-JSON:', text.substring(0, 200));
  return FALLBACK_DIAGNOSTICO;
}

export async function invokeGemini({
  prompt,
  file_urls = [],
  response_json_schema = null,
  systemPrompt = null,
}) {
  const compressedUrls = [];

  for (const url of file_urls) {
    try {
      compressedUrls.push(await compressImage(url));
    } catch (e) {
      console.warn('Error comprimiendo imagen:', e);
      if (url) compressedUrls.push(url);
    }
  }

  const requestOptions = {
    prompt,
    file_urls: compressedUrls,
    response_json_schema,
    systemPrompt,
  };

  try {
    const request = resolveLlmRequest(import.meta.env, requestOptions);
    const text = await callChatCompletions(request);
    return parseResponse(text, response_json_schema);
  } catch (directError) {
    console.warn('Error LLM directo:', directError.message);
  }

  try {
    const backendRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestOptions),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => 'Error desconocido');
      throw new Error(`Backend error ${backendRes.status}: ${errText}`);
    }

    const data = await backendRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseResponse(text, response_json_schema);
  } catch (e) {
    console.error('Error en fallback backend:', e);
    throw e;
  }
}

export default invokeGemini;

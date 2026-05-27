// src/lib/gemini.js
function extraerJSON(text) {
  if (!text) return null;
  const limpiaMarkdown = (input) =>
    input.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const buscaBalanceado = (input, openChar, closeChar) => {
    let nivel = 0, inicio = -1;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === openChar) { if (nivel === 0) inicio = i; nivel++; }
      else if (input[i] === closeChar && nivel > 0) {
        nivel--;
        if (nivel === 0 && inicio >= 0) return input.slice(inicio, i + 1);
      }
    }
    return null;
  };
  const tryParse = (c) => { try { return c ? JSON.parse(c) : null; } catch { return null; } };
  const trimmed = text.trim();
  return tryParse(trimmed)
    || tryParse(limpiaMarkdown(trimmed))
    || tryParse(buscaBalanceado(limpiaMarkdown(trimmed), '{', '}'))
    || tryParse(buscaBalanceado(limpiaMarkdown(trimmed), '[', ']'))
    || null;
}

const FALLBACK_DIAGNOSTICO = {
  tiene_problema: false,
  nombre_problema: '',
  nombre_cientifico: '',
  gravedad: 'ninguna',
  que_tiene: 'No se pudo analizar la imagen. Sube una foto más clara y bien iluminada.',
  causa: '',
  que_hacer: 'Intenta con otra foto donde se vean claramente las hojas, tallos o frutos afectados.',
  aplicacion_inmediata: '',
  productos: [],
  cuando_aplicar: '',
  prevencion: '',
  alerta_clima: '',
};

export async function invokeGemini({
  prompt,
  file_urls = [],
  response_json_schema = null,
  systemPrompt = null,
}) {
  try {
    const res = await fetch('/api/analizar-imagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: file_urls,
        prompt,
        systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (!response_json_schema) return text;
    return extraerJSON(text) || FALLBACK_DIAGNOSTICO;
  } catch (err) {
    console.error('Error en invokeGemini:', err);
    if (response_json_schema) return FALLBACK_DIAGNOSTICO;
    throw err;
  }
}

export default invokeGemini;
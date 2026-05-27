import {
  callChatCompletions,
  resolveDeepSeekKey,
  resolveGeminiKey,
  resolveLlmRequest,
} from '../src/lib/llmConfig.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const {
    prompt,
    file_urls = [],
    response_json_schema = null,
    systemPrompt = null,
  } = req.body || {};

  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

  const hasImages = file_urls.some((url) => url?.startsWith('data:'));
  if (hasImages && !resolveGeminiKey(process.env)) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY no configurada en Vercel (requerida para imágenes)',
    });
  }
  if (!hasImages && !resolveDeepSeekKey(process.env)) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no configurada en Vercel' });
  }

  try {
    const request = resolveLlmRequest(process.env, {
      prompt,
      file_urls,
      response_json_schema,
      systemPrompt,
    });

    const text = await callChatCompletions(request);

    return res.status(200).json({
      choices: [{ message: { content: text } }],
    });
  } catch (e) {
    console.error('Error en handler:', e);
    return res.status(500).json({ error: 'Error interno', details: e.message });
  }
}

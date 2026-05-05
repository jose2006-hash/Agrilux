export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada en Vercel' });
  }

  const { prompt, file_urls = [], response_json_schema = null } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt += `\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON puro y válido, sin texto adicional ni markdown.`;
  }

  const content = [{ type: 'text', text: finalPrompt }];

  for (const url of file_urls) {
    if (url && url.startsWith('data:')) {
      content.push({ type: 'image_url', image_url: { url, detail: 'high' } });
    }
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: response_json_schema
              ? 'Eres un asistente experto. Responde SIEMPRE con JSON puro y válido, sin texto adicional.'
              : 'Eres un asistente agrónomo experto en cultivos del Perú.'
          },
          { role: 'user', content }
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('OpenAI error:', err);
      return res.status(openaiRes.status).json({ error: 'Error de OpenAI', details: err });
    }

    const data = await openaiRes.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error('Error en handler:', e);
    return res.status(500).json({ error: 'Error interno', details: e.message });
  }
}
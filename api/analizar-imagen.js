// api/analizar-imagen.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY)
    return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada en Vercel' });

  const { images, prompt, systemPrompt } = req.body;
  if (!images?.length || !prompt)
    return res.status(400).json({ error: 'Faltan campos: images o prompt' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://vitalfarmbright.store',
        'X-Title': 'Agrilux',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', // ✅ Cambiado: soporta visión + base64
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img },
              })),
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    // ✅ Log para ver errores reales en Vercel → Logs
    if (!response.ok) {
      console.error('OpenRouter error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || 'Error de OpenRouter' });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'Sin respuesta del modelo' });

    return res.status(200).json({ choices: [{ message: { content } }] });
  } catch (err) {
    console.error('Error interno:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
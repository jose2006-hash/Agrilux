// api/analizar-imagen.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY)
    return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada en Vercel' });

  const { images, prompt, systemPrompt } = req.body;
  if (!prompt)
    return res.status(400).json({ error: 'Falta el campo prompt' });

  // Modelos con visión disponibles en OpenRouter (en orden de prioridad)
  const MODELOS_VISION = [
    'google/gemini-2.0-flash-exp:free',   // Gemini 2.0 Flash gratuito
    'google/gemini-flash-1.5',            // Gemini 1.5 Flash
    'meta-llama/llama-4-maverick',        // Llama 4 Maverick (visión)
    'openai/gpt-4o-mini',                 // GPT-4o Mini (fallback)
  ];

  const tieneImagenes = Array.isArray(images) && images.length > 0;

  const userContent = tieneImagenes
    ? [
        { type: 'text', text: prompt },
        ...images.map(img => ({
          type: 'image_url',
          image_url: { url: img },
        })),
      ]
    : prompt;

  // Intentar con cada modelo hasta que uno responda
  let ultimoError = null;

  for (const modelo of MODELOS_VISION) {
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
          model: modelo,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userContent },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn(`Modelo ${modelo} falló:`, data.error?.message);
        ultimoError = data.error?.message;
        continue; // intentar con el siguiente
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`Modelo ${modelo}: sin contenido en respuesta`);
        continue;
      }

      console.log(`✓ Respondió con modelo: ${modelo}`);
      return res.status(200).json({ choices: [{ message: { content } }], modelo_usado: modelo });

    } catch (err) {
      console.warn(`Error con modelo ${modelo}:`, err.message);
      ultimoError = err.message;
      continue;
    }
  }

  // Si todos fallaron
  console.error('Todos los modelos fallaron. Último error:', ultimoError);
  return res.status(500).json({
    error: 'No se pudo obtener respuesta de ningún modelo de IA.',
    detalle: ultimoError,
  });
}
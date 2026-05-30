/**
 * api/crop-health.js — Proxy para Crop.health de kindwise
 * Detecta enfermedades en cultivos comerciales (papa, palta, arándano)
 * Docs: https://crop.kindwise.com/docs
 *
 * Variables necesarias en Vercel:
 *   CROP_HEALTH_API_KEY   → tu API key de kindwise
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.CROP_HEALTH_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'CROP_HEALTH_API_KEY no configurada',
      hint: 'Regístrate en https://crop.kindwise.com y crea una API key gratuita.',
    });
  }

  const { images } = req.body;
  if (!Array.isArray(images) || images.length === 0)
    return res.status(400).json({ error: 'Faltan imágenes' });

  // Crop.health acepta base64 sin el prefijo data:...
  const cleanImages = images.map((img) =>
    typeof img === 'string' ? img.replace(/^data:image\/[^;]+;base64,/, '') : img
  );

  try {
    const response = await fetch('https://crop.kindwise.com/api/v1/identification', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: cleanImages,
        // Detalles extra que enriquecen el diagnóstico
        details: [
          'common_names',
          'description',
          'treatment',
          'cause',
          'severity',
          'spread',
          'chemical_treatment',
          'biological_treatment',
          'prevention',
          'image',
          'url',
        ],
        language: 'es',
        // Clasificación de la planta también, no solo enfermedad
        similar_images: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Crop.health error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data?.error?.message || 'Error en Crop.health',
        details: data,
      });
    }

    // Normalizamos la respuesta para que Diagnostico.jsx la consuma igual que Plant.id
    const suggestions = data?.result?.disease?.suggestions || [];
    const normalized = {
      source: 'crop.health',
      raw: data,
      // Mapeamos al mismo formato que usa plantDiagnosis en Diagnostico.jsx
      data: {
        suggestions: suggestions.map((s) => ({
          plant_name: s.name,
          name: s.name,
          probability: s.probability,
          plant_details: {
            common_names: s.details?.common_names || [],
            description: s.details?.description?.value || '',
            // Datos adicionales que Plant.id NO da: tratamiento químico real
            treatment: s.details?.treatment || {},
            cause: s.details?.cause?.value || '',
            severity: s.details?.severity || '',
            chemical_treatment: s.details?.chemical_treatment || [],
            biological_treatment: s.details?.biological_treatment || [],
            prevention: s.details?.prevention?.value || '',
            url: s.details?.url || '',
          },
        })),
        // is_healthy viene a nivel de resultado
        is_healthy: data?.result?.is_plant?.probability > 0.5 && suggestions.length === 0,
      },
    };

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Crop.health proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
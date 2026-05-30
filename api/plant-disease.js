/**
 * api/plant-disease.js — Identificación de enfermedades en cultivos
 *
 * Orden de prioridad:
 *   1. Crop.health (kindwise) — especializado en cultivos comerciales, base EPPO
 *   2. Plant.id v2           — fallback generalista
 *   3. HuggingFace           — fallback gratuito
 *
 * Variables:
 *   CROP_HEALTH_API_KEY  → kindwise (https://crop.kindwise.com)
 *   PLANT_ID_API_KEY     → Plant.id (https://plant.id)
 *   HUGGINGFACE_API_KEY  → HuggingFace (opcional)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { images } = req.body;
  if (!Array.isArray(images) || images.length === 0)
    return res.status(400).json({ error: 'Faltan imágenes para identificar' });

  const cleanImages = images.map((image) =>
    typeof image === 'string'
      ? image.replace(/^data:image\/[^;]+;base64,/, '')
      : image
  );

  // ─── 1. Crop.health (kindwise) — primera opción ───────────────────────────
  if (process.env.CROP_HEALTH_API_KEY) {
    try {
      const response = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method: 'POST',
        headers: {
          'Api-Key': process.env.CROP_HEALTH_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: cleanImages,
          details: [
            'common_names',
            'description',
            'treatment',
            'cause',
            'severity',
            'chemical_treatment',
            'biological_treatment',
            'prevention',
            'url',
          ],
          language: 'es',
          similar_images: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn('Crop.health error, intentando Plant.id:', data?.error?.message);
        // No retornamos error, caemos al siguiente proveedor
      } else {
        // Normalizar al formato que usa Diagnostico.jsx
        const suggestions = data?.result?.disease?.suggestions || [];
        return res.status(200).json({
          source: 'crop.health',
          data: {
            suggestions: suggestions.map((s) => ({
              plant_name: s.name,
              name: s.name,
              probability: s.probability,
              plant_details: {
                common_names: s.details?.common_names || [],
                description: s.details?.description?.value || '',
                treatment: s.details?.treatment || {},
                cause: s.details?.cause?.value || '',
                severity: s.details?.severity || '',
                chemical_treatment: s.details?.chemical_treatment || [],
                biological_treatment: s.details?.biological_treatment || [],
                prevention: s.details?.prevention?.value || '',
                url: s.details?.url || '',
              },
            })),
            is_healthy:
              (data?.result?.is_plant?.probability || 0) > 0.5 &&
              suggestions.length === 0,
          },
        });
      }
    } catch (err) {
      console.warn('Crop.health falló, usando Plant.id:', err.message);
    }
  }

  // ─── 2. Plant.id v2 — fallback ─────────────────────────────────────────────
  if (process.env.PLANT_ID_API_KEY) {
    try {
      const response = await fetch('https://api.plant.id/v2/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': process.env.PLANT_ID_API_KEY,
        },
        body: JSON.stringify({
          api_version: '2',
          images: cleanImages,
          modifiers: ['health_all'],
          plant_language: 'es',
          plant_details: ['common_names', 'url', 'wiki_description'],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Plant.id error:', data);
        throw new Error(data?.error?.message || 'Error Plant.id');
      }
      return res.status(200).json({ source: 'plant.id', data });
    } catch (err) {
      console.warn('Plant.id falló:', err.message);
    }
  }

  // ─── 3. HuggingFace — fallback gratuito ────────────────────────────────────
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/vasudevgupta/plant-disease-classification',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: cleanImages[0] }),
        }
      );
      const data = await response.json();
      if (response.status >= 400) {
        console.error('HuggingFace error:', data);
        throw new Error(data.error || 'Error HuggingFace');
      }
      return res.status(200).json({ source: 'huggingface', data });
    } catch (err) {
      console.warn('HuggingFace falló:', err.message);
    }
  }

  // Sin ningún proveedor configurado
  return res.status(204).end();
}
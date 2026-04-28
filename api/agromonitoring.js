/**
 * api/agromonitoring.js — Proxy para AgroMonitoring (no exponer appid al frontend)
 *
 * Docs:
 * - https://agromonitoring.com/api/current-weather
 * - Geocoding sin key: Nominatim (OpenStreetMap)
 */

const AGRO_BASE = 'https://api.agromonitoring.com/agro/1.0';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  const appid =
    process.env.AGROMONITORING_API_KEY ||
    process.env.AGRO_API_KEY ||
    process.env.OPENWEATHER_API_KEY ||
    process.env.OWM_API_KEY ||
    process.env.APPID ||
    process.env.VITE_AGROMONITORING_API_KEY;

  if (!appid) {
    return res.status(500).json({
      error: 'AGROMONITORING_API_KEY no configurada',
      hint:
        'Configura una variable de entorno con tu API key. Recomendado: AGROMONITORING_API_KEY. ' +
        'También se aceptan: AGRO_API_KEY, OPENWEATHER_API_KEY, OWM_API_KEY, APPID, VITE_AGROMONITORING_API_KEY.',
    });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { action } = req.query || {};

  try {
    if (action === 'geocode') {
      const q = (req.query?.q || '').toString().trim();
      if (!q) return res.status(400).json({ error: 'q requerido' });

      const url = new URL(`${NOMINATIM_BASE}/search`);
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');

      const r = await fetch(url, {
        headers: {
          // Nominatim pide un User-Agent identificable
          'User-Agent': 'agrilux/1.0 (contact: dev@local)',
          'Accept': 'application/json',
        },
      });
      const text = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: 'Geocode error', details: text });
      const data = JSON.parse(text);
      const item = Array.isArray(data) ? data[0] : null;
      if (!item) return res.status(404).json({ error: 'No encontrado' });
      return res.status(200).json({
        name: item.display_name,
        state: null,
        country: null,
        lat: Number(item.lat),
        lon: Number(item.lon),
      });
    }

    if (action === 'weather') {
      const lat = toNum(req.query?.lat);
      const lon = toNum(req.query?.lon);
      if (lat === null || lon === null) return res.status(400).json({ error: 'lat/lon requeridos' });

      const units = (req.query?.units || 'metric').toString();
      const url = new URL(`${AGRO_BASE}/weather`);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('appid', appid);
      url.searchParams.set('units', units);

      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: 'Weather error', details: text });
      return res.status(200).json(JSON.parse(text));
    }

    return res.status(400).json({ error: 'action inválida', allowed: ['geocode', 'weather'] });
  } catch (e) {
    return res.status(500).json({ error: 'Proxy error', details: String(e?.message || e) });
  }
}


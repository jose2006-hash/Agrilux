/**
 * api/sentinel.js — Proxy para Sentinel Hub (ESA)
 * Obtiene imágenes satelitales Sentinel-2 y calcula NDVI de parcelas
 * Docs: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub.html
 *
 * Variables necesarias en Vercel:
 *   SENTINEL_CLIENT_ID      → Client ID de Copernicus Data Space Ecosystem
 *   SENTINEL_CLIENT_SECRET  → Client Secret
 *
 * Registro gratuito: https://dataspace.copernicus.eu/
 * Plan gratuito: 30.000 unidades de procesamiento/mes ≈ suficiente para MVP
 */

const SENTINEL_AUTH_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SENTINEL_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

// Cache del token en memoria (dura 10 min)
let cachedToken = null;
let tokenExpiry = 0;

async function getSentinelToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(SENTINEL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sentinel Hub auth failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expira 1 minuto antes del tiempo real para evitar race conditions
  tokenExpiry = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const clientId = process.env.SENTINEL_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'SENTINEL_CLIENT_ID y SENTINEL_CLIENT_SECRET no configurados',
      hint: 'Regístrate gratis en https://dataspace.copernicus.eu/ y crea una OAuth client app.',
    });
  }

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  // Radio en km alrededor del punto (default 2km, máx 10km para plan gratuito)
  const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '2'), 10);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat y lon requeridos' });
  }

  try {
    const token = await getSentinelToken(clientId, clientSecret);

    // Convertir radio km a grados aproximados (1° ≈ 111km)
    const delta = radiusKm / 111;
    const bbox = [lon - delta, lat - delta, lon + delta, lat + delta];

    // Evalscript: calcula NDVI y genera imagen coloreada (verde=sano, rojo=estrés)
    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: [{ bands: ["B04", "B08", "dataMask"] }],
          output: [
            { id: "default", bands: 4 },
            { id: "ndvi_value", bands: 1, sampleType: "FLOAT32" }
          ]
        };
      }
      function evaluatePixel(sample) {
        let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
        // Colormap: rojo (estrés) → amarillo (moderado) → verde (sano)
        let r, g, b;
        if (ndvi < 0) { r = 0.5; g = 0.5; b = 0.5; }
        else if (ndvi < 0.2) { r = 1.0; g = ndvi * 5; b = 0; }
        else if (ndvi < 0.5) { r = 1 - (ndvi - 0.2) * 3.33; g = 1.0; b = 0; }
        else { r = 0; g = 1.0; b = 0; }
        return {
          default: [r, g, b, sample.dataMask],
          ndvi_value: [ndvi]
        };
      }
    `;

    const requestBody = {
      input: {
        bounds: {
          bbox,
          properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: {
                // Últimas 4 semanas para asegurar imagen sin nubes
                from: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
                to: new Date().toISOString(),
              },
              maxCloudCoverage: 30,
              mosaickingOrder: 'leastCC', // Menos nubosidad primero
            },
          },
        ],
      },
      output: {
        width: 256,
        height: 256,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/png' },
          },
        ],
      },
      evalscript,
    };

    const sentinelRes = await fetch(SENTINEL_PROCESS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify(requestBody),
    });

    if (!sentinelRes.ok) {
      const errText = await sentinelRes.text();
      console.error('Sentinel Hub process error:', errText);
      return res.status(sentinelRes.status).json({
        error: 'Error en Sentinel Hub',
        details: errText,
      });
    }

    // Devuelve la imagen PNG como base64 para el frontend
    const arrayBuffer = await sentinelRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({
      source: 'sentinel-hub',
      ndvi_image: `data:image/png;base64,${base64}`,
      bbox,
      center: { lat, lon },
      radius_km: radiusKm,
      generated_at: new Date().toISOString(),
      legend: {
        red: 'Estrés severo (NDVI < 0.2)',
        yellow: 'Estrés moderado (NDVI 0.2–0.5)',
        green: 'Cultivo sano (NDVI > 0.5)',
        gray: 'Sin vegetación / agua',
      },
    });
  } catch (error) {
    console.error('Sentinel proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
/**
 * src/lib/externalApis.js
 * Cliente frontend para todas las APIs externas de Agrilux
 *
 * Funciones exportadas:
 *   geocodePlace(query)                        → {lat, lon, name}
 *   getWeather(lat, lon, label)                → datos clima
 *   identifyPlantDisease(compressedUrls)       → diagnóstico visual (crop.health → plant.id → HF)
 *   getSoilData(lat, lon)                      → pH, carbono orgánico, textura
 *   getNasaAlerts(lat, lon)                    → alertas incendios NASA FIRMS
 *   getSentinelNDVI(lat, lon, radiusKm)        → imagen NDVI satelital
 *   sendWhatsApp(telefono, tipo, datos)        → notificación WhatsApp vía Twilio
 *   getMapboxStaticMap(lat, lon, zoom)         → URL de mapa estático Mapbox
 */

// ─── Geocodificación ──────────────────────────────────────────────────────────
export async function geocodePlace(query) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'No se pudo geocodificar la ubicación');
  }
  return res.json();
}

// ─── Clima (Open-Meteo gratuito o OpenWeatherMap si tienes key) ───────────────
export async function getWeather(lat, lon, label = '') {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    label: label,
  });
  const res = await fetch(`/api/weather?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error obteniendo clima');
  }
  return res.json();
}

// ─── Diagnóstico visual de plantas (crop.health → plant.id → HuggingFace) ────
export async function identifyPlantDisease(compressedUrls) {
  const res = await fetch('/api/plant-disease', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: compressedUrls }),
  });

  // 204 = ningún proveedor configurado, no es error crítico
  if (res.status === 204) return null;

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error en identificación de planta');
  }
  return res.json();
}

// ─── Datos de suelo (SoilGrids ISRIC — 100% gratuito) ────────────────────────
export async function getSoilData(lat, lon) {
  const res = await fetch(
    `/api/soil-nasa?action=soil&lat=${lat}&lon=${lon}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error obteniendo datos de suelo');
  }
  return res.json();
}

// ─── Alertas NASA FIRMS (incendios y anomalías de vegetación) ─────────────────
export async function getNasaAlerts(lat, lon) {
  const res = await fetch(
    `/api/soil-nasa?action=nasa&lat=${lat}&lon=${lon}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error obteniendo alertas NASA');
  }
  return res.json();
}

// ─── Imagen NDVI satelital (Sentinel Hub ESA) ─────────────────────────────────
export async function getSentinelNDVI(lat, lon, radiusKm = 2) {
  const res = await fetch(
    `/api/sentinel?lat=${lat}&lon=${lon}&radius=${radiusKm}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error obteniendo imagen satelital');
  }
  return res.json();
}

// ─── WhatsApp (Twilio) — notificaciones al agricultor ────────────────────────
/**
 * @param {string} telefono   - 9 dígitos peruanos (ej: "987654321")
 * @param {string} tipo       - 'diagnostico' | 'alerta_zona' | 'pedido_confirmado'
 * @param {object} datos      - payload específico del tipo
 */
export async function sendWhatsApp(telefono, tipo, datos) {
  const res = await fetch('/api/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono, tipo, datos }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error enviando WhatsApp');
  }
  return res.json();
}

// ─── Mapbox — mapa estático centrado en parcela ───────────────────────────────
/**
 * Genera URL de imagen estática de Mapbox (sin backend, solo token público)
 * El token VITE_MAPBOX_TOKEN es público por diseño de Mapbox
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} zoom  - 13 ≈ parcela, 10 ≈ distrito
 * @param {string} size  - "400x300" (WxH en px)
 */
export function getMapboxStaticMap(lat, lon, zoom = 13, size = '400x250') {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.warn('VITE_MAPBOX_TOKEN no configurado');
    return null;
  }

  // Pin rojo en la parcela
  const marker = `pin-l-leaf+00aa44(${lon},${lat})`;

  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${marker}/${lon},${lat},${zoom},0/${size}@2x?access_token=${token}`;
}

/**
 * URL de mapa interactivo de Mapbox para abrir en navegador
 * (sin necesidad de token para el enlace básico)
 */
export function getMapboxExploreUrl(lat, lon, zoom = 13) {
  return `https://www.mapbox.com/maps/satellite?latlng=${lat},${lon}&zoom=${zoom}`;
}
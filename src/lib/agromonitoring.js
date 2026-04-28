async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function geocodeUbicacion(q) {
  const url = new URL('/api/agromonitoring', window.location.origin);
  url.searchParams.set('action', 'geocode');
  url.searchParams.set('q', q);
  return await fetchJson(url.toString());
}

export async function getWeather({ lat, lon, units = 'metric' }) {
  const url = new URL('/api/agromonitoring', window.location.origin);
  url.searchParams.set('action', 'weather');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('units', units);
  return await fetchJson(url.toString());
}


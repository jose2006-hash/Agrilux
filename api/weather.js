export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const label = url.searchParams.get('label') || '';
  const query = url.searchParams.get('q');

  if ((!lat || !lon) && !query)
    return res.status(400).json({ error: 'Falta lat/lon o q' });

  let location = { name: label || '', lat, lon };

  try {
    if ((!lat || !lon) && query) {
      const geocodeRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q=${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'Agrilux/1.0 (https://agrilux.example)' },
        }
      );
      const geoData = await geocodeRes.json();
      if (!Array.isArray(geoData) || geoData.length === 0)
        return res.status(404).json({ error: 'No se encontró la ubicación' });
      location = {
        name: geoData[0].display_name,
        lat: geoData[0].lat,
        lon: geoData[0].lon,
      };
    }

    const openWeatherKey = process.env.OPENWEATHER_API_KEY;
    if (openWeatherKey) {
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/onecall?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}&lang=es&units=metric&exclude=minutely,hourly,alerts&appid=${openWeatherKey}`
      );
      if (!weatherRes.ok) {
        const err = await weatherRes.json().catch(() => ({}));
        throw new Error(err.message || 'Error OpenWeatherMap');
      }
      const data = await weatherRes.json();
      return res.status(200).json({
        source: 'openweathermap',
        location,
        current: data.current,
        daily: data.daily,
        timezone: data.timezone,
      });
    }

    const openMeteoRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.lat)}&longitude=${encodeURIComponent(location.lon)}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`
    );
    if (!openMeteoRes.ok) {
      const err = await openMeteoRes.json().catch(() => ({}));
      throw new Error(err.reason || 'Error Open-Meteo');
    }
    const openMeteo = await openMeteoRes.json();
    return res.status(200).json({
      source: 'open-meteo',
      location,
      current: openMeteo.current_weather,
      daily: openMeteo.daily,
      timezone: openMeteo.timezone,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

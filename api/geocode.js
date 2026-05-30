export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const query = new URL(req.url, 'http://localhost').searchParams.get('q');
  if (!query) return res.status(400).json({ error: 'Falta el parámetro q' });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=es&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'Agrilux/1.0 (https://agrilux.example)',
        },
      }
    );

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0)
      return res.status(404).json({ error: 'No se encontró la ubicación' });

    const place = data[0];
    return res.status(200).json({
      name: place.display_name,
      lat: place.lat,
      lon: place.lon,
      type: place.type,
      address: place.address,
    });
  } catch (error) {
    console.error('Geocode error:', error);
    return res.status(500).json({ error: error.message });
  }
}

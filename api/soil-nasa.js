/**
 * api/soil-nasa.js — Proxy combinado para SoilGrids (ISRIC) + NASA EarthData FIRMS
 *
 * Endpoints:
 *   GET ?action=soil&lat=X&lon=Y    → Datos de suelo: pH, carbono, textura
 *   GET ?action=nasa&lat=X&lon=Y    → Alertas NASA: anomalías de vegetación
 *
 * SoilGrids: https://rest.isric.org/soilgrids/v2.0/docs
 *   - 100% gratuito, sin API key
 *   - Resolución: 250m
 *   - Propiedades: pH, SOC, arcilla, arena, limo, nitrógeno
 *
 * NASA EarthData: https://earthdata.nasa.gov
 *   - FIRMS (Fire Information for Resource Management System)
 *   - NASA_EARTHDATA_KEY → gratuito en https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/firms/
 */

const SOILGRIDS_BASE = 'https://rest.isric.org/soilgrids/v2.0';
const NASA_FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov';

// Interpreta pH para dar recomendación agronómica
function interpretarPH(ph) {
  if (ph < 4.5) return { nivel: 'Muy ácido', recomendacion: 'Encalar urgente. Limita absorción de fósforo y calcio.' };
  if (ph < 5.5) return { nivel: 'Ácido', recomendacion: 'Encalar con cal dolomítica. Bueno para arándanos, ajustar para papa.' };
  if (ph < 6.5) return { nivel: 'Ligeramente ácido', recomendacion: 'Óptimo para papa y arándano. Monitorear.' };
  if (ph < 7.5) return { nivel: 'Neutro', recomendacion: 'Óptimo para palta. Buen rango general.' };
  if (ph < 8.0) return { nivel: 'Ligeramente alcalino', recomendacion: 'Posible deficiencia de Fe y Mn. Acidificar si hay clorosis.' };
  return { nivel: 'Alcalino', recomendacion: 'Corregir con azufre elemental o sulfato de aluminio.' };
}

// Interpreta carbono orgánico del suelo
function interpretarSOC(soc_dg) {
  // SoilGrids retorna en dg/kg, convertimos a %
  const pct = soc_dg / 10;
  if (pct < 1) return { nivel: 'Muy bajo', recomendacion: 'Aplicar materia orgánica urgente (compost, estiércol).' };
  if (pct < 2) return { nivel: 'Bajo', recomendacion: 'Incorporar residuos de cosecha y compost.' };
  if (pct < 3) return { nivel: 'Medio', recomendacion: 'Mantener con cultivos de cobertura.' };
  return { nivel: 'Alto', recomendacion: 'Suelo con buena fertilidad. Mantener prácticas actuales.' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action');
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat y lon requeridos' });
  }

  // ─── SOIL: datos de suelo de SoilGrids ─────────────────────────────────────
  if (action === 'soil') {
    try {
      // Pedimos pH, SOC (carbono orgánico), clay, sand, silt, nitrogen
      const properties = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'nitrogen'];
      const depth = '0-5cm'; // Capa superficial, más relevante para diagnóstico

      const soilUrl = new URL(`${SOILGRIDS_BASE}/properties/query`);
      soilUrl.searchParams.set('lon', lon.toString());
      soilUrl.searchParams.set('lat', lat.toString());
      properties.forEach((p) => soilUrl.searchParams.append('property', p));
      soilUrl.searchParams.set('depth', depth);
      soilUrl.searchParams.set('value', 'mean');

      const soilRes = await fetch(soilUrl.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!soilRes.ok) {
        const err = await soilRes.text();
        throw new Error(`SoilGrids error ${soilRes.status}: ${err}`);
      }

      const soilData = await soilRes.json();
      const layers = soilData?.properties?.layers || [];

      // Extraer valores medios por propiedad
      const valores = {};
      layers.forEach((layer) => {
        const prop = layer.name;
        const mean = layer.depths?.[0]?.values?.mean;
        if (mean !== undefined && mean !== null) {
          valores[prop] = mean;
        }
      });

      // pH en SoilGrids viene multiplicado x10 (pH=65 → 6.5)
      const phReal = valores.phh2o ? valores.phh2o / 10 : null;
      const phInfo = phReal ? interpretarPH(phReal) : null;
      const socInfo = valores.soc ? interpretarSOC(valores.soc) : null;

      return res.status(200).json({
        source: 'soilgrids-isric',
        lat,
        lon,
        depth,
        suelo: {
          ph: {
            valor: phReal,
            unidad: 'pH',
            ...phInfo,
          },
          carbono_organico: {
            valor: valores.soc ? (valores.soc / 10).toFixed(2) : null,
            unidad: '%',
            ...socInfo,
          },
          textura: {
            arcilla: valores.clay ? `${(valores.clay / 10).toFixed(1)}%` : null,
            arena: valores.sand ? `${(valores.sand / 10).toFixed(1)}%` : null,
            limo: valores.silt ? `${(valores.silt / 10).toFixed(1)}%` : null,
          },
          nitrogeno: {
            valor: valores.nitrogen ? (valores.nitrogen / 100).toFixed(2) : null,
            unidad: 'g/kg',
          },
        },
        // Resumen para mostrar en la app
        resumen_agronómico: phInfo
          ? `pH ${phReal?.toFixed(1)} (${phInfo.nivel}). ${phInfo.recomendacion}`
          : 'No se pudo obtener pH.',
      });
    } catch (error) {
      console.error('SoilGrids error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── NASA FIRMS: alertas de incendios y anomalías ──────────────────────────
  if (action === 'nasa') {
    const nasaKey = process.env.NASA_EARTHDATA_KEY;
    if (!nasaKey) {
      return res.status(500).json({
        error: 'NASA_EARTHDATA_KEY no configurada',
        hint: 'Regístrate gratis en https://earthdata.nasa.gov y genera un API key en tu perfil → Generate Key.',
      });
    }

    try {
      // FIRMS devuelve incendios activos en área de 10km alrededor del punto
      // Usamos VIIRS S-NPP (mejor resolución 375m) últimas 24 horas
      const firmsUrl = new URL(`${NASA_FIRMS_BASE}/api/area/csv/${nasaKey}/VIIRS_SNPP_NRT`);
      // Bbox: lat-0.1 lon-0.1 lat+0.1 lon+0.1 (≈11km x 11km)
      const bbox = `${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}`;
      firmsUrl.searchParams.set('area', bbox);
      firmsUrl.searchParams.set('day_range', '3'); // Últimos 3 días

      const firmsRes = await fetch(firmsUrl.toString());

      let incendiosActivos = 0;
      let alertaTexto = 'Sin alertas de incendios en los últimos 3 días.';

      if (firmsRes.ok) {
        const csv = await firmsRes.text();
        // El CSV tiene encabezado; contamos líneas de datos
        const lineas = csv.trim().split('\n').filter((l) => !l.startsWith('latitude'));
        incendiosActivos = lineas.filter((l) => l.trim().length > 0).length;
        if (incendiosActivos > 0) {
          alertaTexto = `⚠️ ${incendiosActivos} punto(s) de calor detectado(s) en 11km a la redonda en los últimos 3 días. Posible riesgo de incendio o quema agrícola cercana.`;
        }
      }

      return res.status(200).json({
        source: 'nasa-firms',
        lat,
        lon,
        incendios_activos: incendiosActivos,
        alerta: alertaTexto,
        riesgo: incendiosActivos > 3 ? 'alto' : incendiosActivos > 0 ? 'moderado' : 'ninguno',
        periodo: 'Últimos 3 días',
        sensor: 'VIIRS SNPP 375m',
        // Link directo a FIRMS para ver en mapa
        mapa_url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lon},${lat},12z`,
      });
    } catch (error) {
      console.error('NASA FIRMS error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({
    error: 'action inválida',
    allowed: ['soil', 'nasa'],
  });
}
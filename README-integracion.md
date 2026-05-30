# Agrilux — Integración de nuevas APIs
## Guía de implementación paso a paso

---

## Archivos que te entrego

```
agrilux-integrations/
├── api/
│   ├── crop-health.js          ← NUEVO — kindwise Crop.health
│   ├── sentinel.js             ← NUEVO — Sentinel Hub ESA (NDVI)
│   ├── soil-nasa.js            ← NUEVO — SoilGrids + NASA FIRMS
│   ├── whatsapp.js             ← NUEVO — Twilio WhatsApp
│   └── plant-disease.js        ← REEMPLAZAR el tuyo
├── src/
│   └── lib/
│       └── externalApis.js     ← REEMPLAZAR el tuyo
├── .env.example                ← REEMPLAZAR el tuyo
└── src/pages/diagnostico/
    └── Diagnostico.diff.jsx    ← LEER y aplicar manualmente a Diagnostico.jsx
```

---

## Paso 1 — Copiar los archivos de /api/

Copia estos 4 archivos directamente a la raíz `/api/` de tu proyecto:

```bash
# Nuevos (no pisan nada)
cp crop-health.js    tu-proyecto/api/
cp sentinel.js       tu-proyecto/api/
cp soil-nasa.js      tu-proyecto/api/
cp whatsapp.js       tu-proyecto/api/

# Reemplaza el existente
cp plant-disease.js  tu-proyecto/api/plant-disease.js
```

---

## Paso 2 — Reemplazar externalApis.js

```bash
cp src/lib/externalApis.js  tu-proyecto/src/lib/externalApis.js
```

> ⚠️ Tu archivo actual se llama `src/lib/externalApis.js` según los imports en Diagnostico.jsx.
> Si en tu proyecto real está en otra ruta, ajusta el destino.

---

## Paso 3 — Aplicar el diff a Diagnostico.jsx

El archivo `Diagnostico.diff.jsx` contiene 7 cambios numerados a aplicar en `src/pages/Diagnostico.jsx`.

Aplícalos en orden:

### Cambio 1 — Import (línea ~4)
Reemplaza:
```js
import { geocodePlace, getWeather, identifyPlantDisease } from '../lib/externalApis';
```
Por:
```js
import {
  geocodePlace, getWeather, identifyPlantDisease,
  getSoilData, getNasaAlerts, getSentinelNDVI,
  sendWhatsApp, getMapboxStaticMap,
} from '../lib/externalApis';
```

### Cambio 2 — Nuevos estados
Después de `const [plantIdentificando, setPlantIdentificando] = useState(false);`, agregar:
```js
const [soilData, setSoilData]                   = useState(null);
const [nasaAlerts, setNasaAlerts]               = useState(null);
const [sentinelNDVI, setSentinelNDVI]           = useState(null);
const [soilLoading, setSoilLoading]             = useState(false);
const [enviandoWhatsApp, setEnviandoWhatsApp]   = useState(false);
const [whatsAppEnviado, setWhatsAppEnviado]     = useState(false);
```

### Cambio 3 — Nueva función cargarDatosEnriquecidos
Pegar la función completa después de `buscarClima()` (ver el diff).

### Cambio 4 — Llamar cargarDatosEnriquecidos desde buscarClima
Dentro de `buscarClima()`, después de `setWeather(clima);`, agregar:
```js
await cargarDatosEnriquecidos(place.lat, place.lon);
```

### Cambio 5 — Nueva función enviarDiagnosticoPorWhatsApp
Pegar la función completa antes del primer `return` del componente (ver el diff).

### Cambio 6 — Nuevos bloques JSX en la pantalla de resultado
Ubicar la sección donde se renderiza `{weather && (...)}` en la pantalla de resultado,
y DESPUÉS de ese bloque agregar los 4 bloques del diff:
- `{sentinelNDVI?.ndvi_image && (...)}`  — mapa NDVI
- `{nasaAlerts && nasaAlerts.riesgo !== 'ninguno' && (...)}` — alertas NASA
- `{soilData?.suelo && (...)}` — datos de suelo
- Botón WhatsApp

### Cambio 7 — Reset al limpiar diagnóstico
En el `onClick` del botón "← Nuevo diagnóstico", agregar las 4 líneas de reset.

---

## Paso 4 — Actualizar .env.example y .env en Vercel

Reemplaza tu `.env.example` con el nuevo.

En **Vercel Dashboard → tu proyecto → Settings → Environment Variables**, agregar:

### Prioridad alta (impacto inmediato en MVP):
| Variable | Valor | Dónde obtener |
|---|---|---|
| `CROP_HEALTH_API_KEY` | tu key | https://crop.kindwise.com |
| `TWILIO_ACCOUNT_SID` | ACxxx... | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | tu token | https://console.twilio.com |
| `TWILIO_WHATSAPP_FROM` | whatsapp:+14155238886 | Sandbox Twilio |
| `VITE_MAPBOX_TOKEN` | pk.eyJ... | https://account.mapbox.com |

### Prioridad media (enriquecen el diagnóstico):
| Variable | Valor | Dónde obtener |
|---|---|---|
| `NASA_EARTHDATA_KEY` | tu key | https://api.nasa.gov |
| `SENTINEL_CLIENT_ID` | tu id | https://dataspace.copernicus.eu |
| `SENTINEL_CLIENT_SECRET` | tu secret | https://dataspace.copernicus.eu |

### Gratuitas sin key (ya integradas automáticamente):
- **SoilGrids** — sin key, automático ✅
- **Open-Meteo** — sin key, ya estaba como fallback ✅
- **Nominatim OSM** — sin key, ya estaba ✅

---

## Paso 5 — Activar Twilio Sandbox (modo desarrollo)

1. Entra a https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Tu número de sandbox es `+14155238886`
3. Para probar: el agricultor manda "join <palabra-tuya>" a ese número desde WhatsApp
4. Listo, ya puede recibir mensajes del sandbox

Para producción (escala): solicitar acceso a WhatsApp Business API en Meta, aprobar plantillas.

---

## Resultado final — Flujo completo Silicon Valley

```
Agricultor sube foto
       ↓
Gemini 2.0 analiza (3 intentos → consenso)        [OpenRouter]
       ↓
Crop.health identifica enfermedad específica       [kindwise]
       ↓
Datos de suelo pH + carbono orgánico               [SoilGrids — gratis]
       ↓
Imagen NDVI satelital de la parcela                [Sentinel Hub ESA]
       ↓
Alertas de incendios cercanos                      [NASA FIRMS — gratis]
       ↓
Clima actual del distrito                          [Open-Meteo — gratis]
       ↓
Diagnóstico completo mostrado en app
       ↓
"📲 Enviar a mi WhatsApp" → llega al celular       [Twilio]
       ↓
"🤖 Que el agente compre" → pedido + delivery     [Firebase + Culqi]
```

**Tiempo de análisis estimado: 8-12 segundos**
**Costo por diagnóstico: ~$0.003 USD** (dominado por OpenRouter/Gemini)

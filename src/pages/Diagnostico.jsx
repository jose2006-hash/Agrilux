import React, { useState, useRef } from 'react';
import {
  Camera, Loader2, AlertTriangle, CheckCircle, Send,
  Mic, MicOff, Volume2, VolumeX, ShoppingBag,
  ChevronRight, Bot, Sparkles,
} from 'lucide-react';
import { useAuth }       from '../lib/AuthContext';
import { invokeGemini }  from '../lib/gemini';
import {
  geocodePlace,
  getWeather,
  identifyPlantDisease,
  getSoilData,
  getNasaAlerts,
  getSentinelNDVI,
  sendWhatsApp,
  getMapboxStaticMap,
} from '../lib/externalApis';
import { CULTIVOS }      from '../lib/constants';
import { db }            from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate }   from 'react-router-dom';

import { SISTEMA_PROMPT, CHAT_SYSTEM, ANALISIS_SCHEMA } from './diagnostico/diagnosticoPrompts';
import TiendasConProducto from './diagnostico/TiendasConProducto';
import AgenteCompra       from './diagnostico/AgenteCompra';

const COLOR_HEADER = {
  critica:  'bg-red-700',
  grave:    'bg-red-600',
  moderada: 'bg-orange-500',
  leve:     'bg-yellow-500',
  ninguna:  'bg-primary',
};

export default function Diagnostico({ onPlagaDetectada }) {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [cultivo, setCultivo]           = useState(CULTIVOS[0]);
  const [fotos, setFotos]               = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [analizando, setAnalizando]     = useState(false);
  const [resultado, setResultado]       = useState(null);
  const [chat, setChat]                 = useState([]);
  const [pregunta, setPregunta]         = useState('');
  const [enviando, setEnviando]         = useState(false);
  const [consultandoSinFoto, setConsultandoSinFoto] = useState(false);
  const [ubicacion, setUbicacion]       = useState('');
  const [locationInfo, setLocationInfo] = useState(null);
  const [weather, setWeather]           = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [plantDiagnosis, setPlantDiagnosis] = useState(null);
  const [plantIdentificando, setPlantIdentificando] = useState(false);
  const [leyendo, setLeyendo]           = useState(false);
  const [grabando, setGrabando]         = useState(false);
  const [productoBuscando, setProductoBuscando] = useState(null);
  const [mostrarAgente, setMostrarAgente]       = useState(false);

  // ── Nuevos estados ──────────────────────────────────────────────────────────
  const [soilData, setSoilData]                     = useState(null);
  const [nasaAlerts, setNasaAlerts]                 = useState(null);
  const [sentinelNDVI, setSentinelNDVI]             = useState(null);
  const [soilLoading, setSoilLoading]               = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp]     = useState(false);
  const [whatsAppEnviado, setWhatsAppEnviado]       = useState(false);

  const fileRef    = useRef(null);
  const chatEndRef = useRef(null);
  const reconRef   = useRef(null);

  const handleFoto = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () =>
        setFotos(prev => {
          const next = [...prev, { preview: reader.result, dataUrl: reader.result }];
          try { setCurrentIndex(next.length - 1); } catch (err) {}
          return next;
        });
      reader.readAsDataURL(file);
    });
  };

  const compressDataUrl = (dataUrl) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = h * MAX / w; w = MAX; }
      else if (h > MAX)     { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  const analizarUnaVez = async (compressedUrls) =>
    invokeGemini({
      systemPrompt: SISTEMA_PROMPT[cultivo.id],
      prompt: `Analiza la foto de ${cultivo.nombre} y evalúa su estado fitosanitario.
Identifica alteraciones visuales (color, manchas, deformaciones, lesiones).
En aplicacion_inmediata y productos: nombres comerciales reales en Perú (Antracol, Mancozeb, Score, Ridomil, Karate) con dosis, frecuencia y carencia.
Sugiere 2-3 productos alternativos. Español claro para agricultores. Si está sana: tiene_problema false.
Responde SOLO con este JSON (sin markdown):
{"tiene_problema":bool,"nombre_problema":"","nombre_cientifico":"","gravedad":"ninguna|leve|moderada|grave|critica","que_tiene":"","causa":"","aplicacion_inmediata":"","que_hacer":"","productos":[{"nombre":"","ingrediente_activo":"","dosis":"","frecuencia":"","carencia":""}],"cuando_aplicar":"","prevencion":"","alerta_clima":""}`,
      file_urls: compressedUrls,
      response_json_schema: ANALISIS_SCHEMA,
    });

  const obtenerConsenso = (resultados) => {
    const norm = (t) => (t || '').trim().toLowerCase();
    const conteo = resultados.reduce((acc, r) => {
      const clave = `${norm(r.nombre_problema) || 'saludable'}|${norm(r.gravedad) || 'ninguna'}`;
      acc[clave] = (acc[clave] || 0) + 1;
      return acc;
    }, {});
    const [nombreG, gravedadG] = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])[0][0].split('|');
    return resultados.find(r =>
      norm(r.nombre_problema) === nombreG && norm(r.gravedad) === gravedadG
    ) || resultados[0];
  };

  // ── Carga datos enriquecidos cuando hay coordenadas ─────────────────────────
  const cargarDatosEnriquecidos = async (lat, lon) => {
    setSoilLoading(true);
    try {
      const [soil, nasa] = await Promise.allSettled([
        getSoilData(lat, lon),
        getNasaAlerts(lat, lon),
      ]);
      if (soil.status === 'fulfilled') setSoilData(soil.value);
      if (nasa.status === 'fulfilled') setNasaAlerts(nasa.value);

      try {
        const ndvi = await getSentinelNDVI(lat, lon, 2);
        setSentinelNDVI(ndvi);
      } catch (e) {
        console.warn('NDVI no disponible:', e.message);
      }
    } catch (e) {
      console.warn('Error cargando datos enriquecidos:', e.message);
    }
    setSoilLoading(false);
  };

  const analizar = async () => {
    if (!fotos.length) { alert('Sube al menos una foto'); return; }
    setAnalizando(true);
    setPlantDiagnosis(null);
    try {
      const compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));
      setPlantIdentificando(true);
      try {
        const plantData = await identifyPlantDisease(compressedUrls);
        if (plantData) setPlantDiagnosis(plantData);
      } catch (err) {
        console.warn('Plant disease detection failed:', err);
      } finally {
        setPlantIdentificando(false);
      }

      const intentos = [];
      for (let i = 0; i < 3; i++) intentos.push(await analizarUnaVez(compressedUrls));

      const todosFallaron = intentos.every(r =>
        !r.nombre_problema && !r.tiene_problema &&
        (!r.que_tiene || r.que_tiene.includes('No se pudo') || r.que_tiene.includes('correctamente'))
      );
      if (todosFallaron) { setResultado({ error: true }); setAnalizando(false); return; }

      const analisis = obtenerConsenso(intentos);
      setResultado(analisis);
      setChat([]);

      try {
        await addDoc(collection(db, 'diagnosticos'), {
          userId:        user?.uid    ?? null,
          userName:      user?.nombre ?? null,
          userEmail:     user?.email  ?? null,
          cultivo:       cultivo.id,
          cultivoNombre: cultivo.nombre,
          resultado: {
            tiene_problema:    analisis.tiene_problema    ?? false,
            nombre_problema:   analisis.nombre_problema   ?? null,
            nombre_cientifico: analisis.nombre_cientifico ?? null,
            gravedad:          analisis.gravedad          ?? 'ninguna',
            que_tiene:         analisis.que_tiene         ?? '',
            productos:         analisis.productos         ?? [],
          },
          confirmado_por_usuario: null,
          fecha: new Date().toISOString(),
          mes:   new Date().getMonth() + 1,
        });
      } catch (e) { console.log('Dataset error:', e); }

      if (analisis.tiene_problema && onPlagaDetectada)
        onPlagaDetectada(analisis.nombre_problema);

      leerTexto(analisis.tiene_problema
        ? `Tu ${cultivo.nombre} tiene ${analisis.nombre_problema}. ${analisis.aplicacion_inmediata || analisis.que_hacer}`
        : `Tu ${cultivo.nombre} está saludable.`
      );
    } catch (e) {
      console.error(e);
      setResultado({ error: true });
    }
    setAnalizando(false);
  };

  const leerTexto = (texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-PE'; u.rate = 0.85;
    setLeyendo(true);
    u.onend  = () => setLeyendo(false);
    u.onerror = () => setLeyendo(false);
    window.speechSynthesis.speak(u);
  };
  const detenerVoz = () => { window.speechSynthesis?.cancel(); setLeyendo(false); };

  const buscarClima = async () => {
    if (!ubicacion.trim()) return;
    setWeatherLoading(true);
    setWeather(null);
    setLocationInfo(null);

    try {
      const place = await geocodePlace(ubicacion.trim());
      setLocationInfo(place);
      const clima = await getWeather(place.lat, place.lon, place.name);
      setWeather(clima);
      // ── Cargar datos enriquecidos con las coordenadas obtenidas ──────────
      await cargarDatosEnriquecidos(place.lat, place.lon);
    } catch (err) {
      console.error(err);
      alert(err.message || 'No se pudo obtener el clima');
    } finally {
      setWeatherLoading(false);
    }
  };

  const grabarVoz = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Usa Chrome para la función de voz'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.lang = 'es-PE'; r.continuous = false;
    r.onstart  = () => setGrabando(true);
    r.onresult = (e) => { setPregunta(e.results[0][0].transcript); setGrabando(false); };
    r.onerror  = () => setGrabando(false);
    r.onend    = () => setGrabando(false);
    reconRef.current = r;
    r.start();
  };

  const enviarPregunta = async () => {
    if (!pregunta.trim()) return;
    const p = pregunta; setPregunta('');
    setChat(prev => [...prev, { role: 'user', text: p }]);
    setEnviando(true);
    try {
      const historial = chat
        .map(m => `${m.role === 'user' ? 'Agricultor' : 'PlaguIA'}: ${m.text}`)
        .join('\n');

      const promptBase = resultado
        ? `Diagnóstico: ${resultado.nombre_problema || 'saludable'} en ${cultivo.nombre}. Gravedad: ${resultado.gravedad || 'ninguna'}.
Historial:
${historial}
Pregunta: ${p}
Responde breve (máx 4 oraciones) con dosis y carencia si aplica. Menciona Fungicidas en la app si necesita comprar.`
        : `Eres un agrónomo experto. El agricultor hace una consulta sin enviar foto. Cultivo: ${cultivo.nombre}.
Historial:
${historial}
Pregunta: ${p}
Responde breve (máx 4 oraciones) con recomendaciones prácticas. Indica si sería mejor tener una foto para precisar el diagnóstico.`;

      const resp = await invokeGemini({
        systemPrompt: CHAT_SYSTEM[cultivo.id] || CHAT_SYSTEM.papa,
        prompt: promptBase,
      });

      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      setChat(prev => [...prev, { role: 'ia', text: 'Error al procesar. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  // ── Enviar diagnóstico por WhatsApp ─────────────────────────────────────────
  const enviarDiagnosticoPorWhatsApp = async () => {
    if (!user?.celular && !user?.phone) {
      alert('Agrega tu número de celular en tu perfil para recibir el diagnóstico por WhatsApp.');
      return;
    }
    const telefono = (user.celular || user.phone || '').replace(/\D/g, '');
    if (telefono.length < 9) {
      alert('Número de celular inválido en tu perfil.');
      return;
    }

    setEnviandoWhatsApp(true);
    try {
      await sendWhatsApp(telefono, 'diagnostico', {
        cultivo: cultivo.nombre,
        problema: resultado.nombre_problema,
        gravedad: resultado.gravedad,
        accion: resultado.aplicacion_inmediata || resultado.que_hacer,
        productos: resultado.productos || [],
      });
      setWhatsAppEnviado(true);
      setTimeout(() => setWhatsAppEnviado(false), 5000);
    } catch (e) {
      console.error('WhatsApp error:', e.message);
      alert('No se pudo enviar el WhatsApp. Verifica tu número en el perfil.');
    }
    setEnviandoWhatsApp(false);
  };

  /* ═══════════════ PANTALLA RESULTADO ═══════════════ */
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-32">

      {mostrarAgente && (
        <AgenteCompra
          resultado={resultado} cultivo={cultivo} user={user}
          onCerrar={() => setMostrarAgente(false)}
        />
      )}

      {productoBuscando && (
        <TiendasConProducto
          productoBuscado={productoBuscando}
          onCerrar={() => setProductoBuscando(null)}
        />
      )}

      <div className={`px-6 pt-12 pb-6 text-white ${COLOR_HEADER[resultado.gravedad] || 'bg-primary'}`}>
        <button
          onClick={() => {
            setResultado(null);
            setFotos([]);
            setChat([]);
            setMostrarAgente(false);
            setSoilData(null);
            setNasaAlerts(null);
            setSentinelNDVI(null);
            setWhatsAppEnviado(false);
          }}
          className="text-white/70 text-sm mb-3">
          ← Nuevo diagnóstico
        </button>
        <div className="flex items-center gap-3">
          {resultado.tiene_problema ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          <div>
            <h1 className="text-xl font-display font-bold">
              {resultado.tiene_problema ? resultado.nombre_problema : '✓ Cultivo Saludable'}
            </h1>
            {resultado.nombre_cientifico && (
              <p className="text-white/70 text-xs italic">{resultado.nombre_cientifico}</p>
            )}
            <p className="text-white/80 text-sm mt-0.5">{cultivo.emoji} {cultivo.nombre}</p>
          </div>
        </div>
      </div>

      {weather && (
        <div className="px-4 py-4">
          <div className="bg-blue-50 rounded-2xl p-4 shadow-sm border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">🌦️ Clima informado</p>
            <p className="text-sm text-blue-800 font-semibold mb-2">{weather.location.name}</p>
            <p className="text-sm text-gray-700 mb-1">Temperatura actual: {weather.current?.temperature ?? weather.current?.temp}°C</p>
            <p className="text-sm text-gray-600">{weather.source === 'openweathermap' ? weather.current?.weather?.[0]?.description : 'Datos meteorológicos gratuitos disponibles'}</p>
          </div>
        </div>
      )}

      {/* MAPA SATELITAL NDVI */}
      {sentinelNDVI?.ndvi_image && (
        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              🛰 Imagen satelital de tu parcela (NDVI)
            </p>
            <img
              src={sentinelNDVI.ndvi_image}
              alt="NDVI Sentinel-2"
              className="w-full rounded-xl border border-gray-100"
            />
            <div className="flex justify-between mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" /> Sano
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-yellow-400 rounded-sm" /> Estrés leve
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-sm" /> Estrés severo
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Sentinel-2 ESA · Resolución 10m · Últimas 4 semanas
            </p>
          </div>
        </div>
      )}

      {/* ALERTAS NASA */}
      {nasaAlerts && nasaAlerts.riesgo !== 'ninguno' && (
        <div className="px-4">
          <div className={`rounded-2xl p-4 border ${
            nasaAlerts.riesgo === 'alto'
              ? 'bg-red-50 border-red-300'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
              nasaAlerts.riesgo === 'alto' ? 'text-red-600' : 'text-orange-600'
            }`}>
              🛰 Alerta NASA FIRMS
            </p>
            <p className={`text-sm ${
              nasaAlerts.riesgo === 'alto' ? 'text-red-700' : 'text-orange-700'
            }`}>
              {nasaAlerts.alerta}
            </p>
            <a
              href={nasaAlerts.mapa_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-500 underline mt-2 inline-block"
            >
              Ver en mapa NASA →
            </a>
          </div>
        </div>
      )}

      {/* DATOS DE SUELO */}
      {soilData?.suelo && (
        <div className="px-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              🪱 Análisis de suelo (SoilGrids ISRIC)
            </p>

            {soilData.suelo.ph.valor && (
              <div className="bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    pH del suelo
                  </span>
                  <span className={`text-sm font-bold ${
                    soilData.suelo.ph.nivel === 'Óptimo' || soilData.suelo.ph.nivel?.includes('Neutro')
                      ? 'text-green-600'
                      : soilData.suelo.ph.nivel?.includes('ácido') || soilData.suelo.ph.nivel?.includes('Ácido')
                      ? 'text-orange-500'
                      : 'text-gray-700'
                  }`}>
                    {soilData.suelo.ph.valor?.toFixed(1)} — {soilData.suelo.ph.nivel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {soilData.suelo.ph.recomendacion}
                </p>
              </div>
            )}

            {soilData.suelo.carbono_organico.valor && (
              <div className="bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Materia orgánica
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {soilData.suelo.carbono_organico.valor}% — {soilData.suelo.carbono_organico.nivel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {soilData.suelo.carbono_organico.recomendacion}
                </p>
              </div>
            )}

            {soilData.suelo.textura.arcilla && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: 'Arcilla', value: soilData.suelo.textura.arcilla },
                  { label: 'Arena',   value: soilData.suelo.textura.arena   },
                  { label: 'Limo',    value: soilData.suelo.textura.limo    },
                ].map(({ label, value }) => value && (
                  <div key={label} className="bg-amber-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-amber-600 font-bold">{label}</p>
                    <p className="text-xs text-gray-700 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTÓN WHATSAPP */}
      {resultado.tiene_problema && (
        <div className="px-4">
          <button
            onClick={enviarDiagnosticoPorWhatsApp}
            disabled={enviandoWhatsApp || whatsAppEnviado}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition-all ${
              whatsAppEnviado
                ? 'bg-green-100 text-green-700'
                : 'bg-green-500 text-white shadow-lg hover:bg-green-600'
            } disabled:opacity-60`}
          >
            {enviandoWhatsApp ? (
              <>⏳ Enviando...</>
            ) : whatsAppEnviado ? (
              <>✅ ¡Diagnóstico enviado a tu WhatsApp!</>
            ) : (
              <>📲 Enviar diagnóstico a mi WhatsApp</>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-1">
            Recibirás el resumen en tu celular registrado
          </p>
        </div>
      )}

      {plantDiagnosis && (
        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🔬 Análisis complementario</p>
            {plantDiagnosis.data?.suggestions?.length > 0 ? (
              <div className="space-y-3">
                {plantDiagnosis.data.suggestions.slice(0, 3).map((item, i) => (
                  <div key={i} className="rounded-2xl bg-slate-50 p-3 border border-gray-200">
                    <p className="font-semibold text-sm text-gray-800">{item.plant_name || item.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.plant_details?.common_names?.join(', ') || ''}</p>
                    {item.probability != null && (
                      <p className="text-xs text-gray-600 mt-2">Confianza: {(item.probability * 100).toFixed(0)}%</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No se encontró una sugerencia clara de planta/enfermedad.</p>
            )}
          </div>
        </div>
      )}

      {resultado.tiene_problema && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-3xl p-4 shadow-md border border-primary/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-primary" />
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">¿Qué deseas hacer?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => document.getElementById('chat-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm flex flex-col items-center gap-1">
                <span className="text-xl">💬</span>
                <span className="text-xs">Seguir consultando</span>
              </button>
              <button
                onClick={() => setMostrarAgente(true)}
                className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm flex flex-col items-center gap-1 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 animate-pulse rounded-2xl" />
                <span className="text-xl relative">🤖</span>
                <span className="text-xs relative">Completar proceso</span>
                <span className="text-[10px] relative text-white/80">Agente compra por ti</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🔍 Diagnóstico</p>
          <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_tiene}</p>
          {resultado.causa && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 mb-1">Causa probable</p>
              <p className="text-gray-600 text-xs">{resultado.causa}</p>
            </div>
          )}
        </div>

        {resultado.aplicacion_inmediata && resultado.tiene_problema && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">⚡ Acción Inmediata</p>
            <p className="text-red-700 text-sm leading-relaxed font-medium">{resultado.aplicacion_inmediata}</p>
          </div>
        )}

        {resultado.que_hacer && resultado.tiene_problema && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📋 Plan de Control</p>
            <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_hacer}</p>
            {resultado.cuando_aplicar && (
              <div className="mt-3 bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-600 mb-1">🕐 Cuándo aplicar</p>
                <p className="text-blue-700 text-xs">{resultado.cuando_aplicar}</p>
              </div>
            )}
          </div>
        )}

        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">💊 Productos Recomendados</p>
              <span className="text-xs text-gray-400">{resultado.productos.length} opciones</span>
            </div>
            <div className="space-y-3">
              {resultado.productos.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{p.nombre}</p>
                      {p.ingrediente_activo && (
                        <p className="text-xs text-gray-400 italic truncate">{p.ingrediente_activo}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setProductoBuscando(p.nombre)}
                      className="ml-2 flex-shrink-0 flex items-center gap-1 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      <ShoppingBag size={12} /> Ver precio
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {p.dosis && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400">Dosis</p>
                        <p className="text-xs font-semibold text-gray-700">{p.dosis}</p>
                      </div>
                    )}
                    {p.frecuencia && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400">Frecuencia</p>
                        <p className="text-xs font-semibold text-gray-700">{p.frecuencia}</p>
                      </div>
                    )}
                    {p.carencia && (
                      <div className="bg-amber-50 rounded-lg p-2 col-span-2">
                        <p className="text-xs text-amber-600 font-bold">⚠️ Carencia: {p.carencia}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {resultado.tiene_problema && (
              <button
                onClick={() => setMostrarAgente(true)}
                className="w-full mt-3 flex items-center justify-between bg-primary text-white rounded-2xl px-4 py-3.5 shadow">
                <div className="flex items-center gap-2">
                  <Bot size={18} />
                  <div className="text-left">
                    <p className="text-sm font-bold">Que el agente lo compre por ti</p>
                    <p className="text-xs text-white/80">Mejor precio + delivery coordinado</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-white/70" />
              </button>
            )}

            <button
              onClick={() => navigate('/mercado')}
              className="w-full mt-2 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary">Ver todas las tiendas</p>
              </div>
              <ChevronRight size={16} className="text-primary" />
            </button>
          </div>
        )}

        {resultado.alerta_clima && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-600 mb-1">🌤️ Condición Climática</p>
            <p className="text-blue-700 text-sm">{resultado.alerta_clima}</p>
          </div>
        )}

        {resultado.prevencion && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-green-700 mb-1">🛡️ Prevención Futura</p>
            <p className="text-green-800 text-sm">{resultado.prevencion}</p>
          </div>
        )}

        {leyendo
          ? <button onClick={detenerVoz}
              className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
              <VolumeX size={16} /> Detener audio
            </button>
          : <button onClick={() => leerTexto(`${resultado.aplicacion_inmediata || resultado.que_hacer || ''}. ${resultado.prevencion || ''}`)}
              className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 rounded-xl text-sm">
              <Volume2 size={16} /> Escuchar recomendación
            </button>
        }

        <div id="chat-section" className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💬 Consulta al Agrónomo IA</p>

          {chat.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {['¿Qué fungicida aplico?', '¿Cuánto producto necesito?', '¿Cuándo vuelvo a aplicar?'].map(s => (
                <button key={s} onClick={() => setPregunta(s)}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {chat.length > 0 && (
            <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                  }`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={pregunta} onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarPregunta()}
              placeholder="Ej: ¿Qué fungicida aplico en Cutervo?"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={grabando ? () => reconRef.current?.stop() : grabarVoz}
              className={`p-2.5 rounded-xl ${grabando ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {grabando ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={enviarPregunta} disabled={!pregunta.trim() || enviando}
              className="bg-primary text-white p-2.5 rounded-xl disabled:opacity-50">
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══════════════ PANTALLA UPLOAD ═══════════════ */
  return (
    <div className="min-h-screen pb-32">
      <div className="bg-gradient-to-b from-primary to-primary-dark text-white px-6 pt-12 pb-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Camera size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold">Diagnóstico IA</h1>
          <p className="text-white/80 text-sm mt-2">Detecta plagas, enfermedades y malezas</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="bg-white/20 border-2 border-white/40 border-dashed rounded-3xl p-8 text-center cursor-pointer hover:bg-white/30 transition-all active:scale-95">
          {fotos.length === 0 ? (
            <>
              <Camera size={48} className="mx-auto text-white mb-3" />
              <p className="text-white font-bold text-xl">📸 Subir foto del cultivo</p>
              <p className="text-white/70 text-sm mt-1">Hoja, tallo, raíz o fruto afectado</p>
              <p className="text-white/50 text-xs mt-2">Puedes subir varias fotos</p>
            </>
          ) : (
            <div>
              <div className="relative">
                <img
                  src={fotos[currentIndex]?.preview}
                  alt="foto principal"
                  className="w-full h-64 object-contain rounded-xl bg-white p-2 mx-auto"
                  onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setFotos(prev => prev.filter((_, j) => j !== currentIndex)); setCurrentIndex(0); }}
                  className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-7 h-7 text-xs flex items-center justify-center">
                  ×
                </button>
                {fotos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + fotos.length) % fotos.length); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/60 text-gray-800 rounded-full w-9 h-9 flex items-center justify-center">
                      ‹
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % fotos.length); }}
                      className="absolute right-12 top-1/2 -translate-y-1/2 bg-white/60 text-gray-800 rounded-full w-9 h-9 flex items-center justify-center">
                      ›
                    </button>
                  </>
                )}
              </div>

              <div className="flex gap-2 mt-3 overflow-x-auto">
                {fotos.map((f, i) => (
                  <div key={i} className={`relative ${i === currentIndex ? 'ring-2 ring-primary rounded-lg' : ''}`}>
                    <img
                      src={f.preview}
                      alt={`thumb-${i}`}
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                      className="w-20 h-20 object-cover rounded-xl cursor-pointer"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setFotos(prev => prev.filter((_, j) => j !== i)); setCurrentIndex(0); }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      ×
                    </button>
                  </div>
                ))}
                <div className="w-20 h-20 border-2 border-dashed border-white/40 rounded-xl flex items-center justify-center text-white/70 cursor-pointer"
                     onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  <Camera size={20} />
                </div>
              </div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} className="hidden" />
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🌦️ Clima de tu parcela</p>
            <span className="text-xs text-gray-400">API gratuita</span>
          </div>
          <div className="flex gap-2">
            <input
              value={ubicacion} onChange={e => setUbicacion(e.target.value)}
              placeholder="Distrito, ciudad o parcela"
              className="flex-1 border border-gray-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={buscarClima}
              disabled={weatherLoading}
              className="bg-primary text-white px-4 rounded-2xl text-sm font-semibold disabled:opacity-50">
              {weatherLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {weather && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-800">{weather.location.name}</p>
              <p className="mt-2">Temperatura actual: {weather.current?.temperature ?? weather.current?.temp}°C</p>
              <p>{weather.source === 'openweathermap' ? weather.current?.weather?.[0]?.description : 'Datos de clima local disponibles'}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(weather.daily?.temperature_2m_max || weather.daily?.temp_max) && (
                  <div className="rounded-2xl bg-white p-3 border border-gray-100">
                    <p className="text-[10px] uppercase text-gray-400">Máx.</p>
                    <p className="font-semibold text-gray-800">{weather.daily.temperature_2m_max?.[0] ?? weather.daily.temp_max?.[0]}°C</p>
                  </div>
                )}
                {(weather.daily?.temperature_2m_min || weather.daily?.temp_min) && (
                  <div className="rounded-2xl bg-white p-3 border border-gray-100">
                    <p className="text-[10px] uppercase text-gray-400">Mín.</p>
                    <p className="font-semibold text-gray-800">{weather.daily.temperature_2m_min?.[0] ?? weather.daily.temp_min?.[0]}°C</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">¿Qué cultivo es?</p>
          <div className="flex gap-3 justify-center">
            {CULTIVOS.map(c => (
              <button key={c.id} onClick={() => setCultivo(c)}
                className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
                  cultivo.id === c.id
                    ? 'bg-primary text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs font-bold">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={analizar} disabled={!fotos.length || analizando}
          className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-6 rounded-2xl disabled:opacity-50 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            {analizando
              ? <span className="flex items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin" /> Analizando con PlaguIA...
                </span>
              : <span className="flex items-center justify-center gap-2 text-lg">
                  <span>🔬</span> Iniciar Diagnóstico
                </span>
            }
          </div>
        </button>

        {resultado?.error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-600 font-semibold text-sm">Error en el análisis</p>
            <p className="text-red-400 text-xs mt-1">Intenta con una foto más clara y bien iluminada</p>
          </div>
        )}

        <button
          onClick={() => { setConsultandoSinFoto(true); setChat([]); }}
          className="w-full bg-white border border-primary/20 text-primary font-semibold py-4 rounded-2xl shadow-sm hover:bg-primary/5 transition-colors">
          💬 Consultar sin foto
        </button>

        {consultandoSinFoto && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💬 Consulta sin foto</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {['¿Qué fungicida aplico?', '¿Cuánto producto necesito?', '¿Cuándo volver a aplicar?'].map(s => (
                <button key={s} onClick={() => setPregunta(s)}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={pregunta} onChange={e => setPregunta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarPregunta()}
                placeholder="Ej: ¿Qué tratamiento usar sin foto?"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={enviarPregunta} disabled={!pregunta.trim() || enviando}
                className="bg-primary text-white p-2.5 rounded-xl disabled:opacity-50">
                {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>

            {chat.length > 0 && (
              <div className="space-y-2 mt-4 max-h-72 overflow-y-auto">
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                    }`}>{m.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🤖 PlaguIA detecta</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { e: '🦠', t: 'Enfermedades fúngicas y bacterianas' },
              { e: '🐛', t: 'Plagas e insectos dañinos' },
              { e: '🌿', t: 'Malezas y plantas invasoras' },
              { e: '🤖', t: 'Agente compra el fungicida por ti' },
            ].map(({ e, t }) => (
              <div key={t} className="bg-white rounded-xl p-2.5 flex items-center gap-2">
                <span className="text-lg">{e}</span>
                <p className="text-xs text-gray-600">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
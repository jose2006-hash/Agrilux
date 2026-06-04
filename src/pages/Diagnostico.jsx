import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Loader2, AlertTriangle, CheckCircle, Send,
  Mic, MicOff, Volume2, VolumeX, ShoppingBag,
  ChevronRight, Bot, Sparkles, ImagePlus, X, MapPin,
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
} from '../lib/externalApis';
import { CULTIVOS }      from '../lib/constants';
import { db }            from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate }   from 'react-router-dom';

import { SISTEMA_PROMPT, CHAT_SYSTEM, ANALISIS_SCHEMA } from './diagnostico/diagnosticoPrompts';
import TiendasConProducto from './diagnostico/TiendasConProducto';
import AgenteCompra       from './diagnostico/AgenteCompra';
import SelectorUbicacion  from '../components/SelectorUbicacion';

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
  const [analizando, setAnalizando]     = useState(false);
  const [resultado, setResultado]       = useState(null);
  const [chat, setChat]                 = useState([]);
  const [pregunta, setPregunta]         = useState('');
  const [enviando, setEnviando]         = useState(false);
  const [grabando, setGrabando]         = useState(false);

  // Clima — invisible al usuario, usado internamente
  const [ubicacion, setUbicacion]       = useState('');
  const [weather, setWeather]           = useState(null);
  const [locationInfo, setLocationInfo] = useState(null);

  const [plantDiagnosis, setPlantDiagnosis]     = useState(null);
  const [plantIdentificando, setPlantIdentificando] = useState(false);
  const [leyendo, setLeyendo]                   = useState(false);
  const [productoBuscando, setProductoBuscando] = useState(null);
  const [mostrarAgente, setMostrarAgente]       = useState(false);

  // APIs enriquecidas
  const [soilData, setSoilData]               = useState(null);
  const [nasaAlerts, setNasaAlerts]           = useState(null);
  const [sentinelNDVI, setSentinelNDVI]       = useState(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [whatsAppEnviado, setWhatsAppEnviado]   = useState(false);

  const fileRef    = useRef(null);
  const chatEndRef = useRef(null);
  const reconRef   = useRef(null);
  const reconPregRef = useRef(null);
  const ubicacionInputRef = useRef(null);
  const [pedirUbicacion, setPedirUbicacion] = useState(false);
  const [mostrarSelectorUbicacion, setMostrarSelectorUbicacion] = useState(false);

  const ubicacionEfectiva = (ubicacion || user?.ubicacion || '').trim();

  // ── Geolocalización silenciosa al montar ─────────────────────────────────────
  // Intenta obtener ubicación del navegador en background, sin mostrar nada al usuario
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [climaRes, soilRes, nasaRes] = await Promise.allSettled([
            getWeather(lat, lon, ''),
            getSoilData(lat, lon),
            getNasaAlerts(lat, lon),
          ]);
          if (climaRes.status === 'fulfilled') setWeather(climaRes.value);
          if (soilRes.status === 'fulfilled')  setSoilData(soilRes.value);
          if (nasaRes.status === 'fulfilled')  setNasaAlerts(nasaRes.value);
          // NDVI más tarde, no bloquea
          getSentinelNDVI(lat, lon, 2)
            .then(setSentinelNDVI)
            .catch(() => {});
        } catch (e) { /* silencioso */ }
      },
      () => { /* sin permisos: no pasa nada */ },
      { timeout: 8000 }
    );
  }, []);

  // Prefill de ubicación visible (si el usuario la tiene en perfil)
  useEffect(() => {
    if (!ubicacion && user?.ubicacion) setUbicacion(user.ubicacion);
  }, [user?.ubicacion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFoto = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () =>
        setFotos(prev => {
          const next = [...prev, { preview: reader.result, dataUrl: reader.result }];
          try { setCurrentIndex(next.length - 1); } catch {}
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

  // ── Construir contexto climático para enriquecer el prompt ──────────────────
  const buildClimaContext = () => {
    if (!weather) return '';
    const temp = weather.current?.temperature ?? weather.current?.temp ?? '';
    const desc = weather.source === 'openweathermap'
      ? weather.current?.weather?.[0]?.description || ''
      : '';
    const lluvia = weather.daily?.precipitation_sum?.[0];
    const partes = [`Temperatura: ${temp}°C`];
    if (desc) partes.push(desc);
    if (lluvia != null) partes.push(`Lluvia hoy: ${lluvia}mm`);
    if (soilData?.suelo?.ph?.valor) partes.push(`pH suelo: ${soilData.suelo.ph.valor.toFixed(1)} (${soilData.suelo.ph.nivel})`);
    if (nasaAlerts?.riesgo && nasaAlerts.riesgo !== 'ninguno') partes.push(`Alerta NASA: ${nasaAlerts.alerta}`);
    return partes.join(' | ');
  };

  const analizarUnaVez = async (compressedUrls, consultaTexto = '') => {
    const climaCtx = buildClimaContext();
    const esConsultaTexto = !compressedUrls.length && consultaTexto;
    const lugar = ubicacionEfectiva;
    const lugarCtx = lugar ? `Ubicación declarada por el agricultor: ${lugar}.` : '';

    const promptBase = esConsultaTexto
      ? `El agricultor consulta sin foto sobre su ${cultivo.nombre}: "${consultaTexto}"
${lugarCtx}
${climaCtx ? `Contexto ambiental: ${climaCtx}` : ''}
Usa el contexto climático y de suelo para dar una recomendación precisa.
Responde SOLO con este JSON (sin markdown):
{"tiene_problema":true,"nombre_problema":"Consulta directa","nombre_cientifico":"","gravedad":"leve","que_tiene":"${consultaTexto}","causa":"","aplicacion_inmediata":"","que_hacer":"","productos":[],"cuando_aplicar":"","prevencion":"","alerta_clima":""}`
      : `Analiza la foto de ${cultivo.nombre} y evalúa su estado fitosanitario.
${lugarCtx}
${climaCtx ? `Contexto ambiental actual de la parcela: ${climaCtx}. Usa estos datos para ajustar tus recomendaciones (ej: si hay lluvia, prioriza fungicidas sistémicos; si el pH es ácido, ajusta dosis).` : ''}
Identifica alteraciones visuales (color, manchas, deformaciones, lesiones).
FORMATO OBLIGATORIO (didáctico y preciso, tono animado):
1) En que_tiene: Detección (qué es y signos) + Causas probables + Prevención (en frases cortas).
2) En que_hacer: Recomendaciones de soluciones y métodos (culturales + químicas si aplica).
3) En aplicacion_inmediata + productos: Productos recomendados y modo de uso (dosis, frecuencia, carencia).
Usa español simple para agricultores. Si está sana: tiene_problema false.
Responde SOLO con este JSON (sin markdown):
{"tiene_problema":bool,"nombre_problema":"","nombre_cientifico":"","gravedad":"ninguna|leve|moderada|grave|critica","que_tiene":"","causa":"","aplicacion_inmediata":"","que_hacer":"","productos":[{"nombre":"","ingrediente_activo":"","dosis":"","frecuencia":"","carencia":""}],"cuando_aplicar":"","prevencion":"","alerta_clima":""}`;

    return invokeGemini({
      systemPrompt: SISTEMA_PROMPT[cultivo.id],
      prompt: promptBase,
      file_urls: compressedUrls,
      response_json_schema: ANALISIS_SCHEMA,
    });
  };

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

  // ── Analizar: con foto, con texto, o con audio transcrito ───────────────────
  const analizar = async (consultaTextoOverride = '') => {
    const textoConsulta = consultaTextoOverride || pregunta.trim();
    if (!fotos.length && !textoConsulta) return;

    setAnalizando(true);
    setPlantDiagnosis(null);

    try {
      let compressedUrls = [];

      if (fotos.length) {
        compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));
        setPlantIdentificando(true);
        try {
          const plantData = await identifyPlantDisease(compressedUrls);
          if (plantData) setPlantDiagnosis(plantData);
        } catch (err) {
          console.warn('Plant disease detection failed:', err);
        } finally {
          setPlantIdentificando(false);
        }
      }

      const intentos = [];
      for (let i = 0; i < 3; i++) {
        intentos.push(await analizarUnaVez(compressedUrls, textoConsulta));
      }

      const todosFallaron = intentos.every(r =>
        !r.nombre_problema && !r.tiene_problema &&
        (!r.que_tiene || r.que_tiene.includes('No se pudo') || r.que_tiene.includes('correctamente'))
      );
      if (todosFallaron) { setResultado({ error: true }); setAnalizando(false); return; }

      const analisis = obtenerConsenso(intentos);
      setResultado(analisis);
      setChat([]);
      setPregunta('');

      try {
        await addDoc(collection(db, 'diagnosticos'), {
          userId:        user?.uid    ?? null,
          userName:      user?.nombre ?? null,
          userEmail:     user?.email  ?? null,
          cultivo:       cultivo.id,
          cultivoNombre: cultivo.nombre,
          conFoto:       fotos.length > 0,
          consultaTexto: textoConsulta || null,
          climaContexto: buildClimaContext() || null,
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

  // ── Grabar voz para la consulta principal ────────────────────────────────────
  const grabarVozConsulta = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Usa Chrome para la función de voz'); return;
    }
    if (grabando) { reconPregRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.lang = 'es-PE'; r.continuous = false;
    r.onstart  = () => setGrabando(true);
    r.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      setPregunta(texto);
      setGrabando(false);
      // Si dictó la consulta y no hay fotos, analizar directo
      if (!fotos.length) setTimeout(() => analizar(texto), 300);
    };
    r.onerror  = () => setGrabando(false);
    r.onend    = () => setGrabando(false);
    reconPregRef.current = r;
    r.start();
  };

  // ── Grabar voz para el chat del resultado ────────────────────────────────────
  const grabarVozChat = () => {
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
      const climaCtx = buildClimaContext();
      const historial = chat
        .map(m => `${m.role === 'user' ? 'Agricultor' : 'PlaguIA'}: ${m.text}`)
        .join('\n');

      const promptBase = resultado
        ? `Diagnóstico: ${resultado.nombre_problema || 'saludable'} en ${cultivo.nombre}. Gravedad: ${resultado.gravedad || 'ninguna'}.
${climaCtx ? `Contexto ambiental: ${climaCtx}.` : ''}
Historial:
${historial}
Pregunta: ${p}
Responde breve (máx 4 oraciones) con dosis y carencia si aplica. Si el clima o suelo son relevantes, menciónalos.`
        : `Eres un agrónomo experto. Cultivo: ${cultivo.nombre}.
${climaCtx ? `Contexto ambiental: ${climaCtx}.` : ''}
Historial:
${historial}
Pregunta: ${p}
Responde breve (máx 4 oraciones) con recomendaciones prácticas ajustadas al clima y suelo si tienes esa info.`;

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

  const enviarDiagnosticoPorWhatsApp = async () => {
    if (!user?.celular && !user?.phone) {
      alert('Agrega tu número de celular en tu perfil para recibir el diagnóstico por WhatsApp.');
      return;
    }
    const telefono = (user.celular || user.phone || '').replace(/\D/g, '');
    if (telefono.length < 9) { alert('Número de celular inválido en tu perfil.'); return; }
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
      alert('No se pudo enviar el WhatsApp. Verifica tu número en el perfil.');
    }
    setEnviandoWhatsApp(false);
  };

  const resetear = () => {
    setResultado(null); setFotos([]); setChat([]);
    setMostrarAgente(false); setSoilData(null);
    setNasaAlerts(null); setSentinelNDVI(null);
    setWhatsAppEnviado(false); setPregunta('');
  };

  /* ═══════════════════════════════════════════════
     PANTALLA RESULTADO
  ═══════════════════════════════════════════════ */
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-32">

      {mostrarAgente && (
        <AgenteCompra resultado={resultado} cultivo={cultivo} user={user} onCerrar={() => setMostrarAgente(false)} />
      )}
      {productoBuscando && (
        <TiendasConProducto
          productoBuscado={productoBuscando}
          ubicacionUsuario={ubicacionEfectiva}
          onCerrar={() => setProductoBuscando(null)}
        />
      )}

      {/* Header */}
      <div className={`px-6 pt-12 pb-6 text-white ${COLOR_HEADER[resultado.gravedad] || 'bg-primary'}`}>
        <button onClick={resetear} className="text-white/70 text-sm mb-3">← Nuevo diagnóstico</button>
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
        {/* Clima usado internamente — solo confirmación discreta */}
        {weather && (
          <p className="text-white/50 text-xs mt-3">
            🌡 Diagnóstico ajustado al clima de tu zona · {weather.current?.temperature ?? weather.current?.temp}°C
          </p>
        )}
      </div>

      {/* NDVI satelital */}
      {sentinelNDVI?.ndvi_image && (
        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🛰 Imagen satelital NDVI de tu parcela</p>
            <img src={sentinelNDVI.ndvi_image} alt="NDVI" className="w-full rounded-xl border border-gray-100" />
            <div className="flex justify-between mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-500 rounded-sm" /> Sano</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-400 rounded-sm" /> Estrés leve</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-500 rounded-sm" /> Estrés severo</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Sentinel-2 ESA · Resolución 10m · Últimas 4 semanas</p>
          </div>
        </div>
      )}

      {/* Alertas NASA */}
      {nasaAlerts && nasaAlerts.riesgo !== 'ninguno' && (
        <div className="px-4 pb-3">
          <div className={`rounded-2xl p-4 border ${nasaAlerts.riesgo === 'alto' ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${nasaAlerts.riesgo === 'alto' ? 'text-red-600' : 'text-orange-600'}`}>
              🛰 Alerta NASA FIRMS
            </p>
            <p className={`text-sm ${nasaAlerts.riesgo === 'alto' ? 'text-red-700' : 'text-orange-700'}`}>{nasaAlerts.alerta}</p>
            <a href={nasaAlerts.mapa_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline mt-2 inline-block">Ver en mapa NASA →</a>
          </div>
        </div>
      )}

      {/* Datos de suelo */}
      {soilData?.suelo && (
        <div className="px-4 pb-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🪱 Análisis de suelo</p>
            {soilData.suelo.ph.valor && (
              <div className="bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">pH del suelo</span>
                  <span className={`text-sm font-bold ${
                    soilData.suelo.ph.nivel?.includes('Neutro') || soilData.suelo.ph.nivel?.includes('Ligeramente ácido')
                      ? 'text-green-600' : 'text-orange-500'}`}>
                    {soilData.suelo.ph.valor?.toFixed(1)} — {soilData.suelo.ph.nivel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{soilData.suelo.ph.recomendacion}</p>
              </div>
            )}
            {soilData.suelo.carbono_organico.valor && (
              <div className="bg-gray-50 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Materia orgánica</span>
                  <span className="text-sm font-bold text-gray-700">{soilData.suelo.carbono_organico.valor}% — {soilData.suelo.carbono_organico.nivel}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{soilData.suelo.carbono_organico.recomendacion}</p>
              </div>
            )}
            {soilData.suelo.textura.arcilla && (
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { label: 'Arcilla', value: soilData.suelo.textura.arcilla },
                  { label: 'Arena',   value: soilData.suelo.textura.arena },
                  { label: 'Limo',    value: soilData.suelo.textura.limo },
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

      {/* Análisis complementario crop.health / plant.id */}
      {plantDiagnosis && (
        <div className="px-4 pb-3">
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
                    {item.plant_details?.cause && <p className="text-xs text-red-500 mt-1">Causa: {item.plant_details.cause}</p>}
                    {item.plant_details?.severity && <p className="text-xs text-orange-500 mt-1">Severidad: {item.plant_details.severity}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No se encontró sugerencia clara.</p>
            )}
            <p className="text-xs text-gray-300 mt-3 text-right">
              {plantDiagnosis.source === 'crop.health' ? '🌱 Crop.health · EPPO' : '🌿 Plant.id'}
            </p>
          </div>
        </div>
      )}

      {/* CTA acciones */}
      {resultado.tiene_problema && (
        <div className="px-4 pb-3">
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

      <div className="px-4 space-y-4">

        {/* 1) Detección + causas + prevención (didáctico) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">1) 🕵️ Detección, causas y prevención</p>
          {resultado.que_tiene && (
            <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_tiene}</p>
          )}
          {(resultado.causa || resultado.prevencion) && (
            <div className="mt-3 grid gap-2">
              {resultado.causa && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1">Causas probables</p>
                  <p className="text-amber-800 text-xs leading-relaxed">{resultado.causa}</p>
                </div>
              )}
              {resultado.prevencion && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">Prevención</p>
                  <p className="text-green-800 text-xs leading-relaxed">{resultado.prevencion}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2) Soluciones y métodos */}
        {resultado.tiene_problema && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">2) 🛠️ Soluciones y métodos</p>
            {resultado.que_hacer ? (
              <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_hacer}</p>
            ) : (
              <p className="text-gray-500 text-sm">Sin plan adicional.</p>
            )}
            {resultado.cuando_aplicar && (
              <div className="mt-3 bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-600 mb-1">🕐 Cuándo aplicar</p>
                <p className="text-blue-700 text-xs">{resultado.cuando_aplicar}</p>
              </div>
            )}
            {resultado.aplicacion_inmediata && (
              <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs font-bold text-red-600 mb-1">⚡ Acción inmediata</p>
                <p className="text-red-700 text-sm leading-relaxed font-medium">{resultado.aplicacion_inmediata}</p>
              </div>
            )}
          </div>
        )}

        {/* 3) Productos y modo de uso */}
        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">3) 💊 Productos recomendados y modo de uso</p>
              <span className="text-xs text-gray-400">{resultado.productos.length} opciones</span>
            </div>
            <div className="space-y-3">
              {resultado.productos.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{p.nombre}</p>
                      {p.ingrediente_activo && <p className="text-xs text-gray-400 italic truncate">{p.ingrediente_activo}</p>}
                    </div>
                    <button
                      onClick={() => {
                        if (!ubicacionEfectiva) {
                          setPedirUbicacion(true);
                          setTimeout(() => ubicacionInputRef.current?.focus(), 50);
                          return;
                        }
                        setProductoBuscando(p.nombre);
                      }}
                      className="ml-2 flex-shrink-0 flex items-center gap-1 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      <ShoppingBag size={12} /> Ver precio
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {p.dosis && <div className="bg-white rounded-lg p-2"><p className="text-xs text-gray-400">Dosis</p><p className="text-xs font-semibold text-gray-700">{p.dosis}</p></div>}
                    {p.frecuencia && <div className="bg-white rounded-lg p-2"><p className="text-xs text-gray-400">Frecuencia</p><p className="text-xs font-semibold text-gray-700">{p.frecuencia}</p></div>}
                    {p.carencia && <div className="bg-amber-50 rounded-lg p-2 col-span-2"><p className="text-xs text-amber-600 font-bold">⚠️ Carencia: {p.carencia}</p></div>}
                  </div>
                </div>
              ))}
            </div>

            {resultado.tiene_problema && (
              <button onClick={() => setMostrarAgente(true)}
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

            <button onClick={() => navigate('/mercado')}
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

        {/* WhatsApp */}
        {resultado.tiene_problema && (
          <div>
            <button
              onClick={enviarDiagnosticoPorWhatsApp}
              disabled={enviandoWhatsApp || whatsAppEnviado}
              className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition-all ${
                whatsAppEnviado ? 'bg-green-100 text-green-700' : 'bg-green-500 text-white shadow-lg hover:bg-green-600'
              } disabled:opacity-60`}>
              {enviandoWhatsApp ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                : whatsAppEnviado ? <>✅ ¡Diagnóstico enviado a tu WhatsApp!</>
                : <>📲 Enviar diagnóstico a mi WhatsApp</>}
            </button>
            <p className="text-xs text-gray-400 text-center mt-1">Recibirás el resumen en tu celular registrado</p>
          </div>
        )}

        {/* Audio */}
        {leyendo
          ? <button onClick={detenerVoz} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
              <VolumeX size={16} /> Detener audio
            </button>
          : <button onClick={() => leerTexto(`${resultado.aplicacion_inmediata || resultado.que_hacer || ''}. ${resultado.prevencion || ''}`)}
              className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 rounded-xl text-sm">
              <Volume2 size={16} /> Escuchar recomendación
            </button>
        }

        {/* Chat del resultado */}
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
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.text}
                  </div>
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
            <button onClick={grabarVozChat}
              className={`p-2.5 rounded-xl ${grabando ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {grabando ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={enviarPregunta} disabled={!pregunta.trim() || enviando}
              className="bg-primary text-white p-2.5 rounded-xl disabled:opacity-50">
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     PANTALLA UPLOAD — zona unificada
  ═══════════════════════════════════════════════ */
  const puedeAnalizar = fotos.length > 0 || pregunta.trim().length > 0;

  return (
    <div className="min-h-screen pb-32">

      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-primary-dark text-white px-6 pt-12 pb-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Camera size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold">Diagnóstico IA</h1>
          <p className="text-white/80 text-sm mt-2">Detecta plagas, enfermedades y malezas</p>
        </div>

        {/* ── ZONA UNIFICADA: foto + texto + audio ── */}
        <div className="bg-white/10 border border-white/20 rounded-3xl overflow-hidden">

          {/* Área de foto — opcional */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-b border-white/10 p-5 text-center cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]">
            {fotos.length === 0 ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <ImagePlus size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">Añadir foto del cultivo</p>
                  <p className="text-white/60 text-xs">Opcional · hoja, tallo, raíz o fruto</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <img
                    src={fotos[currentIndex]?.preview}
                    alt="foto principal"
                    className="w-full h-52 object-contain rounded-2xl bg-black/20 mx-auto"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setFotos(prev => prev.filter((_, j) => j !== currentIndex)); setCurrentIndex(0); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center">
                    <X size={14} />
                  </button>
                  {fotos.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + fotos.length) % fotos.length); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center">‹</button>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % fotos.length); }}
                        className="absolute right-10 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center">›</button>
                    </>
                  )}
                </div>
                {fotos.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto justify-center">
                    {fotos.map((f, i) => (
                      <div key={i} className={`relative flex-shrink-0 ${i === currentIndex ? 'ring-2 ring-white rounded-lg' : ''}`}>
                        <img src={f.preview} alt={`thumb-${i}`}
                          onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                          className="w-14 h-14 object-cover rounded-lg cursor-pointer" />
                      </div>
                    ))}
                    <div className="w-14 h-14 border border-dashed border-white/40 rounded-lg flex items-center justify-center text-white/60 cursor-pointer flex-shrink-0"
                       onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                      <Camera size={16} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} className="hidden" />

          {/* Área de texto + audio */}
          <div className="p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={pregunta}
                onChange={e => setPregunta(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (puedeAnalizar && !analizando) analizar(); } }}
                placeholder={fotos.length > 0
                  ? 'Opcional: describe qué ves o haz una pregunta...'
                  : 'Describe el problema de tu cultivo o pregunta algo...'}
                rows={2}
                className="flex-1 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-white/50"
              />
              {/* Botón micrófono */}
              <button
                onClick={grabarVozConsulta}
                className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  grabando ? 'bg-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'}`}>
                {grabando ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
              </button>
            </div>
            {grabando && (
              <p className="text-white/60 text-xs mt-2 text-center flex items-center justify-center gap-1">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-ping inline-block" /> Escuchando...
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Ubicación — botón para cambiar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📍 Ubicación</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-700 font-medium truncate">
                {user?.ubicacion || 'Sin ubicación'}
              </span>
            </div>
            <button onClick={() => setMostrarSelectorUbicacion(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-all shadow-md active:scale-95">
              <MapPin size={16} />
              Cambiar ubicación
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            GPS · Voz · Texto — para recomendaciones más precisas
          </p>
        </div>

        {/* Selector de cultivo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">¿Qué cultivo es?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {CULTIVOS.map(c => (
              <button key={c.id} onClick={() => setCultivo(c)}
                className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
                  cultivo.id === c.id ? 'bg-primary text-white shadow-md scale-105' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs font-bold">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Botón analizar */}
        <button
          onClick={() => analizar()}
          disabled={!puedeAnalizar || analizando}
          className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-6 rounded-2xl disabled:opacity-40 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            {analizando
              ? <span className="flex items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin" /> Analizando con PlaguIA...
                </span>
              : <span className="flex items-center justify-center gap-2">
                  <span>🔬</span>
                  {fotos.length > 0 && pregunta.trim() ? 'Analizar foto + consulta'
                    : fotos.length > 0 ? 'Iniciar Diagnóstico'
                    : pregunta.trim() ? 'Consultar al agrónomo IA'
                    : 'Sube una foto o escribe tu consulta'}
                </span>
            }
          </div>
        </button>

        {resultado?.error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-600 font-semibold text-sm">Error en el análisis</p>
            <p className="text-red-400 text-xs mt-1">Intenta con una foto más clara o describe el problema con más detalle</p>
          </div>
        )}

        {/* PlaguIA detecta */}
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

      {mostrarSelectorUbicacion && (
        <div className="fixed inset-0 z-50 bg-white/95 flex items-center justify-center" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-[430px] mx-auto relative">
            <SelectorUbicacion esPrimeraVez={false} onClose={() => setMostrarSelectorUbicacion(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useRef } from 'react';
import { Camera, Loader2, AlertTriangle, CheckCircle, Send,
         Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { invokeGemini } from '../lib/gemini';
import { geocodeUbicacion, getWeather } from '../lib/agromonitoring';
import { CULTIVOS } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Diagnostico({ onPlagaDetectada }) {  // ← MODIFICADO: recibir prop
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cultivo, setCultivo] = useState(CULTIVOS[0]);
  const [fotos, setFotos] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [chat, setChat] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [ctxUbicacion, setCtxUbicacion] = useState(user?.ubicacion || '');
  const [ctxCoords, setCtxCoords] = useState(null); // { lat, lon }
  const [ctxWeather, setCtxWeather] = useState(null);
  const [esperandoUbicacion, setEsperandoUbicacion] = useState(false);
  const [preguntaPendiente, setPreguntaPendiente] = useState('');
  const fileRef = useRef(null);
  const chatRef = useRef(null);
  const reconRef = useRef(null);

  const parseCoords = (text) => {
    // Acepta "lat, lon" o "lat lon"
    const m = text.match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  };

  const ensureUbicacionYClima = async (ubicacionInput) => {
    const coordsDirectas = parseCoords(ubicacionInput);
    const geo = coordsDirectas || await geocodeUbicacion(ubicacionInput);
    const coords = coordsDirectas || { lat: geo.lat, lon: geo.lon };
    setCtxUbicacion(geo?.name ? `${geo.name}${geo.state ? `, ${geo.state}` : ''}${geo.country ? `, ${geo.country}` : ''}` : ubicacionInput);
    setCtxCoords(coords);
    const w = await getWeather({ lat: coords.lat, lon: coords.lon, units: 'metric' });
    setCtxWeather(w);
    return { coords, weather: w };
  };

  const handleFoto = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () =>
        setFotos(prev => [...prev, { preview: reader.result, dataUrl: reader.result }]);
      reader.readAsDataURL(file);
    });
  };

  const compressDataUrl = (dataUrl) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 600;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = h * MAX / w; w = MAX; }
      else if (h > MAX) { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });

  const analizar = async () => {
    if (fotos.length === 0) { alert('Sube al menos una foto'); return; }
    setAnalizando(true);
    try {
      const compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));
      const analisis = await invokeGemini({
        prompt: `Eres un agrónomo experto en cultivos del Perú. Analiza esta imagen de ${cultivo.nombre} y da un diagnóstico claro y sencillo para un agricultor.

Datos:
- Cultivo: ${cultivo.nombre} (${cultivo.emoji})
- Ubicación: ${ctxUbicacion || user?.ubicacion || 'No especificada'}

IMPORTANTE: Responde en lenguaje simple y directo, sin términos técnicos complejos.`,
        file_urls: compressedUrls,
        response_json_schema: {
          type: 'object',
          properties: {
            tiene_problema: { type: 'boolean' },
            nombre_problema: { type: 'string' },
            gravedad: { type: 'string', enum: ['ninguna', 'leve', 'moderada', 'grave'] },
            que_tiene: { type: 'string' },
            que_hacer: { type: 'string' },
            productos: {
              type: 'array',
              items: {
                type: 'object',
                properties: { nombre: { type: 'string' }, dosis: { type: 'string' } }
              }
            },
            prevencion: { type: 'string' },
          }
        }
      });

      setResultado(analisis);
      // ← MODIFICADO: agregar esta línea
      if (analisis.tiene_problema && onPlagaDetectada) onPlagaDetectada(analisis.nombre_problema);

      try {
        const userId = user?.uid || user?.id || null;
        if (userId) {
          await addDoc(collection(db, 'diagnosticos'), {
            userId,
            userName: user?.nombre || '',
            cultivo: cultivo.nombre,
            ubicacion: user?.ubicacion || '',
            resultado: analisis,
            fecha: new Date().toISOString(),
          });
        }
      } catch (e) { console.log('Firebase save error', e); }

      leerTexto(`${analisis.tiene_problema
        ? `Tu ${cultivo.nombre} tiene ${analisis.nombre_problema}. ${analisis.que_hacer}`
        : `Tu ${cultivo.nombre} está saludable.`}`);
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
    u.lang = 'es-PE'; u.rate = 0.9;
    setLeyendo(true);
    u.onend = () => setLeyendo(false);
    u.onerror = () => setLeyendo(false);
    window.speechSynthesis.speak(u);
  };

  const detenerVoz = () => { window.speechSynthesis?.cancel(); setLeyendo(false); };

  const grabarVoz = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tu navegador no soporta voz. Usa Chrome.'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-PE'; r.continuous = false;
    r.onstart = () => setGrabando(true);
    r.onresult = (e) => { setPregunta(e.results[0][0].transcript); setGrabando(false); };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    reconRef.current = r;
    r.start();
  };

  const enviarPregunta = async () => {
    if (!pregunta.trim()) return;
    let p = pregunta; setPregunta('');
    setChat(prev => [...prev, { role: 'user', text: p }]);
    setEnviando(true);
    try {
      // Si acabamos de pedir ubicación, este mensaje se interpreta como ubicación.
      if (esperandoUbicacion) {
        try {
          await ensureUbicacionYClima(p);
          setEsperandoUbicacion(false);
          const pending = preguntaPendiente;
          setPreguntaPendiente('');
          setChat(prev => [...prev, { role: 'ia', text: 'Perfecto. Ya tengo tu ubicación y el clima actual. Ahora sí, dime tu consulta.' }]);
          if (!pending) { setEnviando(false); return; }
          // Reinyecta la pregunta pendiente como si fuese la actual.
          setChat(prev => [...prev, { role: 'user', text: pending }]);
          // Continúa usando `pending` como la pregunta real.
          p = pending;
        } catch (e) {
          setChat(prev => [...prev, { role: 'ia', text: 'No pude ubicarte. Prueba con “Distrito, Provincia” o con “lat, lon” (ej: -6.23, -78.75).' }]);
          setEnviando(false);
          return;
        }
      }

      // Si aún no tenemos ubicación/clima, pedirlo primero para mejorar recomendaciones.
      const faltaContexto = !ctxCoords || !ctxWeather;
      if (faltaContexto) {
        setEsperandoUbicacion(true);
        setPreguntaPendiente(p);
        setChat(prev => [...prev, {
          role: 'ia',
          text: 'Para darte recomendaciones más acertadas necesito tu ubicación. Dime tu distrito/provincia (ej: “Cutervo, Cajamarca”) o tus coordenadas “lat, lon”.'
        }]);
        setEnviando(false);
        return;
      }

      const historial = chat.map(m =>
        `${m.role === 'user' ? 'Agricultor' : 'Asistente'}: ${m.text}`).join('\n');
      const w = ctxWeather;
      const weatherTxt = w
        ? `Clima actual (AgroMonitoring): temp=${w.main?.temp ?? '-'}°C, humedad=${w.main?.humidity ?? '-'}%, nubes=${w.clouds?.all ?? '-'}%, viento=${w.wind?.speed ?? '-'} m/s, condición=${w.weather?.[0]?.description ?? '-'}.`
        : '';
      const resp = await invokeGemini({
        prompt: `Eres un agrónomo experto. El agricultor tiene un ${cultivo.nombre} con ${resultado?.nombre_problema || 'cultivo saludable'}.

Ubicación del agricultor: ${ctxUbicacion || user?.ubicacion || 'No especificada'}
${weatherTxt}

Historial: ${historial}

Pregunta actual: ${p}

Responde de forma clara, breve y en lenguaje simple.`
      });
      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setChat(prev => [...prev, { role: 'ia', text: 'Lo siento, hubo un error. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  // ─── PANTALLA DE RESULTADO ───────────────────────────────────────────────────
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24 animate-fadeIn">
      <div className={`px-6 pt-12 pb-6 ${
        resultado.gravedad === 'grave' ? 'bg-red-600' :
        resultado.gravedad === 'moderada' ? 'bg-orange-500' :
        resultado.tiene_problema ? 'bg-yellow-500' : 'bg-primary'
      } text-white`}>
        <button onClick={() => setResultado(null)} className="text-white/70 text-sm mb-3">
          ← Nuevo diagnóstico
        </button>
        <div className="flex items-center gap-3">
          {resultado.tiene_problema ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          <div>
            <h1 className="text-xl font-display font-bold">
              {resultado.tiene_problema ? resultado.nombre_problema : '✓ Cultivo Saludable'}
            </h1>
            <p className="text-white/80 text-sm">{cultivo.emoji} {cultivo.nombre}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            ¿Qué tiene tu cultivo?
          </p>
          <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_tiene}</p>
        </div>

        {resultado.tiene_problema && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              ¿Qué debes hacer?
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_hacer}</p>
          </div>
        )}

        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Productos recomendados
            </p>
            <div className="space-y-2">
              {resultado.productos.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.dosis}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {resultado.prevencion && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
              🛡️ Prevención
            </p>
            <p className="text-green-800 text-sm">{resultado.prevencion}</p>
          </div>
        )}

        <div className="flex gap-2">
          {leyendo ? (
            <button onClick={detenerVoz}
              className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
              <VolumeX size={16} /> Detener audio
            </button>
          ) : (
            <button onClick={() => leerTexto(resultado.que_tiene + '. ' + (resultado.que_hacer || ''))}
              className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 rounded-xl text-sm">
              <Volume2 size={16} /> Escuchar
            </button>
          )}
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            💬 Consulta más sobre tu cultivo
          </p>
          {chat.length > 0 && (
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                  }`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatRef} />
            </div>
          )}
          <div className="flex gap-2">
            <input value={pregunta} onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarPregunta()}
              placeholder="Escribe o habla tu pregunta..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            <button onClick={grabando ? () => reconRef.current?.stop() : grabarVoz}
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

  // ─── PANTALLA DE FORMULARIO ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Diagnóstico IA</h1>
        <p className="text-white/70 text-sm mt-1">Identifica plagas y enfermedades</p>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Selección cultivo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Selecciona tu cultivo
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CULTIVOS.map(c => (
              <button key={c.id} onClick={() => setCultivo(c)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                  cultivo.id === c.id
                    ? 'bg-primary text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-semibold">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fotos */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Fotos del cultivo
          </p>
          {fotos.length === 0 ? (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors">
              <Camera size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">Toca para subir fotos</p>
              <p className="text-xs text-gray-400">Fotos claras de hojas o plantas afectadas</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f.preview} alt="" className="w-full h-24 object-cover rounded-xl" />
                  <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()}
                className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary transition-colors">
                <Camera size={20} />
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} className="hidden" />
        </div>

        {/* Botón principal */}
        <button onClick={analizar} disabled={fotos.length === 0 || analizando}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark transition-colors disabled:opacity-50 text-base">
          {analizando
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin" /> Analizando con IA...
              </span>
            : '🔬 Iniciar Diagnóstico'}
        </button>

        {resultado?.error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-600 font-semibold text-sm">Error en el análisis</p>
            <p className="text-red-400 text-xs mt-1">Intenta con una foto más clara</p>
          </div>
        )}

      </div>
    </div>
  );
}
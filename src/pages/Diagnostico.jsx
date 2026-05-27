import React, { useState, useRef } from 'react';
import {
  Camera, Loader2, AlertTriangle, CheckCircle, Send,
  Mic, MicOff, Volume2, VolumeX, ShoppingBag,
  ChevronRight, Bot, Sparkles,
} from 'lucide-react';
import { useAuth }       from '../lib/AuthContext';
import { invokeGemini }  from '../lib/gemini';
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
  const [leyendo, setLeyendo]           = useState(false);
  const [grabando, setGrabando]         = useState(false);
  const [productoBuscando, setProductoBuscando] = useState(null);
  const [mostrarAgente, setMostrarAgente]       = useState(false);

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
Sugiere 2-3 productos alternativos. Español claro para agricultores. Si está sana: tiene_problema false.`,
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

  const analizar = async () => {
    if (!fotos.length) { alert('Sube al menos una foto'); return; }
    setAnalizando(true);
    try {
      const compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));
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

      const resp = await invokeGemini({
        systemPrompt: CHAT_SYSTEM[cultivo.id] || CHAT_SYSTEM.papa,
        prompt: `Diagnóstico: ${resultado?.nombre_problema || 'saludable'} en ${cultivo.nombre}. Gravedad: ${resultado?.gravedad || 'ninguna'}.
Historial:
${historial}
Pregunta: ${p}
Responde breve (máx 4 oraciones) con dosis y carencia si aplica. Menciona Fungicidas en la app si necesita comprar.`,
      });

      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      setChat(prev => [...prev, { role: 'ia', text: 'Error al procesar. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  /* ═══════════════ PANTALLA RESULTADO ═══════════════ */
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24">

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
          onClick={() => { setResultado(null); setFotos([]); setChat([]); setMostrarAgente(false); }}
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
    <div className="min-h-screen pb-24">
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
          className="w-full bg-primary text-white font-bold py-5 rounded-2xl disabled:opacity-50 text-lg shadow-lg">
          {analizando
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 size={22} className="animate-spin" /> Analizando con PlaguIA...
              </span>
            : '🔬 Iniciar Diagnóstico'
          }
        </button>

        {resultado?.error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-600 font-semibold text-sm">Error en el análisis</p>
            <p className="text-red-400 text-xs mt-1">Intenta con una foto más clara y bien iluminada</p>
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
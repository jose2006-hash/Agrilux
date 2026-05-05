import React, { useState, useRef } from 'react';
import { Camera, Loader2, AlertTriangle, CheckCircle, Send,
         Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { invokeGemini } from '../lib/gemini';
import { CULTIVOS } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// ─── PROMPTS ESPECIALIZADOS POR CULTIVO ───────────────────────────────────────
const SISTEMA_PROMPT = {
  papa: `Eres PlaguIA, sistema experto en protección fitosanitaria de papa (Solanum tuberosum) 
para agricultores peruanos. Tienes conocimiento profundo de:
- Enfermedades: Phytophthora infestans (rancha/tizón tardío), Alternaria solani (tizón temprano), 
  Rhizoctonia solani (rizoctoniasis), Fusarium spp. (marchitez), Erwinia (pudrición blanda)
- Plagas: Epitrix subcrinita (pulguilla), Premnotrypes suturicallus (gorgojo de los andes), 
  Diabrotica spp., Agrotis ipsilon (gusano de tierra), Spodoptera spp., Phthorimaea operculella (polilla)
- Malezas: Oxalis, Bidens pilosa, Amaranthus spp., Chenopodium album
- Condiciones de sierra peruana: lluvia, heladas, granizo, altitud 2800-4000 msnm
Siempre da dosis exactas, nombres comerciales disponibles en Perú y momento óptimo de aplicación.`,

  palta: `Eres PlaguIA, sistema experto en protección fitosanitaria de palta/aguacate (Persea americana)
para agricultores peruanos. Especializado en:
- Enfermedades: Phytophthora cinnamomi (tristeza del palto), Colletotrichum gloeosporioides (antracnosis), 
  Fusarium spp., Cercospora purpurea (cercosporiosis), Pestalotiopsis spp.
- Plagas: Heilipus lauri (barrenador del tallo), Oligonychus punicae (ácaro rojo), 
  Trips (Scirtothrips perseae), Coccus hesperidum (escama), Hemiberlesia lataniae
- Malezas: Cyperus rotundus, Convolvulus arvensis, Digitaria sanguinalis
- Estándares de exportación: GlobalGAP, SENASA, LMR Europa y EE.UU.
- Variedades: Hass (principal), Fuerte, Criolla. Costa peruana y valles interandinos.
Da dosis exactas, períodos de carencia para exportación y productos registrados en Perú.`,

  arandano: `Eres PlaguIA, sistema experto en protección fitosanitaria de arándano (Vaccinium corymbosum)
para agricultores peruanos. Perú es el mayor exportador mundial. Especializado en:
- Enfermedades: Botrytis cinerea (podredumbre gris), Phomopsis vaccinii (cáncer del tallo), 
  Monilinia vaccinii-corymbosi, Exobasidium vaccinii, Mummy berry, Phytophthora spp.
- Plagas: Drosophila suzukii (mosca del ala manchada), Tetranychus urticae (ácaro bimanchado),
  Frankliniella occidentalis (trips), Bemisia tabaci (mosca blanca), Saissetia oleae
- Malezas: Cyperus spp., Oxalis corniculata, Poa annua
- CRÍTICO: Residuo cero para exportación. Usa SOLO productos con LMR permitido en UE/USA/Asia.
- Estándares: GlobalGAP, TESCO, Walmart, Costco. Períodos de carencia obligatorios.
Da alternativas de rotación para evitar resistencias y siempre indica el período de carencia exacto.`
};

const CHAT_SYSTEM = {
  papa: `Eres PlaguIA, agrónomo experto en papa para Perú. 
Cuando el agricultor mencione una ubicación, extrae el distrito/provincia y dame las coordenadas aproximadas de esa zona de Perú.
Cutervo,Cajamarca = lat:-6.37,lon:-78.81 | Oxapampa = lat:-10.57,lon:-75.40 | Huancayo = lat:-12.06,lon:-75.21
Da recomendaciones específicas considerando el clima y altitud de esa zona.`,
  palta: `Eres PlaguIA, agrónomo experto en palta/aguacate para Perú exportación.`,
  arandano: `Eres PlaguIA, agrónomo experto en arándanos para Perú exportación con estándares GlobalGAP.`
};

export default function Diagnostico({ onPlagaDetectada }) {
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
  const [confirmado, setConfirmado] = useState(null);
  const [diagnosticoId, setDiagnosticoId] = useState(null);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const reconRef = useRef(null);

  const handleFoto = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setFotos(prev => [...prev, { preview: reader.result, dataUrl: reader.result }]);
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
      else if (h > MAX) { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
  });

  const analizar = async () => {
    if (fotos.length === 0) { alert('Sube al menos una foto'); return; }
    setAnalizando(true);
    try {
      const compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));

      const analisis = await invokeGemini({
        prompt: `${SISTEMA_PROMPT[cultivo.id]}

Analiza esta imagen del cultivo de ${cultivo.nombre}.

INSTRUCCIONES OBLIGATORIAS:
1. Identifica con precisión la plaga, enfermedad o maleza
2. Si hay más de un problema, menciona todos
3. En "que_hacer" sé MUY específico: nombre comercial del producto, dosis exacta (ml o g por litro o hectárea), frecuencia de aplicación y momento del día recomendado
4. Si es enfermedad fúngica, da al menos 2 fungicidas alternativos para rotación
5. Si es plaga insectil, indica el umbral de daño económico y si aplicar ya o esperar
6. Menciona si el problema tiene relación con el clima o manejo del suelo
7. Usa nombres de productos disponibles en Perú (Bayer, Syngenta, BASF, FMC, UPL)
8. Responde en español claro para un agricultor peruano

Sé detallado y específico, no genérico.`,
        file_urls: compressedUrls,
        response_json_schema: {
          type: 'object',
          properties: {
            tiene_problema: { type: 'boolean' },
            nombre_problema: { type: 'string' },
            nombre_cientifico: { type: 'string' },
            gravedad: { type: 'string', enum: ['ninguna', 'leve', 'moderada', 'grave', 'critica'] },
            que_tiene: { type: 'string' },
            causa: { type: 'string' },
            que_hacer: { type: 'string' },
            aplicacion_inmediata: { type: 'string' },
            productos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' },
                  ingrediente_activo: { type: 'string' },
                  dosis: { type: 'string' },
                  frecuencia: { type: 'string' },
                  carencia: { type: 'string' }
                }
              }
            },
            cuando_aplicar: { type: 'string' },
            prevencion: { type: 'string' },
            alerta_clima: { type: 'string' },
          }
        }
      });

      setResultado(analisis);
      setConfirmado(null);
      setChat([]);

      // Guardar dataset ML
      try {
        const docRef = await addDoc(collection(db, 'diagnosticos'), {
          userId: user?.uid,
          userName: user?.nombre,
          userEmail: user?.email,
          cultivo: cultivo.id,
          cultivoNombre: cultivo.nombre,
          resultado: {
            tiene_problema: analisis.tiene_problema,
            nombre_problema: analisis.nombre_problema || null,
            nombre_cientifico: analisis.nombre_cientifico || null,
            gravedad: analisis.gravedad,
            que_tiene: analisis.que_tiene,
            productos: analisis.productos || [],
          },
          confirmado_por_usuario: null,
          fecha: new Date().toISOString(),
          mes: new Date().getMonth() + 1,
        });
        setDiagnosticoId(docRef.id);
      } catch (e) { console.log('Dataset error:', e); }

      if (analisis.tiene_problema && onPlagaDetectada) {
        onPlagaDetectada(analisis.nombre_problema);
      }

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

  const confirmarDiagnostico = async (correcto) => {
    setConfirmado(correcto);
    if (!diagnosticoId) return;
    try {
      await updateDoc(doc(db, 'diagnosticos', diagnosticoId), {
        confirmado_por_usuario: correcto,
        fecha_confirmacion: new Date().toISOString(),
      });
    } catch (e) { console.log('Error confirmando:', e); }
  };

  const leerTexto = (texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-PE'; u.rate = 0.85;
    setLeyendo(true);
    u.onend = () => setLeyendo(false);
    u.onerror = () => setLeyendo(false);
    window.speechSynthesis.speak(u);
  };

  const detenerVoz = () => { window.speechSynthesis?.cancel(); setLeyendo(false); };

  const grabarVoz = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Usa Chrome para la función de voz'); return;
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
    const p = pregunta; setPregunta('');
    setChat(prev => [...prev, { role: 'user', text: p }]);
    setEnviando(true);
    try {
      const historial = chat.map(m =>
        `${m.role === 'user' ? 'Agricultor' : 'PlaguIA'}: ${m.text}`
      ).join('\n');

      const resp = await invokeGemini({
        prompt: `${CHAT_SYSTEM[cultivo.id] || CHAT_SYSTEM.papa}

Diagnóstico actual: ${resultado?.nombre_problema || 'cultivo saludable'} en ${cultivo.nombre}.
Gravedad: ${resultado?.gravedad || 'ninguna'}.

Historial de conversación:
${historial}

Nueva pregunta del agricultor: ${p}

INSTRUCCIONES:
- Si menciona una ubicación o distrito de Perú, úsala para dar recomendaciones climáticas específicas de esa zona
- Si pregunta por un fungicida o producto, da dosis exacta y período de carencia
- Si pregunta qué aplicar, recomienda productos disponibles en Perú con nombre comercial
- Sé específico, práctico y breve (máximo 4 oraciones)
- Si necesita comprar fungicidas, menciona que puede encontrarlos en la sección Fungicidas de la app`
      });

      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setChat(prev => [...prev, { role: 'ia', text: 'Error al procesar. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  const colorHeader = () => {
    if (!resultado?.gravedad) return 'bg-primary';
    return {
      critica:  'bg-red-700',
      grave:    'bg-red-600',
      moderada: 'bg-orange-500',
      leve:     'bg-yellow-500',
      ninguna:  'bg-primary',
    }[resultado.gravedad] || 'bg-primary';
  };

  // ─── PANTALLA RESULTADO ───────────────────────────────────────────────────
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24">
      <div className={`px-6 pt-12 pb-6 text-white ${colorHeader()}`}>
        <button onClick={() => { setResultado(null); setFotos([]); setChat([]); }}
          className="text-white/70 text-sm mb-3">← Nuevo diagnóstico</button>
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

      <div className="px-4 py-4 space-y-4">

        {/* Qué tiene */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🔍 Diagnóstico</p>
          <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_tiene}</p>
          {resultado.causa && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 mb-1">Causa probable</p>
              <p className="text-gray-600 text-xs leading-relaxed">{resultado.causa}</p>
            </div>
          )}
        </div>

        {/* Acción inmediata */}
        {resultado.aplicacion_inmediata && resultado.tiene_problema && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">⚡ Acción Inmediata</p>
            <p className="text-red-700 text-sm leading-relaxed font-medium">{resultado.aplicacion_inmediata}</p>
          </div>
        )}

        {/* Plan de control detallado */}
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

        {/* Productos con detalle */}
        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              💊 Productos Recomendados ({resultado.productos.length})
            </p>
            <div className="space-y-3">
              {resultado.productos.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{p.nombre}</p>
                      {p.ingrediente_activo && (
                        <p className="text-xs text-gray-400 italic">{p.ingrediente_activo}</p>
                      )}
                    </div>
                    <button onClick={() => navigate('/mercado')}
                      className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg ml-2 flex-shrink-0">
                      Ver →
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
                        <p className="text-xs text-amber-500 font-bold">⚠️ Carencia: {p.carencia}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerta clima */}
        {resultado.alerta_clima && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-600 mb-1">🌤️ Condición Climática</p>
            <p className="text-blue-700 text-sm">{resultado.alerta_clima}</p>
          </div>
        )}

        {/* Prevención */}
        {resultado.prevencion && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-green-700 mb-1">🛡️ Prevención Futura</p>
            <p className="text-green-800 text-sm">{resultado.prevencion}</p>
          </div>
        )}

        {/* Audio */}
        <div className="flex gap-2">
          {leyendo
            ? <button onClick={detenerVoz}
                className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
                <VolumeX size={16} /> Detener audio
              </button>
            : <button onClick={() => leerTexto((resultado.aplicacion_inmediata || resultado.que_hacer || '') + '. ' + (resultado.prevencion || ''))}
                className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 rounded-xl text-sm">
                <Volume2 size={16} /> Escuchar recomendación
              </button>
          }
        </div>

        {/* Feedback ML */}
        {confirmado === null ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              ¿Fue correcto este diagnóstico?
            </p>
            <div className="flex gap-2">
              <button onClick={() => confirmarDiagnostico(true)}
                className="flex-1 bg-green-100 text-green-700 font-bold py-2.5 rounded-xl text-sm">
                ✅ Sí, correcto
              </button>
              <button onClick={() => confirmarDiagnostico(false)}
                className="flex-1 bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-sm">
                ❌ No fue correcto
              </button>
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl p-3 text-center text-sm font-semibold ${confirmado ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {confirmado ? '✅ Gracias, tu respuesta mejora la IA 🌱' : '❌ Gracias, lo usaremos para mejorar PlaguIA'}
          </div>
        )}

        {/* Chat */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            💬 Consulta al Agrónomo IA
          </p>
          {chat.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                '¿Qué fungicida aplico?',
                '¿Cuánto producto necesito?',
                '¿Cuándo vuelvo a aplicar?',
              ].map(sugerencia => (
                <button key={sugerencia} onClick={() => setPregunta(sugerencia)}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                  {sugerencia}
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
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
          <div className="flex gap-2">
            <input value={pregunta} onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarPregunta()}
              placeholder="Ej: ¿Qué fungicida aplico en Cutervo?"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <button onClick={grabando ? () => reconRef.current?.stop() : grabarVoz}
              className={`p-2.5 rounded-xl transition-colors ${grabando ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
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

  // ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24">
      <div className="bg-gradient-to-b from-primary to-primary-dark text-white px-6 pt-12 pb-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Camera size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold">Diagnóstico IA</h1>
          <p className="text-white/80 text-sm mt-2">
            Detecta plagas, enfermedades y malezas con IA especializada
          </p>
        </div>

        {/* Zona de foto */}
        <div onClick={() => fileRef.current?.click()}
          className="bg-white/20 backdrop-blur-sm border-2 border-white/40 border-dashed rounded-3xl p-8 text-center cursor-pointer hover:bg-white/30 transition-all active:scale-95">
          {fotos.length === 0 ? (
            <>
              <Camera size={48} className="mx-auto text-white mb-3" />
              <p className="text-white font-bold text-xl">📸 Subir foto del cultivo</p>
              <p className="text-white/70 text-sm mt-1">Hoja, tallo, raíz o fruto afectado</p>
              <p className="text-white/50 text-xs mt-2">Puedes subir varias fotos</p>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f.preview} alt="" className="w-full h-20 object-cover rounded-xl" />
                  <button onClick={(e) => { e.stopPropagation(); setFotos(prev => prev.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {fotos.length < 4 && (
                <div className="h-20 border-2 border-dashed border-white/40 rounded-xl flex items-center justify-center text-white/70">
                  <Camera size={20} />
                </div>
              )}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} className="hidden" />
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Selector cultivo */}
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

        {/* Botón analizar */}
        <button onClick={analizar} disabled={fotos.length === 0 || analizando}
          className="w-full bg-primary text-white font-bold py-5 rounded-2xl hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg shadow-lg">
          {analizando
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={22} className="animate-spin" /> Analizando con PlaguIA...</span>
            : '🔬 Iniciar Diagnóstico'}
        </button>

        {resultado?.error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-600 font-semibold text-sm">Error en el análisis</p>
            <p className="text-red-400 text-xs mt-1">Intenta con una foto más clara y bien iluminada</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🤖 PlaguIA detecta</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { e: '🦠', t: 'Enfermedades fúngicas y bacterianas' },
              { e: '🐛', t: 'Plagas e insectos dañinos' },
              { e: '🌿', t: 'Malezas y plantas invasoras' },
              { e: '💊', t: 'Dosis exactas de fungicidas' },
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
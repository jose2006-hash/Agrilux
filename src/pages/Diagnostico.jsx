import React, { useState, useRef } from 'react';
import { Camera, Loader2, AlertTriangle, CheckCircle, Send, Mic, MicOff, Volume2, VolumeX, ShoppingCart } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { invokeGemini } from '../lib/gemini';
import { CULTIVOS, WHATSAPP } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const SINTOMAS = ['Manchas', 'Hojas enrolladas', 'Plagas visibles', 'Pudrición', 'Amarillamiento', 'Marchitez', 'Tallos débiles', 'Frutos dañados'];

export default function Diagnostico() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cultivo, setCultivo] = useState(CULTIVOS[0]);
  const [fotos, setFotos] = useState([]);
  const [sintomas, setSintomas] = useState([]);
  const [ubicacion, setUbicacion] = useState(user?.ubicacion || '');
  const [descripcion, setDescripcion] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [chat, setChat] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const fileRef = useRef(null);
  const chatRef = useRef(null);
  const reconRef = useRef(null);

  const toggleSintoma = (s) => setSintomas(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleFoto = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setFotos(prev => [...prev, { preview: reader.result, dataUrl: reader.result }]);
      reader.readAsDataURL(file);
    });
  };

  // Compress image
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
- Ubicación: ${ubicacion || 'No especificada'}
- Síntomas reportados: ${sintomas.join(', ') || 'No especificados'}
- Descripción del agricultor: ${descripcion || 'Sin descripción'}

IMPORTANTE: Responde en lenguaje simple y directo, sin términos técnicos complejos. El agricultor debe entender fácilmente qué tiene su cultivo y qué hacer.`,
        file_urls: compressedUrls,
        response_json_schema: {
          type: 'object',
          properties: {
            tiene_problema: { type: 'boolean' },
            nombre_problema: { type: 'string' },
            gravedad: { type: 'string', enum: ['ninguna', 'leve', 'moderada', 'grave'] },
            que_tiene: { type: 'string' },
            que_hacer: { type: 'string' },
            productos: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' }, dosis: { type: 'string' } } } },
            prevencion: { type: 'string' },
          }
        }
      });

      setResultado(analisis);

      // Guardar en Firebase
      try {
        await addDoc(collection(db, 'diagnosticos'), {
          userId: user?.id,
          userName: user?.nombre,
          cultivo: cultivo.nombre,
          ubicacion,
          resultado: analisis,
          fecha: new Date().toISOString(),
        });
      } catch (e) { console.log('Firebase save error', e); }

      // Leer resultado
      leerTexto(`${analisis.tiene_problema ? `Tu ${cultivo.nombre} tiene ${analisis.nombre_problema}. ${analisis.que_hacer}` : `Tu ${cultivo.nombre} está saludable.`}`);
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
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { alert('Tu navegador no soporta voz. Usa Chrome.'); return; }
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
      const historial = chat.map(m => `${m.role === 'user' ? 'Agricultor' : 'Asistente'}: ${m.text}`).join('\n');
      const resp = await invokeGemini({
        prompt: `Eres un agrónomo experto. El agricultor tiene un ${cultivo.nombre} con ${resultado?.nombre_problema || 'cultivo saludable'}.

Historial: ${historial}

Pregunta actual: ${p}

Responde de forma clara, breve y en lenguaje simple. Si el agricultor necesita insumos, menciona que puede encontrarlos en la sección de Mercado.`
      });
      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setChat(prev => [...prev, { role: 'ia', text: 'Lo siento, hubo un error. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  const irAInsumos = () => navigate('/mercado');

  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24 animate-fadeIn">
      <div className={`px-6 pt-12 pb-6 ${resultado.gravedad === 'grave' ? 'bg-red-600' : resultado.gravedad === 'moderada' ? 'bg-orange-500' : resultado.tiene_problema ? 'bg-yellow-500' : 'bg-primary'} text-white`}>
        <button onClick={() => setResultado(null)} className="text-white/70 text-sm mb-3">← Nuevo diagnóstico</button>
        <div className="flex items-center gap-3">
          {resultado.tiene_problema ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          <div>
            <h1 className="text-xl font-display font-bold">{resultado.tiene_problema ? resultado.nombre_problema : '✓ Cultivo Saludable'}</h1>
            <p className="text-white/80 text-sm">{cultivo.emoji} {cultivo.nombre}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">¿Qué tiene tu cultivo?</p>
          <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_tiene}</p>
        </div>

        {resultado.tiene_problema && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">¿Qué debes hacer?</p>
            <p className="text-gray-700 text-sm leading-relaxed">{resultado.que_hacer}</p>
          </div>
        )}

        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Productos recomendados</p>
            <div className="space-y-2">
              {resultado.productos.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.dosis}</p>
                  </div>
                  <button onClick={irAInsumos} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    Ver en tienda
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {resultado.prevencion && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">🛡️ Prevención</p>
            <p className="text-green-800 text-sm">{resultado.prevencion}</p>
          </div>
        )}

        {/* Audio controls */}
        <div className="flex gap-2">
          {leyendo ? (
            <button onClick={detenerVoz} className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
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
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💬 Consulta más sobre tu cultivo</p>
          {chat.length > 0 && (
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.text}
                  </div>
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

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Diagnóstico IA</h1>
        <p className="text-white/70 text-sm mt-1">Identifica plagas y enfermedades</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Selección cultivo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Selecciona tu cultivo</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CULTIVOS.map(c => (
              <button key={c.id} onClick={() => setCultivo(c)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                  cultivo.id === c.id ? 'bg-primary text-white shadow-md scale-105' : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-semibold">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fotos */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Fotos del cultivo</p>
          {fotos.length === 0 ? (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors">
              <Camera size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">Toca para subir fotos</p>
              <p className="text-xs text-gray-400">Fotos claras de hojas o plantas afectadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.preview} alt="" className="w-full h-24 object-cover rounded-xl" />
                    <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-primary transition-colors">
                  <Camera size={20} />
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFoto} className="hidden" />
        </div>

        {/* Síntomas */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Síntomas observados</p>
          <div className="flex flex-wrap gap-2">
            {SINTOMAS.map(s => (
              <button key={s} onClick={() => toggleSintoma(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  sintomas.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {/* Ubicación y descripción */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Ubicación</label>
            <input value={ubicacion} onChange={e => setUbicacion(e.target.value)}
              placeholder="Ej: Cutervo, Cajamarca"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Descripción (opcional)</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe lo que observas..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
        </div>

        <button onClick={analizar} disabled={fotos.length === 0 || analizando}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark transition-colors disabled:opacity-50 text-base">
          {analizando ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" /> Analizando con IA...</span>
          ) : '🔬 Iniciar Diagnóstico'}
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

import React, { useState, useRef } from 'react';
import { Camera, Loader2, AlertTriangle, CheckCircle, Send,
         Mic, MicOff, Volume2, VolumeX, ShoppingBag, ChevronRight, Star } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { invokeGemini } from '../lib/gemini';
import { CULTIVOS } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const SISTEMA_PROMPT = {
  papa: `Eres PlaguIA, sistema experto en protección fitosanitaria de papa (Solanum tuberosum) 
para agricultores peruanos. Tienes conocimiento profundo de:
- Enfermedades: Phytophthora infestans (rancha/tizón tardío), Alternaria solani (tizón temprano), 
  Rhizoctonia solani, Fusarium spp., Erwinia (pudrición blanda)
- Plagas: Epitrix subcrinita (pulguilla), Premnotrypes suturicallus (gorgojo de los andes), 
  Agrotis ipsilon (gusano de tierra), Phthorimaea operculella (polilla de papa)
- Condiciones de sierra peruana: lluvia, heladas, altitud 2800-4000 msnm
Siempre da dosis exactas, nombres comerciales disponibles en Perú y momento óptimo de aplicación.`,
  palta: `Eres PlaguIA, sistema experto en protección fitosanitaria de palta/aguacate (Persea americana).
- Enfermedades: Phytophthora cinnamomi (tristeza del palto), Colletotrichum gloeosporioides (antracnosis), 
  Cercospora purpurea, Pestalotiopsis spp.
- Plagas: Heilipus lauri (barrenador), Oligonychus punicae (ácaro rojo), Trips, Coccus hesperidum
- Estándares GlobalGAP, SENASA, LMR Europa. Da períodos de carencia para exportación.`,
  arandano: `Eres PlaguIA, sistema experto en arándanos (Vaccinium corymbosum) para exportación peruana.
- Enfermedades: Botrytis cinerea, Phomopsis vaccinii, Monilinia, Phytophthora spp.
- Plagas: Drosophila suzukii, Tetranychus urticae, Frankliniella occidentalis, Bemisia tabaci
- CRÍTICO: Residuo cero para exportación. Solo productos con LMR permitido en UE/USA/Asia.
- Períodos de carencia obligatorios para GlobalGAP, TESCO, Walmart, Costco.`
};

const CHAT_SYSTEM = {
  papa: `Eres PlaguIA, agrónomo experto en papa para Perú. Da recomendaciones específicas de productos con dosis exactas.`,
  palta: `Eres PlaguIA, agrónomo experto en palta/aguacate para Perú exportación.`,
  arandano: `Eres PlaguIA, agrónomo experto en arándanos para Perú exportación con estándares GlobalGAP.`
};

// ─── COMPONENTE: TIENDAS CON EL PRODUCTO ─────────────────────────────────────
function TiendasConProducto({ productoBuscado, onCerrar }) {
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    buscarProductoEnTiendas();
  }, [productoBuscado]);

  const buscarProductoEnTiendas = async () => {
    setLoading(true);
    try {
      // Buscar todos los productos que coincidan con el nombre
      const snap = await getDocs(collection(db, 'productos'));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filtrar por nombre similar al producto buscado
      const palabrasClave = productoBuscado.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      const coincidentes = todos.filter(p => {
        const nombreProd = (p.nombre || '').toLowerCase();
        const plagasProd = (p.plagasQueControla || '').toLowerCase();
        return palabrasClave.some(palabra =>
          nombreProd.includes(palabra) ||
          plagasProd.includes(palabra) ||
          palabra.includes(nombreProd.split(' ')[0])
        );
      });

      // Agrupar por tienda y obtener datos de tienda
      const tiendasSnap = await getDocs(collection(db, 'tiendas'));
      const tiendasMap = {};
      tiendasSnap.docs.forEach(d => { tiendasMap[d.id] = { id: d.id, ...d.data() }; });

      // Armar resultado: tienda + producto + precio
      const resultado = [];
      coincidentes.forEach(prod => {
        const tienda = tiendasMap[prod.tiendaId];
        if (tienda && prod.disponible) {
          resultado.push({ ...prod, tiendaInfo: tienda });
        }
      });

      // Ordenar por precio (menor primero)
      resultado.sort((a, b) => {
        const pa = parseFloat(a.precio) || 9999;
        const pb = parseFloat(b.precio) || 9999;
        return pa - pb;
      });

      setTiendas(resultado);
    } catch (e) {
      console.error('Error buscando tiendas:', e);
      setTiendas([]);
    }
    setLoading(false);
  };

  const irATienda = () => {
    navigate('/mercado');
    onCerrar();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-gray-800">
                🛡️ {productoBuscado}
              </h3>
              <p className="text-xs text-gray-500">Tiendas disponibles ordenadas por precio</p>
            </div>
            <button onClick={onCerrar}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">✕</button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-gray-500">Buscando en tiendas registradas...</p>
            </div>
          ) : tiendas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🏪</p>
              <p className="font-bold text-gray-700">No encontramos este producto en tiendas</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Pero puedes buscar en el marketplace o consultar por WhatsApp</p>
              <button onClick={irATienda}
                className="bg-primary text-white font-bold px-6 py-3 rounded-2xl text-sm">
                Ver todas las tiendas →
              </button>
            </div>
          ) : (
            <>
              {/* Mejor precio badge */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                <Star size={16} className="text-green-600 fill-green-600" />
                <p className="text-xs font-bold text-green-700">
                  Mejor precio: {tiendas[0].tiendaInfo?.empresa} — S/ {tiendas[0].precio}
                </p>
              </div>

              {tiendas.map((prod, idx) => (
                <div key={prod.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${idx === 0 ? 'border-primary' : 'border-gray-100'}`}>
                  {idx === 0 && (
                    <span className="text-xs bg-primary text-white font-bold px-2.5 py-1 rounded-full mb-2 inline-block">
                      ⭐ Mejor precio
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{prod.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">🏪 {prod.tiendaInfo?.empresa}</p>
                      <p className="text-xs text-gray-400">📍 {prod.tiendaInfo?.ubicacion}</p>
                      {prod.plagasQueControla && (
                        <p className="text-xs text-red-500 mt-1">🐛 {prod.plagasQueControla}</p>
                      )}
                      {prod.uso && (
                        <p className="text-xs text-gray-500 mt-0.5">💊 {prod.uso}</p>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-primary">S/ {prod.precio}</p>
                      <p className="text-xs text-gray-400">por unidad</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {prod.tiendaInfo?.celular && (
                      <a href={`https://wa.me/51${prod.tiendaInfo.celular.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, vi en AGRILUX que tienen ${prod.nombre}. ¿Está disponible y cuál es el precio?`)}`}
                        target="_blank" rel="noreferrer"
                        className="flex-1 bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl text-center">
                        📲 Consultar
                      </a>
                    )}
                    <button onClick={irATienda}
                      className="flex-1 bg-primary/10 text-primary text-xs font-bold py-2.5 rounded-xl">
                      Ver tienda →
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={irATienda}
                className="w-full border border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl text-sm">
                Ver todas las tiendas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [productoBuscando, setProductoBuscando] = useState(null); // para modal tiendas
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
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  const analizarUnaVez = async (compressedUrls, intento) => {
    return invokeGemini({
      prompt: `${SISTEMA_PROMPT[cultivo.id]}

Analiza esta imagen del cultivo de ${cultivo.nombre}.
Revisa cuidadosamente y realiza al menos 3 análisis independientes del mismo documento para confirmar el diagnóstico.
Responde con seguridad y no preguntes si el diagnóstico es correcto o no.

INSTRUCCIONES:
1. Identifica con precisión la plaga, enfermedad o maleza
2. En "aplicacion_inmediata" sé muy específico con nombre comercial, dosis exacta y frecuencia
3. Para cada producto en "productos": usa nombres comerciales reales disponibles en Perú (ej: Antracol, Mancozeb, Score, Ridomil, Karate)
4. Incluye dosis exacta (ml o g por litro o hectárea), frecuencia y período de carencia
5. Menciona 2-3 productos alternativos para rotación y evitar resistencias
6. Responde en español claro para un agricultor peruano`,
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
          aplicacion_inmediata: { type: 'string' },
          que_hacer: { type: 'string' },
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
  };

  const obtenerConsensoAnalisis = (resultados) => {
    const normalizar = (texto) => (texto || '').trim().toLowerCase();
    const conteo = resultados.reduce((acc, r) => {
      const clave = `${normalizar(r.nombre_problema) || 'saludable'}|${normalizar(r.gravedad) || 'ninguna'}`;
      acc[clave] = (acc[clave] || 0) + 1;
      return acc;
    }, {});
    const ganador = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!ganador) return resultados[0];
    const [nombreGanador, gravedadGanador] = ganador.split('|');
    return resultados.find(r =>
      normalizar(r.nombre_problema) === nombreGanador &&
      normalizar(r.gravedad) === gravedadGanador
    ) || resultados[0];
  };

  const analizar = async () => {
    if (fotos.length === 0) { alert('Sube al menos una foto'); return; }
    setAnalizando(true);
    try {
      const compressedUrls = await Promise.all(fotos.map(f => compressDataUrl(f.dataUrl)));

      const intentos = [];
      for (let i = 1; i <= 3; i += 1) {
        intentos.push(await analizarUnaVez(compressedUrls, i));
      }
      const analisis = obtenerConsensoAnalisis(intentos);

      setResultado(analisis);
      setChat([]);

      // Guardar para dataset ML
      try {
        await addDoc(collection(db, 'diagnosticos'), {
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

Diagnóstico: ${resultado?.nombre_problema || 'saludable'} en ${cultivo.nombre}. Gravedad: ${resultado?.gravedad || 'ninguna'}.

Historial:
${historial}

Pregunta: ${p}

INSTRUCCIONES:
- Si pregunta por un producto o fungicida, da nombre comercial + dosis exacta + período de carencia
- Si menciona ubicación en Perú, da recomendación considerando el clima de esa zona
- Sé específico, práctico y breve (máximo 4 oraciones)
- Si necesita comprar, dile que puede encontrar los productos en la sección Fungicidas de la app`
      });

      setChat(prev => [...prev, { role: 'ia', text: resp }]);
      leerTexto(resp);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setChat(prev => [...prev, { role: 'ia', text: 'Error al procesar. Intenta de nuevo.' }]);
    }
    setEnviando(false);
  };

  const colorHeader = () => ({
    critica:  'bg-red-700',
    grave:    'bg-red-600',
    moderada: 'bg-orange-500',
    leve:     'bg-yellow-500',
    ninguna:  'bg-primary',
  }[resultado?.gravedad] || 'bg-primary');

  // ─── PANTALLA RESULTADO ────────────────────────────────────────────────────
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24">

      {/* Modal tiendas */}
      {productoBuscando && (
        <TiendasConProducto
          productoBuscado={productoBuscando}
          onCerrar={() => setProductoBuscando(null)}
        />
      )}

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

        {/* Diagnóstico */}
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

        {/* Acción inmediata */}
        {resultado.aplicacion_inmediata && resultado.tiene_problema && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">⚡ Acción Inmediata</p>
            <p className="text-red-700 text-sm leading-relaxed font-medium">{resultado.aplicacion_inmediata}</p>
          </div>
        )}

        {/* Plan control */}
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

        {/* Productos con botón buscar tienda */}
        {resultado.productos?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                💊 Productos Recomendados
              </p>
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
                    {/* BOTÓN CLAVE: buscar en tiendas */}
                    <button
                      onClick={() => setProductoBuscando(p.nombre)}
                      className="ml-2 flex-shrink-0 flex items-center gap-1 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      <ShoppingBag size={12} />
                      Ver precio
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
            {/* Banner ir a fungicidas */}
            <button onClick={() => navigate('/mercado')}
              className="w-full mt-3 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary">Ver todas las tiendas de fungicidas</p>
              </div>
              <ChevronRight size={16} className="text-primary" />
            </button>
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
        <div>
          {leyendo
            ? <button onClick={detenerVoz} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold py-3 rounded-xl text-sm">
                <VolumeX size={16} /> Detener audio
              </button>
            : <button onClick={() => leerTexto((resultado.aplicacion_inmediata || resultado.que_hacer || '') + '. ' + (resultado.prevencion || ''))}
                className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold py-3 rounded-xl text-sm">
                <Volume2 size={16} /> Escuchar recomendación
              </button>
          }
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
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
            <input value={pregunta} onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarPregunta()}
              placeholder="Ej: ¿Qué fungicida aplico en Cutervo?"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
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

  // ─── PANTALLA PRINCIPAL ────────────────────────────────────────────────────
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

        <div onClick={() => fileRef.current?.click()}
          className="bg-white/20 border-2 border-white/40 border-dashed rounded-3xl p-8 text-center cursor-pointer hover:bg-white/30 transition-all active:scale-95">
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
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">¿Qué cultivo es?</p>
          <div className="flex gap-3 justify-center">
            {CULTIVOS.map(c => (
              <button key={c.id} onClick={() => setCultivo(c)}
                className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
                  cultivo.id === c.id ? 'bg-primary text-white shadow-md scale-105' : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs font-bold">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={analizar} disabled={fotos.length === 0 || analizando}
          className="w-full bg-primary text-white font-bold py-5 rounded-2xl disabled:opacity-50 text-lg shadow-lg">
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

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🤖 PlaguIA detecta</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { e: '🦠', t: 'Enfermedades fúngicas y bacterianas' },
              { e: '🐛', t: 'Plagas e insectos dañinos' },
              { e: '🌿', t: 'Malezas y plantas invasoras' },
              { e: '🏪', t: 'Encuentra el mejor precio del fungicida' },
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
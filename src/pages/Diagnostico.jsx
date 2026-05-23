import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Loader2, AlertTriangle, CheckCircle, Send,
  Mic, MicOff, Volume2, VolumeX, ShoppingBag, ChevronRight,
  Star, Bot, Package, Truck, X, MapPin, ArrowRight,
  CheckCircle2, XCircle, Sparkles, Phone
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { invokeGemini } from '../lib/gemini';
import { CULTIVOS } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────────
   PROMPTS DEL SISTEMA (sin cambios)
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE: TIENDAS CON EL PRODUCTO (sin cambios)
───────────────────────────────────────────────────────────────────────────── */
function TiendasConProducto({ productoBuscado, onCerrar }) {
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { buscarProductoEnTiendas(); }, [productoBuscado]);

  const buscarProductoEnTiendas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
      const tiendasSnap = await getDocs(collection(db, 'tiendas'));
      const tiendasMap = {};
      tiendasSnap.docs.forEach(d => { tiendasMap[d.id] = { id: d.id, ...d.data() }; });
      const resultado = [];
      coincidentes.forEach(prod => {
        const tienda = tiendasMap[prod.tiendaId];
        if (tienda && prod.disponible) resultado.push({ ...prod, tiendaInfo: tienda });
      });
      resultado.sort((a, b) => (parseFloat(a.precio) || 9999) - (parseFloat(b.precio) || 9999));
      setTiendas(resultado);
    } catch (e) { setTiendas([]); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-gray-800">🛡️ {productoBuscado}</h3>
              <p className="text-xs text-gray-500">Tiendas disponibles ordenadas por precio</p>
            </div>
            <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">✕</button>
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
              <p className="font-bold text-gray-700">No encontramos este producto</p>
              <button onClick={() => { navigate('/mercado'); onCerrar(); }}
                className="bg-primary text-white font-bold px-6 py-3 rounded-2xl text-sm mt-4">
                Ver todas las tiendas →
              </button>
            </div>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                <Star size={16} className="text-green-600 fill-green-600" />
                <p className="text-xs font-bold text-green-700">
                  Mejor precio: {tiendas[0].tiendaInfo?.empresa} — S/ {tiendas[0].precio}
                </p>
              </div>
              {tiendas.map((prod, idx) => (
                <div key={prod.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${idx === 0 ? 'border-primary' : 'border-gray-100'}`}>
                  {idx === 0 && <span className="text-xs bg-primary text-white font-bold px-2.5 py-1 rounded-full mb-2 inline-block">⭐ Mejor precio</span>}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{prod.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">🏪 {prod.tiendaInfo?.empresa}</p>
                      <p className="text-xs text-gray-400">📍 {prod.tiendaInfo?.ubicacion}</p>
                      {prod.plagasQueControla && <p className="text-xs text-red-500 mt-1">🐛 {prod.plagasQueControla}</p>}
                      {prod.uso && <p className="text-xs text-gray-500 mt-0.5">💊 {prod.uso}</p>}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-primary">S/ {prod.precio}</p>
                      <p className="text-xs text-gray-400">por unidad</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {prod.tiendaInfo?.celular && (
                      <a href={`https://wa.me/51${prod.tiendaInfo.celular.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, vi en AGRILUX que tienen ${prod.nombre}. ¿Está disponible?`)}`}
                        target="_blank" rel="noreferrer"
                        className="flex-1 bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl text-center">
                        📲 Consultar
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AGENTE DE COMPRA — el corazón nuevo
   Pasos: buscando → propuesta → direccion → resumen → exito | sin_stock | error
───────────────────────────────────────────────────────────────────────────── */
function AgenteCompra({ resultado, cultivo, user, onCerrar }) {
  const [paso, setPaso] = useState('buscando');
  const [mejorProducto, setMejorProducto] = useState(null);
  const [tiendaInfo, setTiendaInfo] = useState(null);
  const [guiaAplicacion, setGuiaAplicacion] = useState('');
  const [costoNeto, setCostoNeto] = useState(0);
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [grabandoDireccion, setGrabandoDireccion] = useState(false);
  const [grabandoConfirm, setGrabandoConfirm] = useState(false);
  const [creandoPedido, setCreandoPedido] = useState(false);
  const [mensajeAgente, setMensajeAgente] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const reconRef = useRef(null);
  const navigate = useNavigate();

  /* ── helpers de voz ── */
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

  const grabarVoz = (onResultado) => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Usa Chrome para la función de voz'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-PE'; r.continuous = false;
    r.onresult = (e) => onResultado(e.results[0][0].transcript);
    r.onerror = () => {};
    r.onend = () => {};
    reconRef.current = r;
    r.start();
    return r;
  };

  /* ── PASO 1: buscar el mejor producto en Firebase ── */
  useEffect(() => { buscarMejorProducto(); }, []);

  const buscarMejorProducto = async () => {
    setPaso('buscando');
    setMensajeAgente('Analizando tu diagnóstico y buscando el mejor fungicida disponible...');
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      /* Palabras clave: nombre del problema + productos recomendados por la IA */
      const palabrasClave = [
        ...(resultado.nombre_problema || '').toLowerCase().split(/\s+/).filter(p => p.length > 2),
        ...(resultado.productos || []).flatMap(p =>
          (p.nombre || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
        ),
        ...(resultado.nombre_cientifico || '').toLowerCase().split(/\s+/).filter(p => p.length > 3),
      ];

      /* Filtrar disponibles que coincidan */
      let candidatos = todos.filter(p => {
        if (!p.disponible) return false;
        const texto = `${p.nombre} ${p.plagasQueControla} ${p.descripcion}`.toLowerCase();
        return palabrasClave.some(pc => texto.includes(pc));
      });

      /* Fallback: todos los disponibles del cultivo */
      if (candidatos.length === 0) {
        candidatos = todos.filter(p => p.disponible &&
          (p.cultivos || []).includes(cultivo.id));
      }
      /* Último recurso: cualquier disponible */
      if (candidatos.length === 0) {
        candidatos = todos.filter(p => p.disponible);
      }
      if (candidatos.length === 0) { setPaso('sin_stock'); return; }

      /* Ordenar por precio (mejor primero) */
      candidatos.sort((a, b) => (parseFloat(a.precio) || 9999) - (parseFloat(b.precio) || 9999));
      const mejor = candidatos[0];

      /* Obtener info de la tienda */
      const tiendasSnap = await getDocs(collection(db, 'tiendas'));
      const tiendasMap = {};
      tiendasSnap.docs.forEach(d => { tiendasMap[d.id] = { id: d.id, ...d.data() }; });
      const tienda = tiendasMap[mejor.tiendaId];
      if (!tienda) { setPaso('sin_stock'); return; }

      setMejorProducto(mejor);
      setTiendaInfo(tienda);
      setCostoNeto(parseFloat(mejor.precio) || 0);

      /* Generar guía de aplicación personalizada con IA */
      setMensajeAgente('Generando instrucciones de aplicación personalizadas...');
      const dosis = resultado.productos?.[0]?.dosis || '';
      const frecuencia = resultado.productos?.[0]?.frecuencia || '';
      const carencia = resultado.productos?.[0]?.carencia || '';

      const guia = await invokeGemini({
        prompt: `Eres PlaguIA, agrónomo experto. Situación:
- Cultivo: ${cultivo.nombre}
- Problema detectado: ${resultado.nombre_problema}
- Producto seleccionado: ${mejor.nombre} (${mejor.ingrediente_activo || ''})
- Uso del producto: ${mejor.uso || ''}
- Dosis recomendada por diagnóstico: ${dosis}
- Frecuencia: ${frecuencia}
- Período de carencia: ${carencia}

Escribe una guía de aplicación en 3 pasos NUMERADOS, muy práctica y en español simple para un agricultor peruano.
Incluye: dosis exacta, momento del día para aplicar y equipo de protección básico.
Máximo 100 palabras en total. Sin encabezados, solo los 3 pasos numerados.`
      });

      setGuiaAplicacion(guia);
      setPaso('propuesta');

      const textoVoz = `Encontré el mejor producto para tu ${cultivo.nombre}. 
        ${mejor.nombre} disponible en ${tienda.empresa}, ubicada en ${tienda.ubicacion}, 
        a solo ${mejor.precio} soles. ¿Quieres que lo pida con delivery a tu parcela?`;
      leerTexto(textoVoz);

    } catch (e) {
      console.error(e);
      setPaso('error');
    }
  };

  /* ── PASO 3: confirmar pedido en Firebase ── */
  const confirmarPedido = async () => {
    if (!direccion.trim()) {
      leerTexto('Por favor dime tu dirección de entrega.');
      return;
    }
    setCreandoPedido(true);
    try {
      const total = costoNeto;
      await addDoc(collection(db, 'pedidos'), {
        productoId: mejorProducto.id,
        productoNombre: mejorProducto.nombre,
        tiendaId: tiendaInfo.id,
        tiendaEmpresa: tiendaInfo.empresa,
        tiendaCelular: tiendaInfo.celular || '',
        agricultorId: user?.uid || '',
        agricultorNombre: user?.nombre || '',
        agricultorEmail: user?.email || '',
        agricultorCelular: user?.celular || '',
        cantidad: 1,
        precioUnitario: total,
        total,
        comision: total * 0.05,
        direccionEntrega: direccion,
        referencia,
        estado: 'pendiente',
        origenAgente: true,
        diagnosticoProblema: resultado.nombre_problema,
        cultivoNombre: cultivo.nombre,
        guiaAplicacion,
        createdAt: new Date().toISOString(),
      });

      setPaso('exito');
      leerTexto(`¡Perfecto! Tu pedido de ${mejorProducto.nombre} fue registrado exitosamente. 
        El equipo de ${tiendaInfo.empresa} lo confirmará pronto y un motorizado lo llevará a tu parcela. 
        Recuerda: ${guiaAplicacion.split('.')[0]}.`);
    } catch (e) {
      alert('Error al crear el pedido. Intenta de nuevo.');
    }
    setCreandoPedido(false);
  };

  /* ── Reconocimiento de voz para confirmar/cancelar ── */
  const escucharDecision = () => {
    setGrabandoConfirm(true);
    const r = grabarVoz((texto) => {
      setGrabandoConfirm(false);
      const t = texto.toLowerCase();
      if (t.includes('confirm') || t.includes('cerrar pedido') || t.includes('acepto') || t.includes('sí') || t.includes('si')) {
        confirmarPedido();
      } else if (t.includes('cancel') || t.includes('no quiero') || t.includes('cancelar')) {
        onCerrar();
      } else {
        leerTexto('No entendí. Di "confirmar pedido" o "cancelar".');
      }
    });
    if (r) {
      r.onstart = () => setGrabandoConfirm(true);
      r.onend = () => setGrabandoConfirm(false);
    }
  };

  /* ═══════════════════════════ RENDERS POR PASO ═══════════════════════════ */

  /* Pantalla: buscando */
  if (paso === 'buscando') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Bot size={36} className="text-primary animate-pulse" />
        </div>
        <h3 className="font-display font-bold text-xl text-gray-800 mb-2">Agente PlaguIA</h3>
        <p className="text-sm text-gray-500 mb-6">{mensajeAgente}</p>
        <div className="flex justify-center gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  /* Pantalla: sin stock */
  if (paso === 'sin_stock') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 text-center">
        <p className="text-4xl mb-3">🏪</p>
        <h3 className="font-bold text-lg text-gray-800 mb-2">Sin stock disponible</h3>
        <p className="text-sm text-gray-500 mb-5">No encontramos el fungicida en tiendas registradas ahora mismo. Puedes buscar manualmente en el marketplace.</p>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">Volver</button>
          <button onClick={() => { navigate('/mercado'); onCerrar(); }}
            className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-sm">Ver tiendas</button>
        </div>
      </div>
    </div>
  );

  /* Pantalla: error */
  if (paso === 'error') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 text-center">
        <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
        <h3 className="font-bold text-lg text-gray-800 mb-2">Error del agente</h3>
        <p className="text-sm text-gray-500 mb-5">Ocurrió un problema. Intenta de nuevo.</p>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">Cancelar</button>
          <button onClick={buscarMejorProducto} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-sm">Reintentar</button>
        </div>
      </div>
    </div>
  );

  /* Pantalla: propuesta del agente */
  if (paso === 'propuesta') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[92vh] overflow-y-auto">

        {/* Header agente */}
        <div className="bg-gradient-to-r from-primary to-emerald-600 px-6 pt-6 pb-5 text-white rounded-t-3xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">Agente PlaguIA</p>
                <p className="text-white/70 text-xs">Selección automática · Mejor precio</p>
              </div>
            </div>
            <button onClick={onCerrar} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X size={16} className="text-white" />
            </button>
          </div>
          <div className="bg-white/15 rounded-2xl p-3">
            <p className="text-white/90 text-sm leading-relaxed">
              🤖 Encontré el <strong>mejor producto</strong> para tu {cultivo.emoji} {cultivo.nombre} con <strong>{resultado.nombre_problema}</strong>.
              Aquí está mi propuesta:
            </p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">

          {/* Producto seleccionado */}
          <div className="bg-primary/5 border-2 border-primary rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-primary text-white font-bold px-2 py-0.5 rounded-full">⭐ Mejor precio</span>
                </div>
                <p className="font-bold text-gray-800 text-base">{mejorProducto.nombre}</p>
                {mejorProducto.ingrediente_activo && (
                  <p className="text-xs text-gray-400 italic">{mejorProducto.ingrediente_activo}</p>
                )}
              </div>
              <div className="text-right ml-3">
                <p className="text-2xl font-bold text-primary">S/ {mejorProducto.precio}</p>
                <p className="text-xs text-gray-400">por unidad</p>
              </div>
            </div>
            {mejorProducto.plagasQueControla && (
              <div className="bg-red-50 rounded-xl p-2 mb-2">
                <p className="text-xs text-red-600 font-semibold">🐛 {mejorProducto.plagasQueControla}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-1 border-t border-primary/10">
              <span>🏪</span>
              <span className="font-semibold">{tiendaInfo.empresa}</span>
              <span>·</span>
              <span>📍 {tiendaInfo.ubicacion}</span>
            </div>
          </div>

          {/* Guía de aplicación */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              📋 Cómo aplicar este producto
            </p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{guiaAplicacion}</p>
          </div>

          {/* Costo neto */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💰 Resumen de costo</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Producto</span>
                <span className="font-semibold text-gray-800">S/ {costoNeto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="font-semibold text-green-600">Coordinado con tienda</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-800">Costo neto</span>
                <span className="font-bold text-primary text-base">S/ {costoNeto.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pb-2">
            <button onClick={onCerrar}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm">
              Seguir consultando
            </button>
            <button onClick={() => {
              setPaso('direccion');
              setTimeout(() => leerTexto('¿A qué dirección te entregamos el producto? Puedes escribirla o dictarla con el micrófono.'), 300);
            }}
              className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg">
              <Package size={16} /> Pedir ahora
            </button>
          </div>

          {/* Audio toggle */}
          <button
            onClick={leyendo ? detenerVoz : () => leerTexto(`${mejorProducto.nombre} en ${tiendaInfo.empresa} a ${costoNeto} soles. ${guiaAplicacion}`)}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl text-sm transition-colors ${
              leyendo ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}>
            {leyendo ? <><VolumeX size={16} /> Detener audio</> : <><Volume2 size={16} /> Escuchar propuesta</>}
          </button>
        </div>
      </div>
    </div>
  );

  /* Pantalla: ingresar dirección */
  if (paso === 'direccion') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <MapPin size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">¿Dónde entregamos?</h3>
            <p className="text-xs text-gray-500">Escribe o dicta tu dirección</p>
          </div>
          <button onClick={onCerrar} className="ml-auto w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Producto mini resumen */}
        <div className="bg-primary/5 rounded-2xl p-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-lg">💊</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-800 truncate">{mejorProducto.nombre}</p>
            <p className="text-xs text-gray-500">{tiendaInfo.empresa} · S/ {costoNeto.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">📍 Dirección exacta *</label>
            <div className="relative">
              <textarea
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                rows={3}
                placeholder="Sector, nombre de parcela, distrito, provincia, referencias..."
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none pr-12"
              />
              {/* Botón micrófono dentro del textarea */}
              <button
                onClick={() => {
                  setGrabandoDireccion(true);
                  const r = grabarVoz((texto) => {
                    setDireccion(texto);
                    setGrabandoDireccion(false);
                  });
                  if (r) {
                    r.onstart = () => setGrabandoDireccion(true);
                    r.onend = () => setGrabandoDireccion(false);
                  }
                }}
                className={`absolute right-3 top-3 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  grabandoDireccion ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500'
                }`}>
                {grabandoDireccion ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>
            {grabandoDireccion && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" /> Escuchando...
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Referencia adicional</label>
            <input
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Casa azul al lado del río, cerca al colegio..."
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPaso('propuesta')}
            className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm">
            ← Volver
          </button>
          <button
            onClick={() => {
              if (!direccion.trim()) {
                leerTexto('Por favor ingresa tu dirección de entrega.');
                return;
              }
              setPaso('resumen');
              setTimeout(() => leerTexto(`Confirma tu pedido: ${mejorProducto.nombre} de ${tiendaInfo.empresa}, entrega en: ${direccion}. Costo neto: ${costoNeto} soles. Di confirmar pedido o cancelar.`), 200);
            }}
            disabled={!direccion.trim()}
            className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  /* Pantalla: resumen final */
  if (paso === 'resumen') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[90vh] overflow-y-auto">

        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xl text-gray-800">Confirmar pedido</h3>
            <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <X size={15} className="text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Revisa los detalles antes de confirmar</p>
        </div>

        <div className="px-4 py-4 space-y-3">

          {/* Producto */}
          <div className="bg-primary/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💊 Producto</p>
            <p className="font-bold text-gray-800">{mejorProducto.nombre}</p>
            {mejorProducto.ingrediente_activo && <p className="text-xs text-gray-400 italic">{mejorProducto.ingrediente_activo}</p>}
            <p className="text-xs text-gray-500 mt-1">🏪 {tiendaInfo.empresa} · 📍 {tiendaInfo.ubicacion}</p>
          </div>

          {/* Aplicación */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📋 Instrucciones de aplicación</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{guiaAplicacion}</p>
          </div>

          {/* Dirección */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📍 Dirección de entrega</p>
            <p className="text-gray-700 text-sm">{direccion}</p>
            {referencia && <p className="text-xs text-gray-400 mt-1">📌 {referencia}</p>}
          </div>

          {/* Costo */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💰 Costo neto</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Producto (1 unidad)</span>
                <span className="font-semibold">S/ {costoNeto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="text-green-600 font-semibold">Coordinado</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-base">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-primary">S/ {costoNeto.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botón escuchar */}
          <button
            onClick={leyendo ? detenerVoz : () => leerTexto(`Pedido: ${mejorProducto.nombre} de ${tiendaInfo.empresa}. Dirección: ${direccion}. Costo neto: ${costoNeto} soles. Di confirmar pedido o cancelar.`)}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl text-sm ${
              leyendo ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}>
            {leyendo ? <><VolumeX size={15} /> Detener</> : <><Volume2 size={15} /> Escuchar resumen</>}
          </button>

          {/* Botón voz para confirmar/cancelar */}
          <button
            onClick={escucharDecision}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm border-2 transition-all ${
              grabandoConfirm
                ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                : 'border-primary/30 bg-primary/5 text-primary'
            }`}>
            {grabandoConfirm
              ? <><MicOff size={16} /> Escuchando... di "confirmar" o "cancelar"</>
              : <><Mic size={16} /> Confirmar o cancelar por voz</>
            }
          </button>

          {/* Botones principales */}
          <div className="flex gap-3 pb-2">
            <button
              onClick={onCerrar}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2">
              <XCircle size={16} /> Cancelar
            </button>
            <button
              onClick={confirmarPedido}
              disabled={creandoPedido}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
              {creandoPedido
                ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                : <><CheckCircle2 size={16} /> Cerrar pedido</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* Pantalla: éxito */
  if (paso === 'exito') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h3 className="font-display font-bold text-2xl text-gray-800 mb-2">¡Pedido registrado!</h3>
        <p className="text-gray-500 text-sm mb-5 leading-relaxed">
          Tu pedido de <strong>{mejorProducto.nombre}</strong> fue enviado a <strong>{tiendaInfo.empresa}</strong>.
          Un motorizado lo llevará a tu parcela pronto.
        </p>

        {/* Info contacto tienda */}
        {tiendaInfo.celular && (
          <a href={`https://wa.me/51${tiendaInfo.celular.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, hice un pedido de ${mejorProducto.nombre} a través de AGRILUX. ¿Cuándo lo despachan?`)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl text-sm mb-3 w-full">
            <Phone size={16} /> Contactar a {tiendaInfo.empresa}
          </a>
        )}

        <button
          onClick={() => { navigate('/mercado'); onCerrar(); }}
          className="w-full bg-gray-100 text-gray-700 font-bold py-3.5 rounded-2xl text-sm mb-3">
          Ver estado del pedido
        </button>
        <button onClick={onCerrar} className="text-sm text-gray-400 underline">Volver al diagnóstico</button>

        {/* Recordatorio de aplicación */}
        {guiaAplicacion && (
          <div className="mt-5 bg-primary/5 rounded-2xl p-4 text-left">
            <p className="text-xs font-bold text-primary mb-2">📋 Recuerda cómo aplicarlo:</p>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{guiaAplicacion}</p>
          </div>
        )}
      </div>
    </div>
  );

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL: Diagnostico
───────────────────────────────────────────────────────────────────────────── */
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
  const [productoBuscando, setProductoBuscando] = useState(null);
  const [mostrarAgente, setMostrarAgente] = useState(false);   // ← NUEVO
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

  const analizarUnaVez = async (compressedUrls) => {
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
      for (let i = 1; i <= 3; i++) {
        intentos.push(await analizarUnaVez(compressedUrls));
      }
      const analisis = obtenerConsensoAnalisis(intentos);
      setResultado(analisis);
      setChat([]);
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
    critica: 'bg-red-700', grave: 'bg-red-600', moderada: 'bg-orange-500',
    leve: 'bg-yellow-500', ninguna: 'bg-primary',
  }[resultado?.gravedad] || 'bg-primary');

  /* ═══════════════════════════ PANTALLA RESULTADO ═══════════════════════════ */
  if (resultado && !resultado.error) return (
    <div className="min-h-screen pb-24">

      {/* Modal agente */}
      {mostrarAgente && (
        <AgenteCompra
          resultado={resultado}
          cultivo={cultivo}
          user={user}
          onCerrar={() => setMostrarAgente(false)}
        />
      )}

      {/* Modal tiendas (búsqueda manual) */}
      {productoBuscando && (
        <TiendasConProducto
          productoBuscado={productoBuscando}
          onCerrar={() => setProductoBuscando(null)}
        />
      )}

      {/* Header con severidad */}
      <div className={`px-6 pt-12 pb-6 text-white ${colorHeader()}`}>
        <button onClick={() => { setResultado(null); setFotos([]); setChat([]); setMostrarAgente(false); }}
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

      {/* ══ BOTONES DECISIÓN DEL AGRICULTOR (NUEVO) ══ */}
      {resultado.tiene_problema && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-3xl p-4 shadow-md border border-primary/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-primary" />
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">¿Qué deseas hacer?</p>
            </div>
            <div className="flex gap-3">
              {/* Seguir consultando → baja al chat */}
              <button
                onClick={() => { document.getElementById('chat-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm flex flex-col items-center gap-1">
                <span className="text-xl">💬</span>
                <span className="text-xs">Seguir consultando</span>
              </button>
              {/* Completar proceso → agente */}
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

        {/* Productos con botones de búsqueda manual */}
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
                      {p.ingrediente_activo && <p className="text-xs text-gray-400 italic truncate">{p.ingrediente_activo}</p>}
                    </div>
                    <button onClick={() => setProductoBuscando(p.nombre)}
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

            {/* Banner agente destacado */}
            {resultado.tiene_problema && (
              <button onClick={() => setMostrarAgente(true)}
                className="w-full mt-3 flex items-center justify-between bg-primary text-white rounded-2xl px-4 py-3.5 shadow">
                <div className="flex items-center gap-2">
                  <Bot size={18} className="text-white" />
                  <div className="text-left">
                    <p className="text-sm font-bold">Que el agente lo compre por ti</p>
                    <p className="text-xs text-white/80">Busca el mejor precio y coordina el delivery</p>
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

        {/* Chat con agrónomo */}
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

  /* ═══════════════════════════ PANTALLA PRINCIPAL ═══════════════════════════ */
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
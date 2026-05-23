import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, X, Package, MapPin, ArrowRight, CheckCircle2,
  XCircle, Volume2, VolumeX, Mic, MicOff,
  Loader2, AlertTriangle, CheckCircle, Phone,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { invokeGemini } from '../../lib/gemini';
import { useNavigate } from 'react-router-dom';

export default function AgenteCompra({ resultado, cultivo, user, onCerrar }) {
  const [paso, setPaso]               = useState('buscando');
  const [mejorProducto, setMejorProducto] = useState(null);
  const [tiendaInfo, setTiendaInfo]   = useState(null);
  const [guiaAplicacion, setGuiaAplicacion] = useState('');
  const [costoNeto, setCostoNeto]     = useState(0);
  const [direccion, setDireccion]     = useState('');
  const [referencia, setReferencia]   = useState('');
  const [grabandoDireccion, setGrabandoDireccion] = useState(false);
  const [grabandoConfirm, setGrabandoConfirm]     = useState(false);
  const [creandoPedido, setCreandoPedido] = useState(false);
  const [mensajeAgente, setMensajeAgente] = useState('');
  const [leyendo, setLeyendo]         = useState(false);
  const reconRef = useRef(null);
  const navigate = useNavigate();

  /* ── Voz: síntesis ── */
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

  /* ── Voz: reconocimiento ── */
  const grabarVoz = (onResultado) => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Usa Chrome para la función de voz'); return null;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.lang = 'es-PE'; r.continuous = false;
    r.onresult = (e) => onResultado(e.results[0][0].transcript);
    r.onerror  = () => {};
    r.onend    = () => {};
    reconRef.current = r;
    r.start();
    return r;
  };

  /* ── PASO 1: buscar mejor producto ── */
  useEffect(() => { buscarMejorProducto(); }, []);

  const buscarMejorProducto = async () => {
    setPaso('buscando');
    setMensajeAgente('Analizando diagnóstico y buscando el mejor fungicida...');
    try {
      const snap  = await getDocs(collection(db, 'productos'));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const palabrasClave = [
        ...(resultado.nombre_problema || '').toLowerCase().split(/\s+/).filter(p => p.length > 2),
        ...(resultado.productos || []).flatMap(p =>
          (p.nombre || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
        ),
        ...(resultado.nombre_cientifico || '').toLowerCase().split(/\s+/).filter(p => p.length > 3),
      ];

      let candidatos = todos.filter(p => {
        if (!p.disponible) return false;
        const texto = `${p.nombre} ${p.plagasQueControla} ${p.descripcion}`.toLowerCase();
        return palabrasClave.some(pc => texto.includes(pc));
      });

      if (!candidatos.length)
        candidatos = todos.filter(p => p.disponible && (p.cultivos || []).includes(cultivo.id));
      if (!candidatos.length)
        candidatos = todos.filter(p => p.disponible);
      if (!candidatos.length) { setPaso('sin_stock'); return; }

      candidatos.sort((a, b) => (parseFloat(a.precio) || 9999) - (parseFloat(b.precio) || 9999));
      const mejor = candidatos[0];

      const tiendasSnap = await getDocs(collection(db, 'tiendas'));
      const tiendasMap  = {};
      tiendasSnap.docs.forEach(d => { tiendasMap[d.id] = { id: d.id, ...d.data() }; });
      const tienda = tiendasMap[mejor.tiendaId];
      if (!tienda) { setPaso('sin_stock'); return; }

      setMejorProducto(mejor);
      setTiendaInfo(tienda);
      setCostoNeto(parseFloat(mejor.precio) || 0);

      setMensajeAgente('Generando instrucciones de aplicación personalizadas...');
      const dosis     = resultado.productos?.[0]?.dosis     || '';
      const frecuencia = resultado.productos?.[0]?.frecuencia || '';
      const carencia  = resultado.productos?.[0]?.carencia  || '';

      const guia = await invokeGemini({
        prompt: `Eres PlaguIA, agrónomo experto. Situación:
- Cultivo: ${cultivo.nombre}
- Problema: ${resultado.nombre_problema}
- Producto: ${mejor.nombre} (${mejor.ingrediente_activo || ''})
- Uso: ${mejor.uso || ''}
- Dosis diagnóstico: ${dosis} | Frecuencia: ${frecuencia} | Carencia: ${carencia}

Escribe una guía de aplicación en exactamente 3 pasos NUMERADOS, práctica y en español simple.
Incluye dosis, horario y equipo de protección. Máximo 100 palabras. Solo los 3 pasos, sin encabezados.`,
      });

      setGuiaAplicacion(guia);
      setPaso('propuesta');
      leerTexto(`Encontré el mejor producto para tu ${cultivo.nombre}. ${mejor.nombre} en ${tienda.empresa}, ${tienda.ubicacion}, a ${mejor.precio} soles. ¿Lo pedimos con delivery?`);
    } catch (e) {
      console.error(e);
      setPaso('error');
    }
  };

  /* ── PASO 4: crear pedido en Firebase ── */
  const confirmarPedido = async () => {
    if (!direccion.trim()) { leerTexto('Ingresa tu dirección de entrega.'); return; }
    setCreandoPedido(true);
    try {
      await addDoc(collection(db, 'pedidos'), {
        productoId:        mejorProducto.id,
        productoNombre:    mejorProducto.nombre,
        tiendaId:          tiendaInfo.id,
        tiendaEmpresa:     tiendaInfo.empresa,
        tiendaCelular:     tiendaInfo.celular    ?? '',
        agricultorId:      user?.uid             ?? '',
        agricultorNombre:  user?.nombre          ?? '',
        agricultorEmail:   user?.email           ?? '',
        agricultorCelular: user?.celular         ?? '',
        cantidad:          1,
        precioUnitario:    costoNeto,
        total:             costoNeto,
        comision:          costoNeto * 0.05,
        direccionEntrega:  direccion,
        referencia:        referencia            ?? '',
        estado:            'pendiente',
        origenAgente:      true,
        diagnosticoProblema: resultado.nombre_problema ?? '',
        cultivoNombre:     cultivo.nombre,
        guiaAplicacion,
        createdAt:         new Date().toISOString(),
      });
      setPaso('exito');
      leerTexto(`¡Pedido registrado! ${mejorProducto.nombre} fue enviado a ${tiendaInfo.empresa}. Un motorizado lo llevará a tu parcela pronto.`);
    } catch (e) {
      alert('Error al crear el pedido. Intenta de nuevo.');
    }
    setCreandoPedido(false);
  };

  /* ── Voz: confirmar/cancelar ── */
  const escucharDecision = () => {
    setGrabandoConfirm(true);
    const r = grabarVoz((texto) => {
      setGrabandoConfirm(false);
      const t = texto.toLowerCase();
      if (t.includes('confirm') || t.includes('cerrar') || t.includes('acepto') || t.includes('sí') || t.includes('si')) {
        confirmarPedido();
      } else if (t.includes('cancel') || t.includes('no quiero')) {
        onCerrar();
      } else {
        leerTexto('No entendí. Di "confirmar pedido" o "cancelar".');
      }
    });
    if (r) { r.onstart = () => setGrabandoConfirm(true); r.onend = () => setGrabandoConfirm(false); }
  };

  /* ════════════════════ RENDERS ════════════════════ */

  if (paso === 'buscando') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Bot size={36} className="text-primary animate-pulse" />
        </div>
        <h3 className="font-display font-bold text-xl text-gray-800 mb-2">Agente PlaguIA</h3>
        <p className="text-sm text-gray-500 mb-6">{mensajeAgente}</p>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  if (paso === 'sin_stock') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 text-center">
        <p className="text-4xl mb-3">🏪</p>
        <h3 className="font-bold text-lg text-gray-800 mb-2">Sin stock disponible</h3>
        <p className="text-sm text-gray-500 mb-5">No encontramos el fungicida en tiendas registradas. Puedes buscar en el marketplace.</p>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">Volver</button>
          <button onClick={() => { navigate('/mercado'); onCerrar(); }}
            className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-sm">Ver tiendas</button>
        </div>
      </div>
    </div>
  );

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

  if (paso === 'propuesta') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[92vh] overflow-y-auto">

        <div className="bg-gradient-to-r from-primary to-emerald-600 px-6 pt-6 pb-5 text-white rounded-t-3xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <p className="font-bold text-sm">Agente PlaguIA</p>
                <p className="text-white/70 text-xs">Selección automática · Mejor precio</p>
              </div>
            </div>
            <button onClick={onCerrar} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
          <div className="bg-white/15 rounded-2xl p-3">
            <p className="text-white/90 text-sm leading-relaxed">
              🤖 Encontré el <strong>mejor producto</strong> para tu {cultivo.emoji} {cultivo.nombre} con <strong>{resultado.nombre_problema}</strong>.
            </p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">

          {/* Producto */}
          <div className="bg-primary/5 border-2 border-primary rounded-2xl p-4">
            <span className="text-xs bg-primary text-white font-bold px-2 py-0.5 rounded-full mb-2 inline-block">⭐ Mejor precio</span>
            <div className="flex items-start justify-between">
              <div className="flex-1">
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
              <div className="bg-red-50 rounded-xl p-2 mt-2">
                <p className="text-xs text-red-600 font-semibold">🐛 {mejorProducto.plagasQueControla}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 mt-2 border-t border-primary/10">
              <span>🏪 {tiendaInfo.empresa}</span>
              <span>·</span>
              <span>📍 {tiendaInfo.ubicacion}</span>
            </div>
          </div>

          {/* Guía aplicación */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📋 Cómo aplicar</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{guiaAplicacion}</p>
          </div>

          {/* Costo */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💰 Costo neto</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Producto</span>
                <span className="font-semibold">S/ {costoNeto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="text-green-600 font-semibold">Coordinado con tienda</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                <span>Total</span>
                <span className="text-primary">S/ {costoNeto.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button onClick={onCerrar}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm">
              Seguir consultando
            </button>
            <button onClick={() => {
              setPaso('direccion');
              setTimeout(() => leerTexto('¿A qué dirección entregamos? Puedes escribirla o dictarla.'), 300);
            }}
              className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg">
              <Package size={16} /> Pedir ahora
            </button>
          </div>

          <button
            onClick={leyendo ? detenerVoz : () => leerTexto(`${mejorProducto.nombre} en ${tiendaInfo.empresa} a ${costoNeto} soles. ${guiaAplicacion}`)}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl text-sm ${leyendo ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
            {leyendo ? <><VolumeX size={16} /> Detener</> : <><Volume2 size={16} /> Escuchar propuesta</>}
          </button>
        </div>
      </div>
    </div>
  );

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

        {/* Mini resumen producto */}
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
                placeholder="Sector, parcela, distrito, provincia, referencias..."
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none pr-12"
              />
              <button
                onClick={() => {
                  setGrabandoDireccion(true);
                  const r = grabarVoz((texto) => { setDireccion(texto); setGrabandoDireccion(false); });
                  if (r) { r.onstart = () => setGrabandoDireccion(true); r.onend = () => setGrabandoDireccion(false); }
                }}
                className={`absolute right-3 top-3 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${grabandoDireccion ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                {grabandoDireccion ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>
            {grabandoDireccion && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping inline-block" /> Escuchando...
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Referencia adicional</label>
            <input
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Casa azul al lado del río..."
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
              if (!direccion.trim()) { leerTexto('Ingresa tu dirección.'); return; }
              setPaso('resumen');
              setTimeout(() => leerTexto(`Confirma: ${mejorProducto.nombre}, entrega en ${direccion}. Costo: ${costoNeto} soles. Di confirmar o cancelar.`), 200);
            }}
            disabled={!direccion.trim()}
            className="flex-1 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  if (paso === 'resumen') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[90vh] overflow-y-auto">

        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-800">Confirmar pedido</h3>
            <p className="text-xs text-gray-500 mt-0.5">Revisa los detalles antes de confirmar</p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">

          <div className="bg-primary/5 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💊 Producto</p>
            <p className="font-bold text-gray-800">{mejorProducto.nombre}</p>
            {mejorProducto.ingrediente_activo && <p className="text-xs text-gray-400 italic">{mejorProducto.ingrediente_activo}</p>}
            <p className="text-xs text-gray-500 mt-1">🏪 {tiendaInfo.empresa} · 📍 {tiendaInfo.ubicacion}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📋 Instrucciones de aplicación</p>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{guiaAplicacion}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📍 Dirección de entrega</p>
            <p className="text-gray-700 text-sm">{direccion}</p>
            {referencia && <p className="text-xs text-gray-400 mt-1">📌 {referencia}</p>}
          </div>

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
              <div className="flex justify-between pt-2 border-t border-gray-200 text-base font-bold">
                <span>Total</span>
                <span className="text-primary">S/ {costoNeto.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Audio resumen */}
          <button
            onClick={leyendo ? detenerVoz : () => leerTexto(`Pedido: ${mejorProducto.nombre}. Entrega en: ${direccion}. Total: ${costoNeto} soles.`)}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl text-sm ${leyendo ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
            {leyendo ? <><VolumeX size={15} /> Detener</> : <><Volume2 size={15} /> Escuchar resumen</>}
          </button>

          {/* Voz confirmar/cancelar */}
          <button
            onClick={escucharDecision}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm border-2 transition-all ${grabandoConfirm ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-primary/30 bg-primary/5 text-primary'}`}>
            {grabandoConfirm
              ? <><MicOff size={16} /> Escuchando... di "confirmar" o "cancelar"</>
              : <><Mic size={16} /> Confirmar o cancelar por voz</>}
          </button>

          {/* Botones principales */}
          <div className="flex gap-3 pb-2">
            <button onClick={onCerrar}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2">
              <XCircle size={16} /> Cancelar
            </button>
            <button onClick={confirmarPedido} disabled={creandoPedido}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
              {creandoPedido
                ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                : <><CheckCircle2 size={16} /> Cerrar pedido</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (paso === 'exito') return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h3 className="font-display font-bold text-2xl text-gray-800 mb-2">¡Pedido registrado!</h3>
        <p className="text-gray-500 text-sm mb-5 leading-relaxed">
          <strong>{mejorProducto.nombre}</strong> fue enviado a <strong>{tiendaInfo.empresa}</strong>.
          Un motorizado lo llevará a tu parcela pronto.
        </p>

        {tiendaInfo.celular && (
          <a href={`https://wa.me/51${tiendaInfo.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, hice un pedido de ${mejorProducto.nombre} a través de AGRILUX. ¿Cuándo lo despachan?`)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl text-sm mb-3 w-full">
            <Phone size={16} /> Contactar a {tiendaInfo.empresa}
          </a>
        )}

        <button onClick={() => { navigate('/mercado'); onCerrar(); }}
          className="w-full bg-gray-100 text-gray-700 font-bold py-3.5 rounded-2xl text-sm mb-3">
          Ver estado del pedido
        </button>
        <button onClick={onCerrar} className="text-sm text-gray-400 underline">Volver al diagnóstico</button>

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

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  collection, addDoc, getDocs, query, where,
  updateDoc, doc, onSnapshot, orderBy, setDoc, getDoc
} from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS } from '../lib/constants';
import {
  X, Plus, Loader2, Camera, CheckCircle,
  Package, Truck, ChevronRight, Store, LogIn
} from 'lucide-react';
import { invokeGemini } from '../lib/gemini';

const WHATSAPP_SOPORTE = '51935211605';
const COMISION = 0.05;

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700',    icon: '✅' },
  en_camino:  { label: 'En camino',  color: 'bg-purple-100 text-purple-700', icon: '🏍️' },
  entregado:  { label: 'Entregado',  color: 'bg-green-100 text-green-700',  icon: '📦' },
  cancelado:  { label: 'Cancelado',  color: 'bg-red-100 text-red-600',      icon: '❌' },
};

// ─── SETUP TIENDA (proveedor sin tienda aún) ──────────────────────────────────
function SetupTienda({ user, onCreada }) {
  const [form, setForm] = useState({ empresa: '', ubicacion: '', celular: '' });
  const [loading, setLoading] = useState(false);

  const crear = async () => {
    if (!form.empresa || !form.ubicacion) { alert('Completa nombre y ubicación'); return; }
    setLoading(true);
    try {
      await setDoc(doc(db, 'tiendas', user.uid), {
        ...form,
        userId: user.uid,
        userEmail: user.email,
        nombre: user.nombre,
        createdAt: new Date().toISOString(),
      });
      onCreada({ id: user.uid, ...form, userId: user.uid });
    } catch (e) { alert('Error al crear tienda'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">🏪</div>
          <h2 className="font-display font-bold text-xl text-gray-800">Configura tu tienda</h2>
          <p className="text-xs text-gray-500 mt-1">Solo la primera vez</p>
        </div>
        <div className="space-y-3">
          {[
            { key: 'empresa',   label: 'Nombre de empresa *', ph: 'Ej: Agroservicios SAC' },
            { key: 'ubicacion', label: 'Ciudad / Distrito *',  ph: 'Ej: Lima' },
            { key: 'celular',   label: 'Celular de contacto',  ph: '935211605', type: 'tel' },
          ].map(({ key, label, ph, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              <input type={type || 'text'} value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          ))}
          <button onClick={crear} disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50 mt-2">
            {loading ? 'Creando...' : 'Crear mi tienda →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL SUBIR PRODUCTO ─────────────────────────────────────────────────────
function ModalProducto({ tiendaId, onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    nombre: '', precio: '', descripcion: '',
    plagasQueControla: '', uso: '',
    cultivos: [], disponible: true,
  });

  const handleFoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFoto(reader.result); setFotoPreview(reader.result); };
    reader.readAsDataURL(file);
  };

  const compress = (dataUrl) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const MAX = 600; let w = img.width, h = img.height;
      if (w > MAX) { h = h * MAX / w; w = MAX; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });

  // Cuando el proveedor escribe el nombre, la IA infiere el resto
  const inferirConIA = async (nombre) => {
    if (nombre.length < 4) return;
    setAnalizando(true);
    try {
      const res = await invokeGemini({
        prompt: `Eres experto en agroquímicos peruanos. Para el producto "${nombre}", infiere:
- Para qué sirve (descripción breve)
- Qué plagas o enfermedades controla
- Modo de uso básico
- Para qué cultivos es compatible (de esta lista: Papa, Palta, Arándano)
Responde en español simple para agricultores.`,
        file_urls: foto ? [await compress(foto)] : [],
        response_json_schema: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            plagasQueControla: { type: 'string' },
            uso: { type: 'string' },
            cultivosCompatibles: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      const ids = CULTIVOS.filter(c =>
        res.cultivosCompatibles?.some(cv =>
          cv.toLowerCase().includes(c.nombre.toLowerCase()) ||
          c.nombre.toLowerCase().includes(cv.toLowerCase())
        )
      ).map(c => c.id);
      setForm(prev => ({
        ...prev,
        descripcion: res.descripcion || prev.descripcion,
        plagasQueControla: res.plagasQueControla || prev.plagasQueControla,
        uso: res.uso || prev.uso,
        cultivos: ids.length > 0 ? ids : prev.cultivos,
      }));
    } catch (e) { /* silencioso */ }
    setAnalizando(false);
  };

  const guardar = async () => {
    if (!form.nombre || !form.precio) { alert('Nombre y precio son obligatorios'); return; }
    setGuardando(true);
    try {
      await addDoc(collection(db, 'productos'), {
        ...form,
        foto: foto || null,
        tiendaId,
        createdAt: new Date().toISOString(),
      });
      onSuccess();
    } catch (e) { alert('Error al guardar'); }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Agregar Producto</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Foto opcional */}
        <div className="mb-4">
          {fotoPreview
            ? <div className="relative">
                <img src={fotoPreview} alt="" className="w-full h-32 object-cover rounded-2xl" />
                <button onClick={() => { setFoto(null); setFotoPreview(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center">×</button>
              </div>
            : <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-primary transition-colors">
                <Camera size={28} className="mx-auto text-gray-300 mb-1" />
                <p className="text-xs text-gray-500">Foto del producto (opcional)</p>
              </div>
          }
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
        </div>

        <div className="space-y-3">
          {/* Nombre — dispara IA */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre del producto *</label>
            <div className="relative">
              <input value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                onBlur={e => inferirConIA(e.target.value)}
                placeholder="Ej: Mancozeb 80% WP"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary pr-10" />
              {analizando && <Loader2 size={16} className="animate-spin text-primary absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>
            {!analizando && form.nombre.length >= 4 && !form.descripcion && (
              <p className="text-xs text-primary mt-1">💡 Escribe el nombre completo y la IA completará los detalles</p>
            )}
          </div>

          {/* Precio */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Precio (S/) *</label>
            <input type="number" step="0.50" value={form.precio}
              onChange={e => setForm({ ...form, precio: e.target.value })}
              placeholder="Ej: 25.00"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Campos completados por IA (editables) */}
          {[
            { key: 'descripcion',       label: 'Descripción',         ph: 'La IA lo completará automáticamente', area: true },
            { key: 'plagasQueControla', label: 'Plagas que controla', ph: 'Ej: Rancha, Mildiu, Botrytis' },
            { key: 'uso',               label: 'Modo de uso',         ph: 'Ej: 2g/litro cada 7 días' },
          ].map(({ key, label, ph, area }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              {area
                ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={ph} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
                : <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={ph}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              }
            </div>
          ))}

          {/* Cultivos */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Cultivos compatibles</label>
            <div className="flex gap-2">
              {CULTIVOS.map(c => (
                <button key={c.id}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    cultivos: prev.cultivos.includes(c.id)
                      ? prev.cultivos.filter(x => x !== c.id)
                      : [...prev.cultivos, c.id]
                  }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    form.cultivos.includes(c.id) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {c.emoji} {c.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="disp" checked={form.disponible}
              onChange={e => setForm({ ...form, disponible: e.target.checked })} />
            <label htmlFor="disp" className="text-sm text-gray-600">Disponible ahora</label>
          </div>

          <button onClick={guardar} disabled={guardando || analizando}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {guardando ? 'Publicando...' : 'Publicar producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PANEL PROVEEDOR ──────────────────────────────────────────────────────────
function PanelProveedor({ tienda, onVolver }) {
  const [tab, setTab] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [modalProducto, setModalProducto] = useState(false);

  useEffect(() => { cargarProductos(); }, []);

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), where('tiendaId', '==', tienda.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingP(false);
    });
    return () => unsub();
  }, [tienda.id]);

  const cargarProductos = async () => {
    const snap = await getDocs(query(collection(db, 'productos'), where('tiendaId', '==', tienda.id)));
    setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const totalVentas = pedidos.filter(p => p.estado === 'entregado').reduce((s, p) => s + (p.total || 0), 0);
  const deudaTotal  = pedidos.filter(p => p.estado === 'entregado').reduce((s, p) => s + (p.comision || 0), 0);

  const cambiarEstado = (id, estado) => updateDoc(doc(db, 'pedidos', id), { estado });

  const asignarMotorizado = async (pedido) => {
    const nombre = prompt('Nombre del motorizado:');
    const cel    = prompt('Celular del motorizado:');
    if (!nombre || !cel) return;
    await updateDoc(doc(db, 'pedidos', pedido.id), {
      estado: 'en_camino', motorizadoNombre: nombre, motorizadoCelular: cel,
    });
    const msg = encodeURIComponent(
      `🏍️ *DELIVERY AGRILUX*\n📦 ${pedido.productoNombre}\n🔢 Cant: ${pedido.cantidad}\n` +
      `📍 ${pedido.direccionEntrega}\n📌 ${pedido.referencia || ''}\n` +
      `👤 ${pedido.agricultorNombre}\n📱 ${pedido.agricultorCelular}`
    );
    window.open(`https://wa.me/51${cel.replace(/\D/g,'')}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <button onClick={onVolver} className="text-white/70 text-sm mb-3">← Volver</button>
        <h1 className="text-2xl font-display font-bold">{tienda.empresa}</h1>
        <p className="text-white/70 text-sm">📍 {tienda.ubicacion}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Ventas totales</p>
            <p className="text-2xl font-bold text-primary">S/ {totalVentas.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Deuda Agrilux (5%)</p>
            <p className="text-2xl font-bold text-red-500">S/ {deudaTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[['productos','🛡️ Productos'],['pedidos','📦 Pedidos']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>{label}</button>
          ))}
        </div>

        {/* Productos */}
        {tab === 'productos' && (
          <div className="space-y-3">
            <button onClick={() => setModalProducto(true)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-2xl">
              <Plus size={18} /> Agregar producto
            </button>
            {productos.length === 0
              ? <div className="bg-white rounded-2xl p-8 text-center"><p className="text-gray-400 text-sm">Aún no has subido productos</p></div>
              : productos.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  {p.foto && <img src={p.foto} alt="" className="w-full h-28 object-cover rounded-xl mb-3" />}
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-gray-800">{p.nombre}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {p.disponible ? 'Disponible' : 'Sin stock'}
                    </span>
                  </div>
                  {p.descripcion && <p className="text-xs text-gray-500 mt-1">{p.descripcion}</p>}
                  {p.plagasQueControla && <p className="text-xs text-red-500 mt-1">🐛 {p.plagasQueControla}</p>}
                  <p className="text-base font-bold text-primary mt-2">S/ {p.precio}</p>
                </div>
              ))
            }
            {modalProducto && (
              <ModalProducto tiendaId={tienda.id}
                onClose={() => setModalProducto(false)}
                onSuccess={() => { setModalProducto(false); cargarProductos(); }} />
            )}
          </div>
        )}

        {/* Pedidos */}
        {tab === 'pedidos' && (
          <div className="space-y-3">
            {loadingP
              ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
              : pedidos.length === 0
                ? <div className="bg-white rounded-2xl p-8 text-center"><Package size={36} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">Sin pedidos aún</p></div>
                : pedidos.map(p => {
                  const est = ESTADOS[p.estado] || ESTADOS.pendiente;
                  return (
                    <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm text-gray-800">{p.productoNombre}</p>
                          <p className="text-xs text-gray-500">{p.agricultorNombre} · {p.agricultorCelular}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${est.color}`}>{est.icon} {est.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">📍 {p.direccionEntrega}</p>
                      {p.referencia && <p className="text-xs text-gray-400 mb-2">📌 {p.referencia}</p>}
                      <div className="flex justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-primary">S/ {p.total?.toFixed(2)}</p>
                          <p className="text-xs text-red-400">Comisión: S/ {p.comision?.toFixed(2)}</p>
                        </div>
                        <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('es-PE')}</p>
                      </div>
                      {p.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button onClick={() => cambiarEstado(p.id, 'confirmado')} className="flex-1 bg-blue-500 text-white text-xs font-bold py-2 rounded-xl">✅ Confirmar</button>
                          <button onClick={() => cambiarEstado(p.id, 'cancelado')} className="flex-1 bg-red-100 text-red-600 text-xs font-bold py-2 rounded-xl">❌ Cancelar</button>
                        </div>
                      )}
                      {p.estado === 'confirmado' && (
                        <button onClick={() => asignarMotorizado(p)} className="w-full bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
                          <Truck size={14} /> Asignar motorizado
                        </button>
                      )}
                      {p.estado === 'en_camino' && (
                        <div className="space-y-2">
                          <p className="text-xs text-purple-600">🏍️ {p.motorizadoNombre} · {p.motorizadoCelular}</p>
                          <button onClick={() => cambiarEstado(p.id, 'entregado')} className="w-full bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl">📦 Marcar entregado</button>
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL PEDIDO ─────────────────────────────────────────────────────────────
function ModalPedido({ producto, tienda, user, onClose, onSuccess }) {
  const [cantidad, setCantidad] = useState('1');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [loading, setLoading] = useState(false);

  const precioUnit = parseFloat(producto.precio) || 0;
  const total = (parseFloat(cantidad) || 0) * precioUnit;

  const confirmar = async () => {
    if (!direccion) { alert('Ingresa la dirección exacta de entrega'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'pedidos'), {
        productoId: producto.id,
        productoNombre: producto.nombre,
        tiendaId: tienda.id,
        tiendaEmpresa: tienda.empresa,
        tiendaCelular: tienda.celular || '',
        agricultorId: user.uid,
        agricultorNombre: user.nombre,
        agricultorEmail: user.email,
        agricultorCelular: user.celular || '',
        cantidad: parseFloat(cantidad),
        precioUnitario: precioUnit,
        total,
        comision: total * COMISION,
        direccionEntrega: direccion,
        referencia,
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      });
      onSuccess();
    } catch (e) { alert('Error al crear pedido'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">Hacer Pedido</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="bg-gray-50 rounded-2xl p-3 mb-4">
          <p className="font-bold text-gray-800">{producto.nombre}</p>
          <p className="text-xs text-gray-500">{tienda.empresa}</p>
          {precioUnit > 0 && <p className="text-sm font-bold text-primary mt-1">S/ {precioUnit.toFixed(2)} c/u</p>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Cantidad</label>
            <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">📍 Dirección exacta de entrega *</label>
            <textarea value={direccion} onChange={e => setDireccion(e.target.value)} rows={3}
              placeholder="Sector, nombre de parcela, distrito, provincia, referencias..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Referencia adicional</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Casa azul al lado del río"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          {precioUnit > 0 && total > 0 && (
            <div className="bg-primary/5 rounded-xl p-3 flex justify-between">
              <span className="text-sm text-gray-500">Total estimado</span>
              <span className="font-bold text-primary">S/ {total.toFixed(2)}</span>
            </div>
          )}
          <button onClick={confirmar} disabled={loading || !direccion}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50">
            {loading ? 'Enviando...' : '📦 Confirmar Pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MIS PEDIDOS AGRICULTOR ───────────────────────────────────────────────────
function MisPedidos({ userId, onVolver }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), where('agricultorId', '==', userId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <button onClick={onVolver} className="text-white/70 text-sm mb-3">← Volver</button>
        <h1 className="text-2xl font-display font-bold">Mis Pedidos</h1>
      </div>
      <div className="px-4 py-4 space-y-3">
        {loading
          ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          : pedidos.length === 0
            ? <div className="bg-white rounded-2xl p-8 text-center"><Package size={36} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">Aún no tienes pedidos</p></div>
            : pedidos.map(p => {
              const est = ESTADOS[p.estado] || ESTADOS.pendiente;
              return (
                <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{p.productoNombre}</p>
                      <p className="text-xs text-gray-500">{p.tiendaEmpresa}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${est.color}`}>{est.icon} {est.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">📍 {p.direccionEntrega}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-primary">S/ {p.total?.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('es-PE')}</p>
                  </div>
                  {p.estado === 'en_camino' && p.motorizadoNombre && (
                    <div className="mt-2 bg-purple-50 rounded-xl p-2.5 flex items-center gap-2">
                      <Truck size={14} className="text-purple-600" />
                      <div>
                        <p className="text-xs font-bold text-purple-700">🏍️ {p.motorizadoNombre} en camino</p>
                        {p.motorizadoCelular && (
                          <a href={`https://wa.me/51${p.motorizadoCelular.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                            className="text-xs text-purple-600 underline">Contactar</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── VISTA TIENDA ─────────────────────────────────────────────────────────────
function VistaTienda({ tienda, plagaBuscada, user, onVolver }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPedido, setModalPedido] = useState(null);
  const [pedidoOk, setPedidoOk] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, 'productos'), where('tiendaId', '==', tienda.id)))
      .then(snap => { setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [tienda.id]);

  const ordenados = plagaBuscada
    ? [...productos.filter(p => p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase())),
       ...productos.filter(p => !p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase()))]
    : productos;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <button onClick={onVolver} className="text-white/70 text-sm mb-3">← Volver</button>
        <h1 className="text-2xl font-display font-bold">{tienda.empresa}</h1>
        <p className="text-white/70 text-sm">📍 {tienda.ubicacion}</p>
      </div>

      {pedidoOk && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-700 text-sm">¡Pedido registrado!</p>
            <p className="text-xs text-green-600">Puedes ver el estado en "Mis Pedidos"</p>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        {loading
          ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          : ordenados.length === 0
            ? <div className="bg-white rounded-2xl p-8 text-center"><p className="text-gray-400 text-sm">Esta tienda aún no tiene productos</p></div>
            : ordenados.map(p => {
              const esRelevante = plagaBuscada && p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase());
              return (
                <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm ${esRelevante ? 'border-2 border-primary' : ''}`}>
                  {esRelevante && (
                    <div className="bg-primary/10 rounded-xl px-3 py-1.5 mb-3 flex items-center gap-2">
                      <CheckCircle size={14} className="text-primary" />
                      <p className="text-xs font-bold text-primary">Recomendado para {plagaBuscada}</p>
                    </div>
                  )}
                  {p.foto && <img src={p.foto} alt={p.nombre} className="w-full h-36 object-cover rounded-xl mb-3" />}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800 flex-1">{p.nombre}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 ${p.disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {p.disponible ? 'Disponible' : 'Sin stock'}
                    </span>
                  </div>
                  {p.descripcion && <p className="text-xs text-gray-500 mb-2">{p.descripcion}</p>}
                  {p.plagasQueControla && (
                    <div className="bg-red-50 rounded-xl p-2.5 mb-2">
                      <p className="text-xs font-semibold text-red-600">🐛 {p.plagasQueControla}</p>
                    </div>
                  )}
                  {p.uso && <div className="bg-gray-50 rounded-xl p-2.5 mb-2"><p className="text-xs text-gray-600">💊 {p.uso}</p></div>}
                  {p.cultivos?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.cultivos.map(cId => { const c = CULTIVOS.find(x => x.id === cId); return c ? <span key={cId} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c.emoji} {c.nombre}</span> : null; })}
                    </div>
                  )}
                  {p.precio && <p className="text-base font-bold text-primary mb-3">S/ {p.precio}</p>}
                  {p.disponible && (
                    <button onClick={() => setModalPedido(p)}
                      className="w-full bg-primary text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                      <Package size={16} /> Pedir con delivery
                    </button>
                  )}
                </div>
              );
            })
        }
      </div>

      {modalPedido && (
        <ModalPedido producto={modalPedido} tienda={tienda} user={user}
          onClose={() => setModalPedido(null)}
          onSuccess={() => { setModalPedido(null); setPedidoOk(true); }} />
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Mercado({ plagaBuscada = '' }) {
  const { user } = useAuth();
  const [tiendas, setTiendas] = useState([]);
  const [miTienda, setMiTienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');
  // todos los estados antes de returns condicionales
  const [vista, setVista] = useState('lista'); // lista | panel | pedidos | tienda
  const [tiendaActiva, setTiendaActiva] = useState(null);

  useEffect(() => { cargar(); }, [user]);

  const cargar = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // Cargar tienda propia si es proveedor
      const miTiendaSnap = await getDoc(doc(db, 'tiendas', user.uid));
      if (miTiendaSnap.exists()) setMiTienda({ id: miTiendaSnap.id, ...miTiendaSnap.data() });

      // Cargar todas las tiendas
      const snap = await getDocs(collection(db, 'tiendas'));
      setTiendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setTiendas([]); }
    setLoading(false);
  };

  const tiendasFiltradas = tiendas.filter(t =>
    (!busqueda || t.empresa?.toLowerCase().includes(busqueda.toLowerCase())) &&
    (!filtroUbicacion || t.ubicacion?.toLowerCase().includes(filtroUbicacion.toLowerCase()))
  );

  // Views condicionales DESPUÉS de todos los hooks
  if (vista === 'setup') {
    return <SetupTienda user={user} onCreada={(t) => { setMiTienda(t); setVista('panel'); }} />;
  }
  if (vista === 'panel' && miTienda) {
    return <PanelProveedor tienda={miTienda} onVolver={() => setVista('lista')} />;
  }
  if (vista === 'pedidos') {
    return <MisPedidos userId={user.uid} onVolver={() => setVista('lista')} />;
  }
  if (vista === 'tienda' && tiendaActiva) {
    return <VistaTienda tienda={tiendaActiva} plagaBuscada={plagaBuscada} user={user} onVolver={() => { setVista('lista'); setTiendaActiva(null); }} />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">🛡️ Fungicidas</h1>
        <p className="text-white/70 text-sm mt-1">Marketplace con delivery a tu parcela</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {plagaBuscada && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-amber-700">🔍 Buscando productos para: {plagaBuscada}</p>
            <p className="text-xs text-amber-600">Los productos relevantes aparecen primero en cada tienda</p>
          </div>
        )}

        {/* Panel usuario */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-lg">
              {user?.nombre?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-800">{user?.nombre}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Botón según rol */}
            {miTienda ? (
              <button onClick={() => setVista('panel')}
                className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                <Store size={14} /> Mi tienda
              </button>
            ) : (
              <button onClick={() => setVista('setup')}
                className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                <Store size={14} /> Crear mi tienda
              </button>
            )}
            <button onClick={() => setVista('pedidos')}
              className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
              <Package size={14} /> Mis pedidos
            </button>
          </div>
        </div>

        {/* Soporte */}
        <a href={`https://wa.me/${WHATSAPP_SOPORTE}`} target="_blank" rel="noreferrer"
          className="block bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📞</span>
            <div>
              <p className="text-xs font-bold text-amber-700">¿Necesitas ayuda?</p>
              <p className="text-sm font-bold text-amber-600">935 211 605</p>
            </div>
          </div>
        </a>

        {/* Buscadores */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
          <span className="text-gray-400">🔍</span>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar tienda..."
            className="flex-1 text-sm focus:outline-none text-gray-700" />
        </div>
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
          <span className="text-gray-400">📍</span>
          <input value={filtroUbicacion} onChange={e => setFiltroUbicacion(e.target.value)} placeholder="Filtrar por ciudad..."
            className="flex-1 text-sm focus:outline-none text-gray-700" />
        </div>

        {/* Lista de tiendas */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Tiendas registradas ({tiendasFiltradas.length})
          </p>
          {loading
            ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
            : tiendasFiltradas.length === 0
              ? <div className="bg-white rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-3">🏪</p>
                  <p className="text-gray-700 font-semibold">Aún no hay tiendas</p>
                  <button onClick={() => setVista('setup')} className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                    Crear la primera tienda
                  </button>
                </div>
              : tiendasFiltradas.map(tienda => (
                <button key={tienda.id}
                  onClick={() => { setTiendaActiva(tienda); setVista('tienda'); }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 text-left border border-gray-100 hover:border-primary/30 active:scale-95 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏪</div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{tienda.empresa}</p>
                      <p className="text-xs text-gray-500">{tienda.nombre}</p>
                      <p className="text-xs text-gray-400">📍 {tienda.ubicacion}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </button>
              ))
          }
        </div>
      </div>
    </div>
  );
}
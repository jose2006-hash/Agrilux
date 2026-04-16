import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  collection, addDoc, getDocs, query, where,
  updateDoc, doc, onSnapshot, orderBy
} from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS } from '../lib/constants';
import { X, Store, Plus, Loader2, Camera, CheckCircle, Package, Truck, MapPin, Clock, ChevronRight } from 'lucide-react';
import { invokeGemini } from '../lib/gemini';

const WHATSAPP_SOPORTE = '51935211605';
const WHATSAPP_AGRILUX = '51935211605';
const COMISION_AGRILUX = 0.05;

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ─── ESTADOS DE PEDIDO ────────────────────────────────────────────────────────
const ESTADOS = {
  pendiente:   { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  confirmado:  { label: 'Confirmado',   color: 'bg-blue-100 text-blue-700',    icon: '✅' },
  en_camino:   { label: 'En camino',    color: 'bg-purple-100 text-purple-700', icon: '🏍️' },
  entregado:   { label: 'Entregado',    color: 'bg-green-100 text-green-700',  icon: '📦' },
  cancelado:   { label: 'Cancelado',    color: 'bg-red-100 text-red-600',      icon: '❌' },
};

// ─── MODAL REGISTRO ───────────────────────────────────────────────────────────
function ModalRegistro({ onClose, onSuccess }) {
  const [tipo, setTipo] = useState('');
  const [form, setForm] = useState({ nombre: '', apellido: '', celular: '', ubicacion: '', empresa: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { registerMarketUser } = useAuth();

  const handleSubmit = async () => {
    if (!form.nombre || !form.apellido || !form.celular || !form.ubicacion) {
      setError('Completa todos los campos obligatorios'); return;
    }
    if (tipo === 'proveedor' && !form.empresa) {
      setError('Ingresa el nombre de tu empresa'); return;
    }
    setLoading(true); setError('');
    try {
      const code = generateCode();
      const user = await registerMarketUser({ ...form, tipo, codigo: code });
      // Enviar código por WhatsApp
      const msg = encodeURIComponent(
        `✅ *Bienvenido a AGRILUX Marketplace*\n\n` +
        `Hola ${form.nombre}, tu registro fue exitoso.\n\n` +
        `🔑 *Tu código de acceso:* ${code}\n\n` +
        `Guárdalo para ingresar a tu cuenta desde cualquier dispositivo.\n\n` +
        `¿Necesitas ayuda? Escríbenos al ${WHATSAPP_SOPORTE} 🌱`
      );
      window.open(`https://wa.me/51${form.celular.replace(/\D/g,'')}?text=${msg}`, '_blank');
      onSuccess(user);
    } catch (e) { setError('Error al registrar. Intenta de nuevo.'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Unirte al Marketplace</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {!tipo ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">¿Cómo deseas participar?</p>
            {[
              { t: 'agricultor', emoji: '👨‍🌾', label: 'Soy Agricultor', desc: 'Encuentra fungicidas y solicita delivery a tu parcela' },
              { t: 'proveedor',  emoji: '🏪', label: 'Soy Proveedor',  desc: 'Registra tu tienda, sube productos y gestiona pedidos' },
            ].map(({ t, emoji, label, desc }) => (
              <button key={t} onClick={() => setTipo(t)}
                className="w-full flex items-center gap-4 bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-left hover:border-primary transition-colors">
                <span className="text-3xl">{emoji}</span>
                <div><p className="font-bold text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setTipo('')} className="text-gray-400 text-sm mb-1">← Volver</button>
            {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</p>}
            {[
              { key: 'nombre',    label: 'Nombre *',              ph: 'Tu nombre' },
              { key: 'apellido',  label: 'Apellido *',             ph: 'Tu apellido' },
              { key: 'celular',   label: 'Celular (WhatsApp) *',   ph: '935211605', type: 'tel' },
              { key: 'ubicacion', label: 'Ciudad / Distrito *',    ph: 'Ej: Cutervo, Cajamarca' },
              ...(tipo === 'proveedor' ? [{ key: 'empresa', label: 'Nombre de empresa *', ph: 'Ej: Agroservicios SAC' }] : []),
            ].map(({ key, label, ph, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                <input type={type || 'text'} value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              </div>
            ))}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50 mt-2">
              {loading ? 'Registrando...' : 'Registrarme → (recibirás código por WhatsApp)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL LOGIN CON CÓDIGO ───────────────────────────────────────────────────
function ModalLogin({ onClose, onSuccess }) {
  const [celular, setCelular] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginMarketUser } = useAuth();

  const handleLogin = async () => {
    if (!celular || !codigo) { setError('Ingresa tu celular y código'); return; }
    setLoading(true); setError('');
    try {
      const user = await loginMarketUser(celular, codigo);
      onSuccess(user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Ingresar a mi cuenta</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Tu número de celular</label>
            <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="935211605" type="tel"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Código de acceso (recibido por WhatsApp)</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: ABC123"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary uppercase tracking-widest" />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            ¿No tienes código? Escríbenos al{' '}
            <a href={`https://wa.me/${WHATSAPP_SOPORTE}`} target="_blank" rel="noreferrer" className="text-primary font-semibold">935 211 605</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL HACER PEDIDO ───────────────────────────────────────────────────────
function ModalPedido({ producto, tienda, onClose, onSuccess }) {
  const { marketUser } = useAuth();
  const [cantidad, setCantidad] = useState('1');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [loading, setLoading] = useState(false);

  const precioUnit = parseFloat(producto.precio) || 0;
  const total = (parseFloat(cantidad) || 0) * precioUnit;
  const comision = total * COMISION_AGRILUX;

  const handlePedido = async () => {
    if (!direccion) { alert('Ingresa la dirección exacta de entrega'); return; }
    setLoading(true);
    try {
      const pedidoRef = await addDoc(collection(db, 'pedidos'), {
        productoId: producto.id,
        productoNombre: producto.nombre,
        tiendaId: tienda.id,
        tiendaEmpresa: tienda.empresa,
        tiendaCelular: tienda.celular,
        agricultorId: marketUser.id,
        agricultorNombre: `${marketUser.nombre} ${marketUser.apellido}`,
        agricultorCelular: marketUser.celular,
        cantidad: parseFloat(cantidad),
        precioUnitario: precioUnit,
        total,
        comisionAgrilux: comision,
        direccionEntrega: direccion,
        referencia,
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      });

      // Notificar al proveedor
      const msgProveedor = encodeURIComponent(
        `🛒 *NUEVO PEDIDO - AGRILUX*\n\n` +
        `📦 *Producto:* ${producto.nombre}\n` +
        `🔢 *Cantidad:* ${cantidad}\n` +
        `💰 *Total:* S/ ${total.toFixed(2)}\n` +
        `📊 *Comisión Agrilux (5%):* S/ ${comision.toFixed(2)}\n\n` +
        `👤 *Agricultor:* ${marketUser.nombre} ${marketUser.apellido}\n` +
        `📱 *Celular:* ${marketUser.celular}\n` +
        `📍 *Entrega en:* ${direccion}\n` +
        `📌 *Referencia:* ${referencia || 'Sin referencia'}\n\n` +
        `ID Pedido: ${pedidoRef.id}\n` +
        `Confirma el pedido en la app Agrilux.`
      );
      window.open(`https://wa.me/51${tienda.celular?.replace(/\D/g,'')}?text=${msgProveedor}`, '_blank');

      onSuccess();
    } catch (e) { alert('Error al crear pedido'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Hacer Pedido</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="bg-gray-50 rounded-2xl p-3 mb-4">
          <p className="font-bold text-gray-800">{producto.nombre}</p>
          <p className="text-xs text-gray-500">{tienda.empresa} · {tienda.ubicacion}</p>
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
            <textarea value={direccion} onChange={e => setDireccion(e.target.value)} rows={2}
              placeholder="Ej: Sector Alto Salabamba, parcela frente a la escuela, Cutervo, Cajamarca"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Referencia adicional (opcional)</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Casa de color azul, al lado del río"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          {precioUnit > 0 && parseFloat(cantidad) > 0 && (
            <div className="bg-primary/5 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">S/ {total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400">El pago se coordina directamente con el proveedor</p>
            </div>
          )}
          <button onClick={handlePedido} disabled={loading || !direccion}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50 text-base">
            {loading ? 'Enviando pedido...' : '📦 Confirmar Pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PANEL AGRICULTOR: MIS PEDIDOS ───────────────────────────────────────────
function MisPedidosAgricultor({ userId }) {
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

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mis Pedidos</p>
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Package size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 text-sm">Aún no tienes pedidos</p>
        </div>
      ) : pedidos.map(p => {
        const estado = ESTADOS[p.estado] || ESTADOS.pendiente;
        return (
          <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-gray-800 text-sm">{p.productoNombre}</p>
                <p className="text-xs text-gray-500">{p.tiendaEmpresa}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${estado.color}`}>
                {estado.icon} {estado.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">📍 {p.direccionEntrega}</p>
            {p.referencia && <p className="text-xs text-gray-400 mb-2">📌 {p.referencia}</p>}
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary">S/ {p.total?.toFixed(2)}</p>
              <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('es-PE')}</p>
            </div>
            {p.estado === 'en_camino' && (
              <div className="mt-3 bg-purple-50 rounded-xl p-3 flex items-center gap-2">
                <Truck size={18} className="text-purple-600" />
                <div>
                  <p className="text-xs font-bold text-purple-700">🏍️ Motorizado en camino</p>
                  {p.motorizadoNombre && <p className="text-xs text-purple-600">{p.motorizadoNombre}</p>}
                  {p.motorizadoCelular && (
                    <a href={`https://wa.me/51${p.motorizadoCelular?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      className="text-xs text-purple-700 font-semibold underline">Contactar motorizado</a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PANEL PROVEEDOR ──────────────────────────────────────────────────────────
function PanelProveedor({ tienda }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pedidos'); // pedidos | deudas
  const [modalProducto, setModalProducto] = useState(false);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), where('tiendaId', '==', tienda.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tienda.id]);

  useEffect(() => {
    const q = query(collection(db, 'productos'), where('tiendaId', '==', tienda.id));
    getDocs(q).then(snap => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [tienda.id]);

  const totalVentas = pedidos.filter(p => p.estado === 'entregado').reduce((s, p) => s + (p.total || 0), 0);
  const deudaTotal = pedidos.filter(p => p.estado === 'entregado').reduce((s, p) => s + (p.comisionAgrilux || 0), 0);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    await updateDoc(doc(db, 'pedidos', pedidoId), { estado: nuevoEstado });
  };

  const asignarMotorizado = async (pedidoId) => {
    const nombre = prompt('Nombre del motorizado:');
    const cel = prompt('Celular del motorizado:');
    if (!nombre || !cel) return;
    await updateDoc(doc(db, 'pedidos', pedidoId), {
      estado: 'en_camino',
      motorizadoNombre: nombre,
      motorizadoCelular: cel,
    });
    // Notificar al agricultor y al motorizado
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      const msgMotorizado = encodeURIComponent(
        `🏍️ *NUEVO DELIVERY - AGRILUX*\n\n` +
        `📦 *Producto:* ${pedido.productoNombre}\n` +
        `🔢 *Cantidad:* ${pedido.cantidad}\n` +
        `📍 *Entregar en:* ${pedido.direccionEntrega}\n` +
        `📌 *Referencia:* ${pedido.referencia || 'Sin referencia'}\n` +
        `👤 *Cliente:* ${pedido.agricultorNombre}\n` +
        `📱 *Celular cliente:* ${pedido.agricultorCelular}`
      );
      window.open(`https://wa.me/51${cel.replace(/\D/g,'')}?text=${msgMotorizado}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total ventas</p>
          <p className="text-2xl font-bold text-primary">S/ {totalVentas.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Deuda Agrilux (5%)</p>
          <p className="text-2xl font-bold text-red-500">S/ {deudaTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['pedidos', '📦 Pedidos'], ['productos', '🛡️ Mis Productos']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && (
        <div className="space-y-3">
          {loading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          : pedidos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Package size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm">Aún no tienes pedidos</p>
            </div>
          ) : pedidos.map(p => {
            const estado = ESTADOS[p.estado] || ESTADOS.pendiente;
            return (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{p.productoNombre}</p>
                    <p className="text-xs text-gray-500">{p.agricultorNombre} · {p.agricultorCelular}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${estado.color}`}>
                    {estado.icon} {estado.label}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-1">📍 {p.direccionEntrega}</p>
                {p.referencia && <p className="text-xs text-gray-400 mb-2">📌 {p.referencia}</p>}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-primary">S/ {p.total?.toFixed(2)}</p>
                    <p className="text-xs text-red-400">Comisión: S/ {p.comisionAgrilux?.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('es-PE')}</p>
                </div>
                {/* Acciones según estado */}
                {p.estado === 'pendiente' && (
                  <div className="flex gap-2">
                    <button onClick={() => cambiarEstado(p.id, 'confirmado')}
                      className="flex-1 bg-blue-500 text-white text-xs font-bold py-2 rounded-xl">
                      ✅ Confirmar
                    </button>
                    <button onClick={() => cambiarEstado(p.id, 'cancelado')}
                      className="flex-1 bg-red-100 text-red-600 text-xs font-bold py-2 rounded-xl">
                      ❌ Cancelar
                    </button>
                  </div>
                )}
                {p.estado === 'confirmado' && (
                  <button onClick={() => asignarMotorizado(p.id)}
                    className="w-full bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
                    <Truck size={14} /> Asignar motorizado y enviar
                  </button>
                )}
                {p.estado === 'en_camino' && (
                  <button onClick={() => cambiarEstado(p.id, 'entregado')}
                    className="w-full bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl">
                    📦 Marcar como entregado
                  </button>
                )}
                {p.motorizadoNombre && (
                  <p className="text-xs text-purple-600 mt-2">🏍️ {p.motorizadoNombre} · {p.motorizadoCelular}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'productos' && (
        <div className="space-y-3">
          <button onClick={() => setModalProducto(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-2xl">
            <Plus size={18} /> Agregar producto con IA
          </button>
          {productos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
              {p.foto && <img src={p.foto} alt="" className="w-full h-28 object-cover rounded-xl mb-3" />}
              <p className="font-bold text-gray-800">{p.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.descripcion}</p>
              {p.precio && <p className="text-sm font-bold text-primary mt-1">S/ {p.precio}</p>}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-2 inline-block ${p.disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {p.disponible ? 'Disponible' : 'Sin stock'}
              </span>
            </div>
          ))}
          {modalProducto && (
            <ModalSubirProducto tiendaId={tienda.id} proveedorUbicacion={tienda.ubicacion}
              onClose={() => setModalProducto(false)}
              onSuccess={() => {
                setModalProducto(false);
                getDocs(query(collection(db, 'productos'), where('tiendaId', '==', tienda.id)))
                  .then(snap => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
              }} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── MODAL SUBIR PRODUCTO CON IA ──────────────────────────────────────────────
function ModalSubirProducto({ tiendaId, proveedorUbicacion, onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [analizado, setAnalizado] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', uso: '', plagasQueControla: '', cultivos: [], precio: '', disponible: true });
  const [guardando, setGuardando] = useState(false);

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

  const analizar = async () => {
    if (!foto) { alert('Sube una foto primero'); return; }
    setAnalizando(true);
    try {
      const compressed = await compress(foto);
      const res = await invokeGemini({
        prompt: `Analiza esta imagen de un producto fungicida/pesticida agrícola. Lee el etiquetado visible. Responde en español simple para agricultores peruanos.`,
        file_urls: [compressed],
        response_json_schema: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            uso: { type: 'string' },
            plagasQueControla: { type: 'string' },
            cultivosCompatibles: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      const ids = CULTIVOS.filter(c => res.cultivosCompatibles?.some(cv =>
        cv.toLowerCase().includes(c.nombre.toLowerCase()) || c.nombre.toLowerCase().includes(cv.toLowerCase())
      )).map(c => c.id);
      setForm(prev => ({ ...prev, nombre: res.nombre || '', descripcion: res.descripcion || '', uso: res.uso || '', plagasQueControla: res.plagasQueControla || '', cultivos: ids }));
      setAnalizado(true);
    } catch (e) { alert('Error al analizar. Completa manualmente.'); }
    setAnalizando(false);
  };

  const guardar = async () => {
    if (!form.nombre) { alert('Ingresa el nombre del producto'); return; }
    setGuardando(true);
    try {
      await addDoc(collection(db, 'productos'), { ...form, foto, tiendaId, ubicacion: proveedorUbicacion, createdAt: new Date().toISOString() });
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
        <div className="mb-4">
          {fotoPreview ? (
            <div className="relative">
              <img src={fotoPreview} alt="" className="w-full h-36 object-cover rounded-2xl" />
              <button onClick={() => { setFoto(null); setFotoPreview(null); setAnalizado(false); }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center">×</button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-primary">
              <Camera size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 font-semibold">Foto del empaque o etiqueta</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
        </div>
        {foto && !analizado && (
          <button onClick={analizar} disabled={analizando}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-2 disabled:opacity-50">
            {analizando ? <><Loader2 size={18} className="animate-spin" /> Analizando...</> : '🤖 Analizar con IA'}
          </button>
        )}
        {analizado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 font-semibold">¡IA completó los datos! Revisa y ajusta.</p>
          </div>
        )}
        <div className="space-y-3">
          {[
            { key: 'nombre', label: 'Nombre *', ph: 'Ej: Mancozeb 80%' },
            { key: 'descripcion', label: 'Descripción', ph: '¿Para qué sirve?', area: true },
            { key: 'plagasQueControla', label: 'Plagas que controla', ph: 'Ej: Rancha, Mildiu' },
            { key: 'uso', label: 'Modo de uso', ph: 'Ej: 2g/litro cada 7 días' },
            { key: 'precio', label: 'Precio (S/)', ph: '25.00', type: 'number' },
          ].map(({ key, label, ph, area, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              {area
                ? <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
                : <input type={type || 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              }
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Cultivos compatibles</label>
            <div className="flex flex-wrap gap-1.5">
              {CULTIVOS.map(c => (
                <button key={c.id} onClick={() => setForm(prev => ({ ...prev, cultivos: prev.cultivos.includes(c.id) ? prev.cultivos.filter(x => x !== c.id) : [...prev.cultivos, c.id] }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${form.cultivos.includes(c.id) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {c.emoji} {c.nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="disp" checked={form.disponible} onChange={e => setForm({ ...form, disponible: e.target.checked })} />
            <label htmlFor="disp" className="text-sm text-gray-600">Disponible ahora</label>
          </div>
          <button onClick={guardar} disabled={guardando}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {guardando ? 'Publicando...' : 'Publicar producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA TIENDA ─────────────────────────────────────────────────────────────
function VistaTienda({ tienda, plagaBuscada, onVolver }) {
  const { marketUser } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPedido, setModalPedido] = useState(null);
  const [pedidoOk, setPedidoOk] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, 'productos'), where('tiendaId', '==', tienda.id)))
      .then(snap => { setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [tienda.id]);

  const productosMostrados = plagaBuscada
    ? [...productos.filter(p => p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase()) || p.descripcion?.toLowerCase().includes(plagaBuscada.toLowerCase())),
       ...productos.filter(p => !(p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase()) || p.descripcion?.toLowerCase().includes(plagaBuscada.toLowerCase())))]
    : productos;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <button onClick={onVolver} className="text-white/70 text-sm mb-3">← Volver</button>
        <h1 className="text-2xl font-display font-bold">{tienda.empresa}</h1>
        <p className="text-white/70 text-sm">📍 {tienda.ubicacion} · 📱 {tienda.celular}</p>
      </div>

      {pedidoOk && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <div>
            <p className="font-bold text-green-700 text-sm">¡Pedido enviado!</p>
            <p className="text-xs text-green-600">El proveedor recibirá una notificación por WhatsApp</p>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        {loading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
        : productosMostrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">Esta tienda aún no tiene productos</p>
          </div>
        ) : productosMostrados.map(p => {
          const esRelevante = plagaBuscada && (
            p.plagasQueControla?.toLowerCase().includes(plagaBuscada.toLowerCase()) ||
            p.descripcion?.toLowerCase().includes(plagaBuscada.toLowerCase())
          );
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
              <p className="text-xs text-gray-500 mb-2">{p.descripcion}</p>
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
                <button onClick={() => { if (!marketUser) { alert('Regístrate o inicia sesión para hacer un pedido'); return; } setModalPedido(p); }}
                  className="w-full bg-primary text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Package size={16} /> Pedir con delivery
                </button>
              )}
            </div>
          );
        })}
      </div>

      {modalPedido && (
        <ModalPedido producto={modalPedido} tienda={tienda}
          onClose={() => setModalPedido(null)}
          onSuccess={() => { setModalPedido(null); setPedidoOk(true); }} />
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Mercado({ plagaBuscada = '' }) {
  const { marketUser } = useAuth();
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalRegistro, setModalRegistro] = useState(false);
  const [modalLogin, setModalLogin] = useState(false);
  const [tiendaActiva, setTiendaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');
  const [viendoPanel, setViendoPanel] = useState(false);

  useEffect(() => { cargarTiendas(); }, []);

  const cargarTiendas = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'usuariosMercado'), where('tipo', '==', 'proveedor')));
      setTiendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setTiendas([]); }
    setLoading(false);
  };

  const tiendasFiltradas = tiendas.filter(t => {
    const porNombre = !busqueda || t.empresa?.toLowerCase().includes(busqueda.toLowerCase());
    const porUbicacion = !filtroUbicacion || t.ubicacion?.toLowerCase().includes(filtroUbicacion.toLowerCase());
    return porNombre && porUbicacion;
  });

  // Panel proveedor
  const miTienda = tiendas.find(t => t.userId === marketUser?.id);
  if (viendoPanel && marketUser?.tipo === 'proveedor' && miTienda) {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-primary text-white px-6 pt-12 pb-6">
          <button onClick={() => setViendoPanel(false)} className="text-white/70 text-sm mb-3">← Volver</button>
          <h1 className="text-2xl font-display font-bold">{miTienda.empresa}</h1>
          <p className="text-white/70 text-sm">Panel de proveedor</p>
        </div>
        <div className="px-4 py-4"><PanelProveedor tienda={miTienda} /></div>
      </div>
    );
  }

  if (tiendaActiva) return <VistaTienda tienda={tiendaActiva} plagaBuscada={plagaBuscada} onVolver={() => setTiendaActiva(null)} />;

  // Mis pedidos agricultor
  const [verPedidos, setVerPedidos] = useState(false);
  if (verPedidos && marketUser?.tipo === 'agricultor') {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-primary text-white px-6 pt-12 pb-6">
          <button onClick={() => setVerPedidos(false)} className="text-white/70 text-sm mb-3">← Volver</button>
          <h1 className="text-2xl font-display font-bold">Mis Pedidos</h1>
        </div>
        <div className="px-4 py-4"><MisPedidosAgricultor userId={marketUser.id} /></div>
      </div>
    );
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
            <p className="text-xs font-bold text-amber-700">🔍 Buscando para: {plagaBuscada}</p>
            <p className="text-xs text-amber-600">Entra a cada tienda para ver productos específicos</p>
          </div>
        )}

        {/* Usuario */}
        {marketUser ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                {marketUser.nombre?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-800">{marketUser.nombre} {marketUser.apellido}</p>
                <p className="text-xs text-gray-500 capitalize">{marketUser.tipo} · {marketUser.ubicacion}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {marketUser.tipo === 'proveedor' && miTienda && (
                <button onClick={() => setViendoPanel(true)}
                  className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                  <Package size={14} /> Mi panel
                </button>
              )}
              {marketUser.tipo === 'agricultor' && (
                <button onClick={() => setVerPedidos(true)}
                  className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                  <Package size={14} /> Mis pedidos
                </button>
              )}
              <button onClick={() => { localStorage.removeItem('agrilux_market_user'); window.location.reload(); }}
                className="px-4 bg-gray-100 text-gray-600 text-xs font-bold py-2.5 rounded-xl">
                Salir
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setModalRegistro(true)}
              className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1">
              <Store size={16} /> Registrarme
            </button>
            <button onClick={() => setModalLogin(true)}
              className="flex-1 bg-white border border-primary text-primary font-bold py-3 rounded-2xl text-sm">
              Tengo código
            </button>
          </div>
        )}

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

        {/* Tiendas */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Tiendas registradas ({tiendasFiltradas.length})
          </p>
          {loading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          : tiendasFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🏪</p>
              <p className="text-gray-700 font-semibold">Aún no hay tiendas</p>
              <button onClick={() => setModalRegistro(true)}
                className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                Registrar mi tienda
              </button>
            </div>
          ) : tiendasFiltradas.map(tienda => (
            <button key={tienda.id} onClick={() => setTiendaActiva(tienda)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 text-left border border-gray-100 hover:border-primary/30 active:scale-95 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏪</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{tienda.empresa}</p>
                  <p className="text-xs text-gray-500">{tienda.nombre} {tienda.apellido}</p>
                  <p className="text-xs text-gray-400">📍 {tienda.ubicacion}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {modalRegistro && <ModalRegistro onClose={() => setModalRegistro(false)} onSuccess={() => { setModalRegistro(false); cargarTiendas(); }} />}
      {modalLogin && <ModalLogin onClose={() => setModalLogin(false)} onSuccess={() => { setModalLogin(false); cargarTiendas(); }} />}
    </div>
  );
}
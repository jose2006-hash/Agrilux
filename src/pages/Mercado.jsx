import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS } from '../lib/constants';
import { X, Store, Plus, Loader2 } from 'lucide-react';

const WHATSAPP_SOPORTE = '51935211605';

// ─── MODAL REGISTRO ──────────────────────────────────────────────────────────
function ModalRegistro({ onClose, onSuccess }) {
  const [tipo, setTipo] = useState(''); // agricultor | proveedor
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
      const user = await registerMarketUser({ ...form, tipo });
      onSuccess(user);
    } catch (e) { setError('Error al registrar. Intenta de nuevo.'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-gray-800">Unirte al Marketplace</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {!tipo ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">¿Cómo deseas participar?</p>
            <button onClick={() => setTipo('agricultor')}
              className="w-full flex items-center gap-4 bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-left hover:border-primary transition-colors">
              <span className="text-3xl">👨‍🌾</span>
              <div>
                <p className="font-bold text-gray-800">Soy Agricultor</p>
                <p className="text-xs text-gray-500">Explora tiendas y solicita cotizaciones de fungicidas</p>
              </div>
            </button>
            <button onClick={() => setTipo('proveedor')}
              className="w-full flex items-center gap-4 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-left hover:border-blue-500 transition-colors">
              <span className="text-3xl">🏪</span>
              <div>
                <p className="font-bold text-gray-800">Soy Proveedor de Insumos</p>
                <p className="text-xs text-gray-500">Registra tu tienda y sube tus productos disponibles</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setTipo('')} className="text-gray-400 text-sm mb-2">← Volver</button>
            <p className="text-sm font-semibold text-gray-600 mb-3">
              {tipo === 'agricultor' ? '👨‍🌾 Registro Agricultor' : '🏪 Registro Proveedor'}
            </p>
            {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</p>}
            {[
              { key: 'nombre', label: 'Nombre *', ph: 'Tu nombre' },
              { key: 'apellido', label: 'Apellido *', ph: 'Tu apellido' },
              { key: 'celular', label: 'Número de celular *', ph: 'Ej: 935211605', type: 'tel' },
              { key: 'ubicacion', label: 'Ubicación (ciudad/distrito) *', ph: 'Ej: Cutervo, Cajamarca' },
              ...(tipo === 'proveedor' ? [{ key: 'empresa', label: 'Nombre de empresa *', ph: 'Ej: Agroservicios SAC' }] : []),
            ].map(({ key, label, ph, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                <input
                  type={type || 'text'}
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={ph}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50 mt-2">
              {loading ? 'Registrando...' : 'Registrarme →'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              ¿Necesitas ayuda? Escríbenos al{' '}
              <a href={`https://wa.me/${WHATSAPP_SOPORTE}`} target="_blank" rel="noreferrer"
                className="text-primary font-semibold">935 211 605</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL SUBIR PRODUCTO (para proveedores) ──────────────────────────────────
function ModalSubirProducto({ tiendaId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nombre: '', descripcion: '', uso: '', cultivos: [], precio: '', disponible: true
  });
  const [loading, setLoading] = useState(false);

  const toggleCultivo = (id) =>
    setForm(prev => ({
      ...prev,
      cultivos: prev.cultivos.includes(id)
        ? prev.cultivos.filter(c => c !== id)
        : [...prev.cultivos, id]
    }));

  const handleSubmit = async () => {
    if (!form.nombre || !form.descripcion || form.cultivos.length === 0) {
      alert('Completa nombre, descripción y al menos un cultivo'); return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'productos'), {
        ...form,
        tiendaId,
        createdAt: new Date().toISOString(),
      });
      onSuccess();
    } catch (e) { alert('Error al guardar'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Agregar Producto</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre del producto *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Mancozeb 80% WP"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Descripción *</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="¿Para qué sirve este producto?" rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Modo de uso</label>
            <input value={form.uso} onChange={e => setForm({ ...form, uso: e.target.value })}
              placeholder="Ej: 2g/litro cada 7 días"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Cultivos compatibles *</label>
            <div className="flex flex-wrap gap-2">
              {CULTIVOS.map(c => (
                <button key={c.id} onClick={() => toggleCultivo(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    form.cultivos.includes(c.id) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {c.emoji} {c.nombre}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Precio referencial (S/)</label>
            <input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })}
              placeholder="Ej: 25.00"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="disp" checked={form.disponible}
              onChange={e => setForm({ ...form, disponible: e.target.checked })} />
            <label htmlFor="disp" className="text-sm text-gray-600">Disponible ahora</label>
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {loading ? 'Guardando...' : 'Agregar producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA TIENDA ─────────────────────────────────────────────────────────────
function VistaTienda({ tienda, onVolver }) {
  const { marketUser } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalProducto, setModalProducto] = useState(false);

  useEffect(() => { cargarProductos(); }, []);

  const cargarProductos = async () => {
    try {
      const q = query(collection(db, 'productos'), where('tiendaId', '==', tienda.id));
      const snap = await getDocs(q);
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setProductos([]); }
    setLoading(false);
  };

  const solicitarProducto = (producto) => {
    const msg = encodeURIComponent(
      `🛡️ *SOLICITUD DE FUNGICIDA - AGRILUX*\n\n` +
      `🏪 *Tienda:* ${tienda.empresa}\n` +
      `📦 *Producto:* ${producto.nombre}\n` +
      `📍 *Ubicación tienda:* ${tienda.ubicacion}\n\n` +
      `👤 *Mi nombre:* ${marketUser?.nombre || 'Agricultor'} ${marketUser?.apellido || ''}\n` +
      `📱 *Mi celular:* ${marketUser?.celular || 'No registrado'}\n\n` +
      `¿Cuál es el precio y cómo coordino la compra?`
    );
    window.open(`https://wa.me/51${tienda.celular?.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <button onClick={onVolver} className="text-white/70 text-sm mb-3">← Volver</button>
        <h1 className="text-2xl font-display font-bold">{tienda.empresa}</h1>
        <p className="text-white/70 text-sm">📍 {tienda.ubicacion}</p>
        <p className="text-white/70 text-sm">📱 {tienda.celular}</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {marketUser?.id === tienda.userId && (
          <button onClick={() => setModalProducto(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-2xl">
            <Plus size={18} /> Agregar producto
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : productos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-gray-500 text-sm">Esta tienda aún no tiene productos registrados</p>
          </div>
        ) : productos.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-gray-800">{p.nombre}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.disponible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {p.disponible ? 'Disponible' : 'Sin stock'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{p.descripcion}</p>
            {p.uso && (
              <div className="bg-gray-50 rounded-xl p-2.5 mb-2">
                <p className="text-xs text-gray-600">💊 {p.uso}</p>
              </div>
            )}
            {p.cultivos?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {p.cultivos.map(cId => {
                  const c = CULTIVOS.find(x => x.id === cId);
                  return c ? (
                    <span key={cId} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c.emoji} {c.nombre}</span>
                  ) : null;
                })}
              </div>
            )}
            {p.precio && <p className="text-sm font-bold text-primary mb-3">S/ {p.precio}</p>}
            {p.disponible && (
              <button onClick={() => solicitarProducto(p)}
                className="w-full bg-green-500 text-white text-sm font-bold py-2.5 rounded-xl">
                📲 Solicitar por WhatsApp
              </button>
            )}
          </div>
        ))}
      </div>

      {modalProducto && (
        <ModalSubirProducto
          tiendaId={tienda.id}
          onClose={() => setModalProducto(false)}
          onSuccess={() => { setModalProducto(false); cargarProductos(); }}
        />
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL MERCADO ─────────────────────────────────────────────────
export default function Mercado() {
  const { marketUser } = useAuth();
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalRegistro, setModalRegistro] = useState(false);
  const [tiendaActiva, setTiendaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');

  useEffect(() => { cargarTiendas(); }, []);

  const cargarTiendas = async () => {
    try {
      const q = query(collection(db, 'usuariosMercado'), where('tipo', '==', 'proveedor'));
      const snap = await getDocs(q);
      setTiendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setTiendas([]); }
    setLoading(false);
  };

  const tiiendasFiltradas = tiendas.filter(t => {
    const porNombre = !busqueda || t.empresa?.toLowerCase().includes(busqueda.toLowerCase());
    const porUbicacion = !filtroUbicacion || t.ubicacion?.toLowerCase().includes(filtroUbicacion.toLowerCase());
    return porNombre && porUbicacion;
  });

  if (tiendaActiva) return <VistaTienda tienda={tiendaActiva} onVolver={() => setTiendaActiva(null)} />;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">🛡️ Fungicidas</h1>
        <p className="text-white/70 text-sm mt-1">Marketplace de insumos certificados</p>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Usuario registrado o botón registro */}
        {marketUser ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-lg font-bold text-primary">
              {marketUser.nombre?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-800">{marketUser.nombre} {marketUser.apellido}</p>
              <p className="text-xs text-gray-500 capitalize">{marketUser.tipo} · {marketUser.ubicacion}</p>
            </div>
            {marketUser.tipo === 'proveedor' && (
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full">Proveedor</span>
            )}
          </div>
        ) : (
          <button onClick={() => setModalRegistro(true)}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2">
            <Store size={18} /> Unirme al Marketplace
          </button>
        )}

        {/* Info soporte */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-2xl">📞</span>
          <div>
            <p className="text-xs font-bold text-amber-700">¿Necesitas ayuda?</p>
            <a href={`https://wa.me/${WHATSAPP_SOPORTE}`} target="_blank" rel="noreferrer"
              className="text-sm font-bold text-amber-600">935 211 605</a>
          </div>
        </div>

        {/* Buscador */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
          <span className="text-gray-400">🔍</span>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar tienda..."
            className="flex-1 text-sm focus:outline-none text-gray-700" />
        </div>

        {/* Filtro ubicación */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
          <span className="text-gray-400">📍</span>
          <input value={filtroUbicacion} onChange={e => setFiltroUbicacion(e.target.value)}
            placeholder="Filtrar por ciudad..."
            className="flex-1 text-sm focus:outline-none text-gray-700" />
        </div>

        {/* Tiendas */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Tiendas registradas ({tiiendasFiltradas.length})
          </p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : tiiendasFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🏪</p>
              <p className="text-gray-700 font-semibold">Aún no hay tiendas registradas</p>
              <p className="text-gray-400 text-sm mt-1">Sé el primero en registrar tu tienda de fungicidas</p>
              <button onClick={() => setModalRegistro(true)}
                className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                Registrar mi tienda
              </button>
            </div>
          ) : tiiendasFiltradas.map(tienda => (
            <button key={tienda.id} onClick={() => setTiendaActiva(tienda)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 text-left border border-gray-100 hover:border-primary/30 transition-colors active:scale-95">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  🏪
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{tienda.empresa}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {tienda.nombre} {tienda.apellido}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">📍 {tienda.ubicacion}</p>
                </div>
                <span className="text-primary text-xs font-semibold">Ver →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {modalRegistro && (
        <ModalRegistro
          onClose={() => setModalRegistro(false)}
          onSuccess={() => { setModalRegistro(false); cargarTiendas(); }}
        />
      )}
    </div>
  );
}
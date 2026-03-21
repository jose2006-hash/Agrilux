import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, DollarSign, Lightbulb, ShoppingBag, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, orderBy, query, updateDoc, doc, increment } from 'firebase/firestore';

const CATEGORIAS = [
  { id: 'todas', label: 'Todas', emoji: '📋' },
  { id: 'plagas', label: 'Plagas', emoji: '🐛' },
  { id: 'enfermedades', label: 'Enfermedades', emoji: '🍂' },
  { id: 'precios', label: 'Precios', emoji: '💰' },
  { id: 'consejos', label: 'Consejos', emoji: '💡' },
  { id: 'venta', label: 'Venta', emoji: '🛒' },
  { id: 'general', label: 'General', emoji: '💬' },
];

function timeAgo(dateStr) {
  const diff = (new Date() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} días`;
}

export default function Comunidad() {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [categoria, setCategoria] = useState('todas');
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [form, setForm] = useState({ categoria: 'general', titulo: '', contenido: '', ubicacion: user?.ubicacion || '' });

  useEffect(() => { cargarMensajes(); }, []);

  const cargarMensajes = async () => {
    try {
      const q = query(collection(db, 'comunidad'), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setMensajes([]); }
    setLoading(false);
  };

  const publicar = async () => {
    if (!form.titulo || !form.contenido) { alert('Completa título y contenido'); return; }
    setPublicando(true);
    try {
      const docRef = await addDoc(collection(db, 'comunidad'), {
        ...form, autor: user?.nombre, autorId: user?.id,
        fecha: new Date().toISOString(), likes: 0,
      });
      setMensajes(prev => [{ id: docRef.id, ...form, autor: user?.nombre, fecha: new Date().toISOString(), likes: 0 }, ...prev]);
      setModal(false);
      setForm({ categoria: 'general', titulo: '', contenido: '', ubicacion: user?.ubicacion || '' });
    } catch (e) { alert('Error al publicar'); }
    setPublicando(false);
  };

  const darLike = async (id) => {
    try {
      await updateDoc(doc(db, 'comunidad', id), { likes: increment(1) });
      setMensajes(prev => prev.map(m => m.id === id ? { ...m, likes: (m.likes || 0) + 1 } : m));
    } catch (e) {}
  };

  const filtrados = categoria === 'todas' ? mensajes : mensajes.filter(m => m.categoria === categoria);

  const catColors = { plagas: 'bg-red-100 text-red-700', enfermedades: 'bg-orange-100 text-orange-700', precios: 'bg-yellow-100 text-yellow-700', consejos: 'bg-blue-100 text-blue-700', venta: 'bg-purple-100 text-purple-700', general: 'bg-gray-100 text-gray-700' };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Comunidad</h1>
            <p className="text-white/70 text-sm mt-1">Conecta con agricultores</p>
          </div>
          <button onClick={() => setModal(true)}
            className="bg-white text-primary font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1">
            <Plus size={16} /> Publicar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIAS.map(c => (
          <button key={c.id} onClick={() => setCategoria(c.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              categoria === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <span>{c.emoji}</span>{c.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-500 text-sm">No hay publicaciones en esta categoría</p>
            <button onClick={() => setModal(true)} className="mt-3 text-primary font-semibold text-sm">Sé el primero en publicar</button>
          </div>
        ) : filtrados.map(m => (
          <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                {m.autor?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-gray-800">{m.autor}</span>
                  {m.ubicacion && <span className="text-xs text-gray-400">📍 {m.ubicacion}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${catColors[m.categoria] || catColors.general}`}>
                    {CATEGORIAS.find(c => c.id === m.categoria)?.emoji} {m.categoria}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(m.fecha)}</p>
                <h3 className="font-bold text-gray-800 text-sm mt-2">{m.titulo}</h3>
                <p className="text-gray-600 text-sm mt-1 leading-relaxed">{m.contenido}</p>
                <div className="flex items-center gap-4 mt-3">
                  <button onClick={() => darLike(m.id)} className="flex items-center gap-1 text-gray-400 hover:text-primary transition-colors text-xs font-semibold">
                    👍 {m.likes || 0}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal publicar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-lg">Publicar en la comunidad</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Categoría</label>
                <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
                  {CATEGORIAS.filter(c => c.id !== 'todas').map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                  placeholder="Ej: Rancha en parcelas del sector Alto"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Contenido *</label>
                <textarea value={form.contenido} onChange={e => setForm({...form, contenido: e.target.value})}
                  placeholder="Describe el problema, precio o consejo que quieres compartir..." rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Ubicación</label>
                <input value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})}
                  placeholder="Ej: Sector Alto Salabamba"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
                <button onClick={publicar} disabled={publicando}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {publicando ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

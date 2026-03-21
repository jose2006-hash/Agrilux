import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Users, Camera, Leaf } from 'lucide-react';

export default function Admin() {
  const [stats, setStats] = useState({ usuarios: 0, diagnosticos: 0, parcelas: 0, comunidad: 0 });
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [u, d, p, c] = await Promise.all([
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'diagnosticos')),
          getDocs(collection(db, 'parcelas')),
          getDocs(collection(db, 'comunidad')),
        ]);
        setStats({ usuarios: u.size, diagnosticos: d.size, parcelas: p.size, comunidad: c.size });
        setUsuarios(u.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (e) { console.log(e); }
      setLoading(false);
    };
    cargar();
  }, []);

  const statCards = [
    { label: 'Usuarios registrados', value: stats.usuarios, emoji: '👥', color: 'bg-blue-500' },
    { label: 'Diagnósticos realizados', value: stats.diagnosticos, emoji: '🔬', color: 'bg-green-500' },
    { label: 'Parcelas creadas', value: stats.parcelas, emoji: '🌱', color: 'bg-primary' },
    { label: 'Posts comunidad', value: stats.comunidad, emoji: '💬', color: 'bg-purple-500' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-gray-800 text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Panel Admin</h1>
        <p className="text-white/60 text-sm mt-1">Estadísticas y usuarios</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className={`${s.color} w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2`}>{s.emoji}</div>
              <p className="text-2xl font-display font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Usuarios registrados ({usuarios.length})</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {usuarios.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {u.nombre?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{u.nombre}</p>
                  <p className="text-xs text-gray-400">{u.ubicacion} · {u.tipo}</p>
                </div>
                <a href={`https://wa.me/51${u.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="text-green-500 text-xs font-semibold">WhatsApp</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

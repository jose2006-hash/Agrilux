import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Camera, CreditCard, TrendingUp, ShieldCheck } from 'lucide-react';

const modules = [
  { path: '/diagnostico', icon: Camera, label: 'Diagnóstico IA', desc: 'Identifica plagas y enfermedades', color: 'bg-blue-500', emoji: '🔬' },
  { path: '/mercado', icon: ShieldCheck, label: 'Fungicidas', desc: 'Recomendaciones y productos', color: 'bg-emerald-500', emoji: '🛡️' },
  { path: '/financiera', icon: CreditCard, label: 'Salud Financiera', desc: 'Próximamente', color: 'bg-amber-500', emoji: '💰', disabled: true },
];

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -right-4 top-12 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm">Bienvenido,</p>
          <h1 className="text-2xl font-display font-bold">{user?.nombre?.split(' ')[0]} 👋</h1>
          <p className="text-white/60 text-xs mt-1">{user?.ubicacion}</p>
        </div>
      </div>

      {/* Precios rápidos */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-primary" />
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Precios del día - Lima</p>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {[
            { n: 'Papa Yungay', p: 'S/ 1.20', t: '↑' },
            { n: 'Maíz', p: 'S/ 0.90', t: '→' },
            { n: 'Arroz', p: 'S/ 2.40', t: '↑' },
            { n: 'Palta Hass', p: 'S/ 3.80', t: '↓' },
          ].map(({ n, p, t }) => (
            <div key={n} className="flex-shrink-0 bg-gray-50 rounded-xl p-3 min-w-[110px]">
              <p className="text-xs text-gray-500 mb-1">{n}</p>
              <p className="font-bold text-primary text-sm">{p}/kg</p>
              <p className={`text-xs ${t === '↑' ? 'text-green-500' : t === '↓' ? 'text-red-500' : 'text-gray-400'}`}>{t} tendencia</p>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="px-4">
        <h2 className="font-display font-bold text-gray-800 mb-4">¿Qué deseas hacer?</h2>
        <div className="grid grid-cols-2 gap-3">
          {modules.map(({ path, icon: Icon, label, desc, color, emoji, disabled }) => (
            <button key={path} onClick={() => !disabled && navigate(path)}
              className={`bg-white rounded-2xl p-4 text-left shadow-sm border border-gray-100 transition-all ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-primary/20 active:scale-95'
              }`}>
              <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                <span className="text-xl">{emoji}</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              {disabled && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full mt-2 inline-block">Próximamente</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Youtube, Instagram, Linkedin, LogOut, Shield } from 'lucide-react';
import { WHATSAPP } from '../lib/constants';

export default function Mas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const redes = [
    { nombre: 'YouTube', desc: 'Videos de especialistas en cultivos', emoji: '📹', color: 'bg-red-500', url: 'https://youtube.com/@agrilux' },
    { nombre: 'TikTok', desc: 'Tips rápidos de agricultura', emoji: '🎵', color: 'bg-black', url: 'https://tiktok.com/@agrilux' },
    { nombre: 'Facebook', desc: 'Comunidad y noticias', emoji: '📘', color: 'bg-blue-600', url: 'https://facebook.com/agrilux' },
    { nombre: 'Instagram', desc: 'Fotos e historias de campo', emoji: '📸', color: 'bg-pink-500', url: 'https://instagram.com/agrilux' },
    { nombre: 'LinkedIn', desc: 'Red profesional agrícola', emoji: '💼', color: 'bg-blue-700', url: 'https://linkedin.com/company/agrilux' },
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Más</h1>
        <p className="text-white/70 text-sm mt-1">Redes, soporte y configuración</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Perfil */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl font-bold text-white">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{user?.nombre}</p>
            <p className="text-sm text-gray-500">{user?.ubicacion}</p>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full capitalize">{user?.tipo}</span>
          </div>
        </div>

        {/* Soporte */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Soporte</p>
          <button onClick={() => window.open(`https://wa.me/${WHATSAPP}?text=Hola Agrilux, necesito ayuda`, '_blank')}
            className="w-full flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
            <span className="text-xl">📲</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800">WhatsApp Agrilux</p>
              <p className="text-xs text-gray-400">+51 935 211 605</p>
            </div>
            <ExternalLink size={16} className="text-gray-300" />
          </button>
        </div>

        {/* Redes sociales */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Nuestras Redes</p>
          <div className="space-y-1">
            {redes.map(r => (
              <button key={r.nombre} onClick={() => window.open(r.url, '_blank')}
                className="w-full flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl px-2 transition-colors">
                <div className={`w-10 h-10 ${r.color} rounded-xl flex items-center justify-center text-lg`}>
                  {r.emoji}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-gray-800">{r.nombre}</p>
                  <p className="text-xs text-gray-400">{r.desc}</p>
                </div>
                <ExternalLink size={14} className="text-gray-300" />
              </button>
            ))}
          </div>
          <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 mb-1">📹 YouTube — Contenido destacado</p>
            <p className="text-xs text-red-600">Videos de especialistas explicando el proceso de cultivo de cada uno de nuestros 15 productos. ¡Aprende de los mejores!</p>
          </div>
        </div>

        {/* Admin */}
        {user?.tipo === 'admin' && (
          <button onClick={() => navigate('/admin')}
            className="w-full bg-gray-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2">
            <Shield size={18} /> Panel de Administrador
          </button>
        )}

        {/* Cerrar sesión */}
        <button onClick={logout}
          className="w-full border border-red-200 text-red-500 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors">
          <LogOut size={18} /> Cerrar sesión
        </button>

        <p className="text-center text-xs text-gray-400 pb-2">Agrilux v1.0 · Agricultura Inteligente del Perú</p>
      </div>
    </div>
  );
}

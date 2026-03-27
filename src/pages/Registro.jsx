import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Registro() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');

  const handleEntrar = () => {
    if (!nombre.trim()) return;
    const user = {
      id: 'user_' + Date.now(),
      nombre: nombre.trim(),
      ubicacion: 'Perú',
      tipo: 'agricultor',
      whatsapp: '',
    };
    login(user);
    navigate('/diagnostico'); // ← único cambio
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl">
            <span className="text-5xl">🌾</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-primary">AGRILUX</h1>
          <p className="text-gray-500 mt-2">Agricultura Inteligente del Perú</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">¿Cómo te llamas?</h2>
          <p className="text-sm text-gray-400 mb-6">Solo necesitamos tu nombre para comenzar</p>

          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEntrar()}
            placeholder="Ej: Juan Pérez"
            autoFocus
            className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-primary transition-colors mb-4"
          />

          <button
            onClick={handleEntrar}
            disabled={!nombre.trim()}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-lg hover:bg-primary-dark transition-colors disabled:opacity-40 shadow-lg"
          >
            Comenzar →
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Al continuar aceptas usar la app con fines agrícolas
        </p>
      </div>
    </div>
  );
}
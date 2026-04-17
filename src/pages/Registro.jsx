import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function Registro() {
  const { register, login } = useAuth();
  const [modo, setModo] = useState('login'); // login | registro
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verPass, setVerPass] = useState(false);

  const errMsg = (code) => {
    const msgs = {
      'auth/email-already-in-use': 'Este correo ya está registrado.',
      'auth/invalid-email': 'Correo electrónico inválido.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/user-not-found': 'No existe cuenta con este correo.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    };
    return msgs[code] || 'Error al procesar. Intenta de nuevo.';
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.email || !form.password) { setError('Completa todos los campos'); return; }
    if (modo === 'registro' && !form.nombre) { setError('Ingresa tu nombre'); return; }
    setLoading(true);
    try {
      if (modo === 'registro') {
        await register({ nombre: form.nombre, email: form.email, password: form.password });
      } else {
        await login({ email: form.email, password: form.password });
      }
    } catch (e) {
      setError(errMsg(e.code));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl">
            <span className="text-5xl">🌾</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-primary">AGRILUX</h1>
          <p className="text-gray-500 mt-2 text-sm">Agricultura Inteligente del Perú</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          {[['login', 'Iniciar sesión'], ['registro', 'Crear cuenta']].map(([m, label]) => (
            <button key={m} onClick={() => { setModo(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                modo === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {modo === 'registro' && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Nombre completo</label>
              <input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Juan Pérez García"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="tucorreo@gmail.com"
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={verPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Mínimo 6 caracteres"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors pr-12"
              />
              <button onClick={() => setVerPass(!verPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                {verPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-lg mt-2"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" /> Procesando...</span>
              : modo === 'login' ? 'Iniciar sesión →' : 'Crear cuenta →'
            }
          </button>

          {modo === 'registro' && (
            <p className="text-xs text-gray-400 text-center">
              Tus datos se guardan de forma segura y ayudan a mejorar la IA agrícola
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Necesitas ayuda?{' '}
          <a href="https://wa.me/51935211605" target="_blank" rel="noreferrer" className="text-primary font-semibold">
            935 211 605
          </a>
        </p>
      </div>
    </div>
  );
}
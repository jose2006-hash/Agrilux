/**
 * src/pages/Registro.jsx
 *
 * Registro: nombre completo + contraseña
 * Login:    solo nombre completo (pruebas piloto)
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff, User, Lock } from 'lucide-react';

const ERRORES = {
  'agrilux/nombre-requerido':     'Ingresa tu nombre completo.',
  'agrilux/nombre-en-uso':        'Ya existe una cuenta con ese nombre. Prueba iniciar sesión.',
  'agrilux/usuario-no-encontrado':'No encontramos ese nombre. ¿Ya tienes cuenta?',
  'agrilux/clave-incorrecta':     'Clave incorrecta.',
  'auth/weak-password':           'La contraseña debe tener al menos 6 caracteres.',
  'auth/wrong-password':          'Contraseña incorrecta.',
  'auth/invalid-credential':      'Nombre o contraseña incorrectos.',
  'auth/too-many-requests':       'Demasiados intentos. Espera unos minutos.',
};

function msgError(code) {
  return ERRORES[code] || 'Error al procesar. Intenta de nuevo.';
}

export default function Registro() {
  const { register, login } = useAuth();

  const [modo, setModo]       = useState('login');
  const [nombre, setNombre]   = useState('');
  const [password, setPass]   = useState('');
  const [verPass, setVerPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const cambiarModo = (m) => { setModo(m); setError(''); setNombre(''); setPass(''); };

  const handleSubmit = async () => {
    setError('');
    if (!nombre.trim()) { setError('Ingresa tu nombre completo.'); return; }
    if (modo === 'registro' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (modo === 'registro') {
        await register({ nombre: nombre.trim(), password });
      } else {
        // Login solo con nombre — la contraseña es opcional en pruebas piloto
        await login({ nombre: nombre.trim(), password: password || undefined });
      }
    } catch (e) {
      setError(msgError(e.code));
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}
    >
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
            <button
              key={m}
              onClick={() => cambiarModo(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                modo === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
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

          {/* Nombre completo */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Nombre completo
            </label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Ej: Juan Pérez García"
                className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                autoComplete="name"
              />
            </div>
            {modo === 'login' && (
              <p className="text-xs text-gray-400 mt-1.5 ml-1">
                Usa el mismo nombre con el que te registraste
              </p>
            )}
          </div>

          {/* Contraseña — siempre visible en registro, opcional en login */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Contraseña
              {modo === 'login' && (
                <span className="text-gray-400 font-normal ml-1">(opcional en pruebas piloto)</span>
              )}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={verPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Dejar vacío si no recuerdas'}
                className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              />
              <button
                onClick={() => setVerPass(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {verPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botón */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-lg mt-2"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Procesando...
                </span>
              : modo === 'login' ? 'Ingresar →' : 'Crear cuenta →'
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
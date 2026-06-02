/**
 * src/pages/Registro.jsx
 *
 * Registro: nombre completo + correo + celular
 * Login:    solo número de celular
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff, User, Mail, Phone } from 'lucide-react';

const ERRORES = {
  'agrilux/celular-en-uso':        'Este número ya tiene una cuenta. Inicia sesión.',
  'agrilux/celular-no-encontrado': 'No encontramos ese número. ¿Ya tienes cuenta?',
  'agrilux/sin-email':             'Error en la cuenta. Contacta soporte.',
  'auth/email-already-in-use':     'Este correo ya está registrado.',
  'auth/invalid-email':            'El correo no es válido.',
  'auth/weak-password':            'Número de celular inválido.',
  'auth/invalid-credential':       'Número de celular incorrecto.',
  'auth/too-many-requests':        'Demasiados intentos. Espera unos minutos.',
};

function msgError(code) {
  return ERRORES[code] || 'Error al procesar. Intenta de nuevo.';
}

export default function Registro() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [modo, setModo]       = useState('login');
  const [nombre, setNombre]   = useState('');
  const [email, setEmail]     = useState('');
  const [celular, setCelular] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const cambiarModo = (m) => {
    setModo(m); setError('');
    setNombre(''); setEmail(''); setCelular('');
  };

  // Solo dígitos, máximo 9
  const handleCelular = (val) => {
    const solo = val.replace(/\D/g, '').slice(0, 9);
    setCelular(solo);
  };

  const handleSubmit = async () => {
    setError('');

    if (modo === 'registro') {
      if (!nombre.trim())       { setError('Ingresa tu nombre completo.'); return; }
      if (!email.trim())        { setError('Ingresa tu correo electrónico.'); return; }
      if (celular.length !== 9) { setError('El número de celular debe tener 9 dígitos.'); return; }
    } else {
      if (celular.length !== 9) { setError('Ingresa tu número de celular (9 dígitos).'); return; }
    }

    setLoading(true);
    try {
      if (modo === 'registro') {
        await register({ nombre: nombre.trim(), email, celular });
      } else {
        await login({ celular });
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

          {/* ── REGISTRO ── */}
          {modo === 'registro' && (
            <>
              {/* Nombre */}
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
              </div>

              {/* Correo */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="tucorreo@gmail.com"
                    className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── CELULAR (login y registro) ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              {modo === 'login' ? 'Número de celular' : 'Número de celular (tu clave de acceso)'}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="text-xs text-gray-400 font-semibold">🇵🇪 +51</span>
              </div>
              <input
                type="tel"
                value={celular}
                onChange={e => handleCelular(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="9XX XXX XXX"
                maxLength={9}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full border-2 border-gray-100 rounded-2xl pl-16 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors tracking-widest font-mono"
                autoComplete="tel"
              />
            </div>

            {/* Indicador de progreso */}
            <div className="flex gap-1 mt-2 px-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all duration-150 ${
                    i < celular.length ? 'bg-primary' : 'bg-gray-100'
                  }`}
                />
              ))}
            </div>

            {celular.length > 0 && celular.length < 9 && (
              <p className="text-xs text-gray-400 mt-1 ml-1">{celular.length}/9 dígitos</p>
            )}
            {celular.length === 9 && (
              <p className="text-xs text-green-500 mt-1 ml-1 flex items-center gap-1">
                ✓ Número completo
              </p>
            )}

            {modo === 'login' && (
              <p className="text-xs text-gray-400 mt-2 ml-1">
                Ingresa el número con el que te registraste
              </p>
            )}
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
              : modo === 'login' ? 'Iniciar sesión →' : 'Crear cuenta →'
            }
          </button>

          {modo === 'registro' && (
            <p className="text-xs text-gray-400 text-center">
              Tu número de celular es tu clave de acceso. Guárdalo bien.
            </p>
          )}
        </div>

        {/* Pie */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            ¿Ayuda?{' '}
            <a
              href="https://wa.me/51935211605"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-semibold"
            >
              935 211 605
            </a>
          </p>
          {/* Acceso admin discreto */}
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            · · ·
          </button>
        </div>

      </div>
    </div>
  );
}
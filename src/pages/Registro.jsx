/**
 * src/pages/Registro.jsx
 *
 * Registro: nombre completo + correo + número DNI
 * Login:    correo + número DNI
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff, User, Mail, CreditCard } from 'lucide-react';

const ERRORES = {
  'auth/email-already-in-use': 'Este correo ya está registrado. Inicia sesión.',
  'auth/invalid-email':        'El correo no es válido.',
  'auth/weak-password':        'DNI inválido.',
  'auth/user-not-found':       'No existe cuenta con ese correo.',
  'auth/wrong-password':       'DNI incorrecto.',
  'auth/invalid-credential':   'Correo o DNI incorrectos.',
  'auth/too-many-requests':    'Demasiados intentos. Espera unos minutos.',
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
  const [dni, setDni]         = useState('');
  const [verDni, setVerDni]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const cambiarModo = (m) => {
    setModo(m); setError('');
    setNombre(''); setEmail(''); setDni('');
  };

  // Solo permite dígitos en el campo DNI, máximo 8
  const handleDni = (val) => {
    const solo = val.replace(/\D/g, '').slice(0, 8);
    setDni(solo);
  };

  const handleSubmit = async () => {
    setError('');

    if (modo === 'registro' && !nombre.trim()) {
      setError('Ingresa tu nombre completo.'); return;
    }
    if (!email.trim()) { setError('Ingresa tu correo electrónico.'); return; }
    if (!dni)          { setError('Ingresa tu número de DNI.'); return; }
    if (dni.length !== 8) { setError('El DNI debe tener exactamente 8 dígitos.'); return; }

    setLoading(true);
    try {
      if (modo === 'registro') {
        await register({ nombre: nombre.trim(), email, dni });
      } else {
        await login({ email, dni });
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

          {/* Nombre completo — solo en registro */}
          {modo === 'registro' && (
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
          )}

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

          {/* DNI */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Número de DNI
            </label>
            <div className="relative">
              <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={verDni ? 'text' : 'password'}
                value={dni}
                onChange={e => handleDni(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="8 dígitos"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-primary transition-colors tracking-widest"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setVerDni(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {verDni ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Indicador de dígitos ingresados */}
            <div className="flex gap-1 mt-2 px-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all ${
                    i < dni.length ? 'bg-primary' : 'bg-gray-100'
                  }`}
                />
              ))}
            </div>
            {dni.length > 0 && dni.length < 8 && (
              <p className="text-xs text-gray-400 mt-1 ml-1">{dni.length}/8 dígitos</p>
            )}
            {dni.length === 8 && (
              <p className="text-xs text-green-500 mt-1 ml-1">✓ DNI completo</p>
            )}
          </div>

          {/* Botón principal */}
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
              Tu DNI es tu clave de acceso. No lo compartas con nadie.
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
          {/* Acceso admin — discreto */}
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
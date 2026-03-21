import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { WHATSAPP } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function Registro() {
  const { registerUser, loginWithCode } = useAuth();
  const [step, setStep] = useState('tipo'); // tipo | form | login
  const [tipo, setTipo] = useState('');
  const [form, setForm] = useState({ nombre: '', ubicacion: '', whatsapp: '', empresa: '', cargo: '', servicio: '' });
  const [loginForm, setLoginForm] = useState({ whatsapp: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState('');

  const handleTipo = (t) => { setTipo(t); setStep(t === 'proveedor' ? 'proveedor' : 'form'); };

  const handleRegister = async () => {
    if (!form.nombre || !form.ubicacion || !form.whatsapp) {
      setError('Completa todos los campos obligatorios'); return;
    }
    setLoading(true); setError('');
    try {
      const code = generateCode();
      await registerUser({ ...form, tipo, codigo: code });
      // Enviar código por WhatsApp
      const msg = encodeURIComponent(`✅ *Bienvenido a AGRILUX, ${form.nombre}!*\n\nTu código de acceso es:\n\n🔑 *${code}*\n\nGuárdalo para ingresar a tu cuenta. 🌱`);
      window.open(`https://wa.me/51${form.whatsapp.replace(/\D/g, '')}?text=${msg}`, '_blank');
    } catch (e) { setError('Error al registrar. Intenta de nuevo.'); }
    setLoading(false);
  };

  const handleProveedorSend = () => {
    if (!form.nombre || !form.empresa || !form.whatsapp) { setError('Completa todos los campos'); return; }
    const msg = encodeURIComponent(`🏢 *NUEVO PROVEEDOR - AGRILUX*\n\n👤 Nombre: ${form.nombre}\n🏭 Empresa: ${form.empresa}\n💼 Cargo: ${form.cargo}\n📦 Servicio/Producto: ${form.servicio}\n📱 WhatsApp: ${form.whatsapp}`);
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  const handleLogin = async () => {
    if (!loginForm.whatsapp || !loginForm.code) { setError('Ingresa tu número y código'); return; }
    setLoading(true); setError('');
    try {
      await loginWithCode(loginForm.whatsapp, loginForm.code);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (step === 'login') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🌱</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-primary">Iniciar Sesión</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa tu número y código</p>
        </div>
        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Número de WhatsApp</label>
            <input value={loginForm.whatsapp} onChange={e => setLoginForm({...loginForm, whatsapp: e.target.value})}
              placeholder="Ej: 999888777" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Código de acceso</label>
            <input value={loginForm.code} onChange={e => setLoginForm({...loginForm, code: e.target.value.toUpperCase()})}
              placeholder="Ej: ABC123" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary uppercase" />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <button onClick={() => setStep('tipo')} className="w-full text-gray-500 text-sm py-2">
            ¿No tienes cuenta? Regístrate
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 'tipo') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <span className="text-4xl">🌾</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-primary">AGRILUX</h1>
          <p className="text-gray-500 mt-2">Agricultura Inteligente del Perú</p>
        </div>
        <p className="text-center font-semibold text-gray-700 mb-6">¿Cómo deseas ingresar?</p>
        <div className="space-y-3">
          {[
            { t: 'agricultor', emoji: '👨‍🌾', label: 'Agricultor', desc: 'Gestiona tus cultivos y accede al mercado' },
            { t: 'consumidor', emoji: '🛒', label: 'Consumidor', desc: 'Compra productos agrícolas frescos' },
            { t: 'proveedor', emoji: '🏭', label: 'Proveedor', desc: 'Ofrece servicios o productos agrícolas' },
          ].map(({t, emoji, label, desc}) => (
            <button key={t} onClick={() => handleTipo(t)}
              className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all text-left">
              <span className="text-3xl">{emoji}</span>
              <div>
                <p className="font-bold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={() => setStep('login')} className="w-full mt-6 text-primary font-semibold text-sm py-2">
          Ya tengo cuenta → Iniciar sesión
        </button>
      </div>
    </div>
  );

  if (step === 'proveedor') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <button onClick={() => setStep('tipo')} className="text-gray-400 text-sm mb-4">← Volver</button>
        <h2 className="text-xl font-display font-bold text-primary mb-6">Registro Proveedor</h2>
        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</p>}
        <div className="space-y-3">
          {[
            { key: 'nombre', label: 'Nombre Completo *', ph: 'Tu nombre' },
            { key: 'empresa', label: 'Empresa *', ph: 'Nombre de la empresa' },
            { key: 'cargo', label: 'Cargo', ph: 'Tu cargo' },
            { key: 'whatsapp', label: 'WhatsApp *', ph: '999888777' },
          ].map(({key, label, ph}) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              <input value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                placeholder={ph} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Servicio o Producto que ofreces *</label>
            <textarea value={form.servicio} onChange={e => setForm({...form, servicio: e.target.value})}
              placeholder="Describe qué ofreces..." rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <button onClick={handleProveedorSend}
            className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl hover:bg-green-600 transition-colors">
            📲 Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <button onClick={() => setStep('tipo')} className="text-gray-400 text-sm mb-4">← Volver</button>
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">{tipo === 'agricultor' ? '👨‍🌾' : '🛒'}</span>
          </div>
          <h2 className="text-xl font-display font-bold text-primary">
            {tipo === 'agricultor' ? 'Registro Agricultor' : 'Registro Consumidor'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">Completa tu registro para comenzar</p>
        </div>
        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</p>}
        <div className="space-y-3">
          {[
            { key: 'nombre', label: 'Nombre Completo *', ph: 'Ej: Juan Pérez García' },
            { key: 'ubicacion', label: 'Ubicación (Ciudad/Distrito) *', ph: 'Ej: Cutervo, Cajamarca' },
            { key: 'whatsapp', label: 'Número de WhatsApp *', ph: 'Ej: 935211605' },
          ].map(({key, label, ph}) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              <input value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                placeholder={ph} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          ))}
          <button onClick={handleRegister} disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 mt-2">
            {loading ? 'Registrando...' : 'Comenzar →'}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          Recibirás un código por WhatsApp para acceder a tu cuenta
        </p>
      </div>
    </div>
  );
}

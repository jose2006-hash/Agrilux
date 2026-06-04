import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MapPin, Mic, Navigation, Check, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function SelectorUbicacion({ esPrimeraVez, onClose }) {
  const { user, updateUbicacion } = useAuth();
  const [ubicacion, setUbicacion] = useState(user?.ubicacion || '');
  const [detectando, setDetectando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [modo, setModo] = useState(null);
  const inputRef = useRef(null);
  const reconRef = useRef(null);

  const leerTexto = useCallback((texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-PE'; u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (esPrimeraVez) {
      setTimeout(() => leerTexto('Por favor, selecciona tu ubicación. Puedes usar el GPS de tu teléfono, decir tu ubicación por voz, o escribirla manualmente.'), 500);
    }
  }, [esPrimeraVez, leerTexto]);

  useEffect(() => {
    if (modo === 'escribir' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modo]);

  const detectarGPS = async () => {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no tiene GPS. Usa la opción de escribir o voz.');
      return;
    }
    setDetectando(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/geocode?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          const nombreCorto = [data.address?.city, data.address?.town, data.address?.village, data.address?.county, data.address?.state]
            .filter(Boolean).slice(0, 2).join(', ') || data.name.split(',')[0];
          setUbicacion(nombreCorto);
        } catch {
          setUbicacion(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        setDetectando(false);
        setModo('confirmar');
      },
      () => {
        setError('No se pudo obtener tu ubicación. Activa el GPS e intenta de nuevo, o usa otra opción.');
        setDetectando(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const grabarVoz = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Usa Chrome para la función de voz.'); return;
    }
    if (grabando) { reconRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-PE';
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setGrabando(true);
    r.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      setUbicacion(texto);
      setGrabando(false);
      setModo('confirmar');
    };
    r.onerror = () => { setGrabando(false); setError('No te escuché bien. Intenta de nuevo o escribe la ubicación.'); };
    r.onend = () => setGrabando(false);
    reconRef.current = r;
    r.start();
  };

  const guardar = async () => {
    if (!ubicacion.trim()) { setError('Ingresa una ubicación válida.'); return; }
    setConfirmando(true);
    setError('');
    try {
      await updateUbicacion(ubicacion.trim());
      if (!esPrimeraVez) onClose?.();
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    }
    setConfirmando(false);
  };

  if (esPrimeraVez && !modo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ maxWidth: 430, margin: '0 auto' }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <MapPin size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-display font-extrabold text-gray-900 mb-2">
            ¿Dónde está tu parcela?
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-xs">
            Las recomendaciones serán más precisas si conocemos tu ubicación.
          </p>
          <div className="w-full space-y-3 max-w-sm">
            <button onClick={() => { setModo('gps'); detectarGPS(); }}
              className="w-full bg-primary text-white font-bold py-5 rounded-2xl text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
              <Navigation size={22} /> Usar GPS del teléfono
            </button>
            <button onClick={() => { setModo('voz'); grabarVoz(); }}
              className="w-full bg-blue-500 text-white font-bold py-5 rounded-2xl text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
              <Mic size={22} /> Decir ubicación por voz
            </button>
            <button onClick={() => setModo('escribir')}
              className="w-full bg-gray-100 text-gray-800 font-bold py-5 rounded-2xl text-base hover:bg-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95">
              <MapPin size={22} /> Escribir ubicación
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${esPrimeraVez ? 'fixed inset-0 z-50 bg-white' : ''} flex flex-col`} style={esPrimeraVez ? { maxWidth: 430, margin: '0 auto' } : {}}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <MapPin size={32} className="text-primary" />
        </div>

        {!esPrimeraVez && (
          <div className="w-full flex justify-end mb-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        )}

        {detectando && (
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Obteniendo ubicación con GPS...</p>
            <p className="text-gray-400 text-sm mt-1">Asegúrate de tener el GPS activado</p>
          </div>
        )}

        {grabando && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic size={32} className="text-red-500" />
            </div>
            <p className="text-gray-600 font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" /> Escuchando...
            </p>
            <p className="text-gray-400 text-sm mt-1">Di el nombre de tu ubicación</p>
          </div>
        )}

        {!detectando && !grabando && modo !== 'confirmar' && (
          <div className="w-full max-w-sm space-y-3">
            <button onClick={() => { setModo('gps'); detectarGPS(); }}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
              <Navigation size={20} /> GPS del teléfono
            </button>
            <button onClick={() => { setModo('voz'); grabarVoz(); }}
              className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
              <Mic size={20} /> Decir por voz
            </button>
            <button onClick={() => setModo('escribir')}
              className="w-full border-2 border-dashed border-gray-300 text-gray-600 font-bold py-4 rounded-2xl hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-3 active:scale-95">
              <MapPin size={20} /> Escribir manualmente
            </button>
          </div>
        )}

        {modo === 'escribir' && (
          <div className="w-full max-w-sm">
            <label className="text-sm font-semibold text-gray-600 block mb-2 text-left">
              Escribe tu ubicación
            </label>
            <input ref={inputRef} value={ubicacion} onChange={e => setUbicacion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              placeholder="Ej: Cutervo, Cajamarca"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}

        {modo === 'confirmar' && ubicacion && (
          <div className="w-full max-w-sm text-center">
            <div className="bg-green-50 rounded-2xl p-5 mb-4">
              <Check size={28} className="text-green-500 mx-auto mb-2" />
              <p className="text-green-700 font-bold text-lg">{ubicacion}</p>
              <p className="text-green-600 text-sm mt-1">¿Es correcta tu ubicación?</p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm mt-3 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
        )}

        {(modo === 'confirmar' || modo === 'escribir') && (
          <div className="flex gap-3 mt-4 w-full max-w-sm">
            {modo === 'confirmar' && (
              <button onClick={() => { setModo(null); setUbicacion(user?.ubicacion || ''); }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all">
                Corregir
              </button>
            )}
            {modo === 'escribir' && ubicacion.trim() && !confirmando && (
              <button onClick={() => setModo('confirmar')}
                className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-lg">
                Siguiente
              </button>
            )}
            <button onClick={guardar} disabled={!ubicacion.trim() || confirmando}
              className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold hover:bg-primary-dark transition-all disabled:opacity-40 shadow-lg">
              {confirmando ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Guardar ubicación'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

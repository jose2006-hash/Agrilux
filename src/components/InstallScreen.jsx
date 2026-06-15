import { useState, useEffect } from 'react';
import { Download, X, Check } from 'lucide-react';

export default function InstallScreen({ onContinue }) {
  const [deferredPrompt, setDeferredPrompt] = useState(window.__installPrompt || null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    ) {
      onContinue();
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      window.__installPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setTimeout(onContinue, 1500);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    window.__installPrompt = null;
    setDeferredPrompt(null);
    setInstalling(false);
    if (outcome === 'accepted') {
      setInstalled(true);
      setTimeout(onContinue, 1500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero verde */}
      <div className="bg-[#1a6b3c] flex flex-col items-center justify-center px-6 pt-16 pb-10 relative">
        <button
          onClick={onContinue}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/20 text-white"
        >
          <X size={18} />
        </button>

        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-5 shadow-xl">
          <img
            src="/icons/icon-192x192.png"
            alt="Agrilux"
            className="w-16 h-16 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<span style="font-size:40px">🌱</span>';
            }}
          />
        </div>

        <h1 className="text-white text-2xl font-bold text-center mb-2">
          Instala Agrilux
        </h1>
        <p className="text-white/80 text-sm text-center max-w-xs leading-relaxed">
          Úsala sin internet, abre al instante y sin barras del navegador
        </p>
      </div>

      {/* Beneficios */}
      <div className="px-6 py-6 flex flex-col gap-3">
        {[
          { emoji: '📶', titulo: 'Funciona sin internet', desc: 'Consulta diagnósticos aunque no tengas señal' },
          { emoji: '⚡', titulo: 'Abre al instante', desc: 'Sin esperar que cargue el navegador' },
          { emoji: '📱', titulo: 'Como una app nativa', desc: 'Pantalla completa, sin barras de Chrome' },
        ].map(({ emoji, titulo, desc }) => (
          <div key={titulo} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-4 py-3">
            <span className="text-2xl">{emoji}</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{titulo}</p>
              <p className="text-gray-500 text-xs">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Botones */}
      <div className="px-6 pb-10 mt-auto flex flex-col gap-3">
        {installed ? (
          <div className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
            <Check size={20} />
            ¡Instalada correctamente!
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full bg-[#1a6b3c] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base active:scale-95 transition-transform disabled:opacity-70"
          >
            <Download size={20} />
            {installing ? 'Instalando...' : 'Instalar ahora'}
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-amber-800 font-semibold text-sm mb-1">Para instalar:</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Toca <strong>⋮</strong> en Chrome → <strong>"Añadir a pantalla de inicio"</strong>
            </p>
            <p className="text-amber-500 text-xs mt-2">
              (El botón automático aparece tras visitar la app 2 veces)
            </p>
          </div>
        )}

        <button
          onClick={onContinue}
          className="w-full text-gray-400 text-sm py-2 text-center"
        >
          Ahora no, continuar al sitio
        </button>
      </div>
    </div>
  );
}
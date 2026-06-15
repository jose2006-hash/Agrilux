import { useState, useEffect } from 'react';
import { Download, Wifi, Zap, Bell, X } from 'lucide-react';

export default function InstallScreen({ onContinue }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    ) {
      setIsStandalone(true);
      onContinue();
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => onContinue());

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      localStorage.removeItem('agrilux_install_dismissed');
      onContinue();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('agrilux_install_dismissed', 'true');
    onContinue();
  };

  if (isStandalone) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header verde */}
      <div className="bg-[#1a6b3c] flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        {/* Botón saltar */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Ícono app */}
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-lg">
          <img
            src="/icons/icon-192x192.png"
            alt="Agrilux"
            className="w-16 h-16 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML =
                '<span style="font-size:40px">🌱</span>';
            }}
          />
        </div>

        <h1 className="text-white text-2xl font-bold text-center mb-2">
          Instala Agrilux
        </h1>
        <p className="text-white/80 text-sm text-center max-w-xs">
          Accede más rápido y úsala sin internet desde tu pantalla de inicio
        </p>
      </div>

      {/* Beneficios */}
      <div className="bg-white px-6 py-8 flex flex-col gap-5">
        <Beneficio
          icon={<Wifi size={22} className="text-[#1a6b3c]" />}
          titulo="Funciona sin internet"
          desc="Consulta diagnósticos anteriores aunque no tengas señal"
        />
        <Beneficio
          icon={<Zap size={22} className="text-[#1a6b3c]" />}
          titulo="Abre al instante"
          desc="Sin esperar que cargue el navegador cada vez"
        />
        <Beneficio
          icon={<Bell size={22} className="text-[#1a6b3c]" />}
          titulo="Como una app nativa"
          desc="Pantalla completa, sin barras del navegador"
        />
      </div>

      {/* Botones */}
      <div className="px-6 pb-10 flex flex-col gap-3">
        {deferredPrompt ? (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full bg-[#1a6b3c] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base active:scale-95 transition-transform disabled:opacity-70"
          >
            <Download size={20} />
            {installing ? 'Instalando...' : 'Instalar ahora'}
          </button>
        ) : (
          <div className="w-full bg-gray-100 text-gray-500 font-medium py-4 rounded-2xl text-center text-sm px-4">
            Para instalar: menú ⋮ de Chrome → "Añadir a pantalla de inicio"
          </div>
        )}

        <button
          onClick={handleSkip}
          className="w-full text-gray-400 font-medium py-3 text-sm"
        >
          Ahora no, continuar al sitio
        </button>
      </div>
    </div>
  );
}

function Beneficio({ icon, titulo, desc }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-[#1a6b3c]/10 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{titulo}</p>
        <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

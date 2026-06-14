import React, { useState, useEffect, createContext, useContext } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const InstallContext = createContext();

export function useInstallPrompt() {
  return useContext(InstallContext);
}

export function InstallPromptProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedFlag = localStorage.getItem('agrilux_install_dismissed');
    if (dismissedFlag) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      // Show banner after 5 seconds
      setTimeout(() => setShowBanner(true), 5000);
    };

    const installedHandler = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // Detect if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstallable(false);
      return;
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
    return outcome === 'accepted';
  };

  const dismissBanner = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('agrilux_install_dismissed', 'true');
  };

  return (
    <InstallContext.Provider value={{ isInstallable, triggerInstall, dismissBanner }}>
      {children}
      {showBanner && !dismissed && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
            <button onClick={dismissBanner}
              className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Smartphone size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">Instalar Agrilux</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Instálala en tu celular para diagnósticos más rápidos y uso sin internet
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={triggerInstall}
                    className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors">
                    <Download size={14} />
                    Instalar ahora
                  </button>
                  <button onClick={dismissBanner}
                    className="text-gray-400 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    Ahora no
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </InstallContext.Provider>
  );
}

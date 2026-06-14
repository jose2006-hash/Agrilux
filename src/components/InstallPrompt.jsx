import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedFlag = localStorage.getItem('agrilux_install_dismissed');
    if (dismissedFlag) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstall(false);
    setDismissed(true);
    localStorage.setItem('agrilux_install_dismissed', 'true');
  };

  if (!showInstall || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
        <button onClick={handleDismiss}
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
              <button onClick={handleInstall}
                className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors">
                <Download size={14} />
                Instalar ahora
              </button>
              <button onClick={handleDismiss}
                className="text-gray-400 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

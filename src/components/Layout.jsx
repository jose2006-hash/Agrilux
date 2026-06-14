import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, ShieldCheck, LogOut, Menu, X, MapPin, Download, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import SelectorUbicacion from './SelectorUbicacion';
import { useInstallPrompt } from './InstallPrompt';

const navItems = [
  { path: '/',        icon: Camera,      label: 'Diagnóstico' },
  { path: '/mercado', icon: ShieldCheck, label: 'Fungicidas'  },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isInstallable, triggerInstall } = useInstallPrompt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mostrarUbicacion, setMostrarUbicacion] = useState(false);
  const [mostrarInstalacion, setMostrarInstalacion] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto">
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold text-gray-700 truncate">
            {user?.nombre ? `Hola, ${user.nombre.split(' ')[0]}` : 'Agrilux'}
          </div>
          {user?.ubicacion && (
            <button onClick={() => setMostrarUbicacion(true)}
              className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-1 rounded-full hover:bg-primary/10 transition-colors shrink-0">
              <MapPin size={12} />
              <span className="truncate max-w-[80px]">{user.ubicacion.split(',')[0]}</span>
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
              <button
                onClick={() => { setMenuOpen(false); setMostrarUbicacion(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg">
                <MapPin size={18} />
                Cambiar ubicación
              </button>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  if (isInstallable) {
                    const accepted = await triggerInstall();
                    if (!accepted) setMostrarInstalacion(true);
                  } else {
                    setMostrarInstalacion(true);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg">
                <Download size={18} />
                Descargar app
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium rounded-lg">
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 pb-28 overflow-y-auto">{children}</main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 shadow-lg z-50">
        <div className="flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${active ? 'text-primary' : 'text-gray-400'}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {mostrarUbicacion && (
        <div className="fixed inset-0 z-50 bg-white/95 flex items-center justify-center" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-[430px] mx-auto relative">
            <SelectorUbicacion esPrimeraVez={false} onClose={() => setMostrarUbicacion(false)} />
          </div>
        </div>
      )}

      {mostrarInstalacion && (
        <InstalacionModal onClose={() => setMostrarInstalacion(false)} isInstallable={isInstallable} triggerInstall={triggerInstall} />
      )}
    </div>
  );
}

function InstalacionModal({ onClose, isInstallable, triggerInstall }) {
  const [paso, setPaso] = useState(0);
  const [instalando, setInstalando] = useState(false);

  const isAndroid = /Android/.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleInstalar = async () => {
    if (isInstallable) {
      setInstalando(true);
      const accepted = await triggerInstall();
      setInstalando(false);
      if (accepted) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto">
        <button onClick={onClose}
          className="w-10 h-1 bg-gray-200 rounded-full mx-auto block mb-4" />

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-3xl">🌾</span>
          </div>
          <h3 className="text-lg font-display font-bold text-gray-900">Instalar Agrilux</h3>
          <p className="text-sm text-gray-500 mt-1">
            {isInstallable
              ? 'Chrome detectó que se puede instalar'
              : 'Sigue estos pasos para instalarla'}
          </p>
        </div>

        {isInstallable ? (
          <div className="text-center">
            <div className="bg-green-50 rounded-2xl p-4 mb-4">
              <Check size={32} className="text-green-500 mx-auto mb-2" />
              <p className="text-green-700 font-bold text-sm">¡Tu navegador está listo!</p>
              <p className="text-green-600 text-xs mt-1">Toca el botón para instalar</p>
            </div>
            <button onClick={handleInstalar} disabled={instalando}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base shadow-lg disabled:opacity-50">
              {instalando ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Instalando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Download size={20} /> Instalar Agrilux ahora
                </span>
              )}
            </button>
          </div>
        ) : (
          <>
            {isAndroid ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 text-center mb-2">Android · Chrome</p>

                <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${paso >= 1 ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${paso >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {paso >= 1 ? <Check size={16} /> : <span className="text-xs font-bold">1</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Toca los 3 puntos (⋮)</p>
                    <p className="text-xs text-gray-500">Esquina superior derecha de Chrome</p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${paso >= 2 ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${paso >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {paso >= 2 ? <Check size={16} /> : <span className="text-xs font-bold">2</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Busca "Instalar aplicación"</p>
                    <p className="text-xs text-gray-500">Aparece cerca del final del menú</p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${paso >= 3 ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${paso >= 3 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {paso >= 3 ? <Check size={16} /> : <span className="text-xs font-bold">3</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Toca "Instalar"</p>
                    <p className="text-xs text-gray-500">Agrilux aparecerá en tu pantalla de inicio</p>
                  </div>
                </div>

                <button onClick={() => setPaso(Math.min(paso + 1, 3))}
                  className="w-full mt-2 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl text-sm">
                  {paso < 3 ? 'Siguiente paso →' : 'Ya lo hice'}
                </button>

                {paso >= 3 && (
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <Check size={24} className="text-green-500 mx-auto mb-1" />
                    <p className="text-green-700 text-sm font-bold">¡Listo! Agrilux ya debería estar en tu pantalla de inicio</p>
                  </div>
                )}
              </div>
            ) : isIOS ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 text-center mb-2">iPhone · Safari</p>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Toca el botón de compartir (📤)</p>
                    <p className="text-xs text-gray-500">Parte inferior de la pantalla en Safari</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Selecciona "Agregar a pantalla de inicio"</p>
                    <p className="text-xs text-gray-500">Desplaza hacia abajo si no lo ves</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Toca "Agregar"</p>
                    <p className="text-xs text-gray-500">Agrilux aparecerá en tu pantalla de inicio</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">
                  Abre este sitio en <strong>Chrome</strong> (Android) o <strong>Safari</strong> (iPhone) para ver las instrucciones de instalación.
                </p>
              </div>
            )}
          </>
        )}

        <button onClick={onClose}
          className="w-full mt-5 bg-primary text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg">
          Cerrar
        </button>
      </div>
    </div>
  );
}
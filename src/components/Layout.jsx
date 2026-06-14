import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, ShieldCheck, LogOut, Menu, X, MapPin, Download } from 'lucide-react';
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
                    await triggerInstall();
                  } else {
                    // Manual instructions
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isAndroid = /Android/.test(navigator.userAgent);
                    if (isIOS) {
                      alert('Para instalar en iPhone:\n\n1. Toca el botón de compartir (📤) en Safari\n2. Selecciona "Agregar a pantalla de inicio"\n3. Toca "Agregar"\n\n¡Listo! Aparecerá en tu pantalla de inicio.');
                    } else if (isAndroid) {
                      alert('Para instalar en Android:\n\n1. Abre Chrome y ve a agrilux.com\n2. Toca los tres puntos (⋮) arriba a la derecha\n3. Selecciona "Instalar aplicación"\n4. Confirma tocando "Instalar"\n\n¡Listo! Aparecerá en tu pantalla de inicio.');
                    } else {
                      alert('Para instalar:\n\n1. Busca la opción "Instalar aplicación" o "Agregar a pantalla de inicio" en tu navegador\n2. Sigue las instrucciones en pantalla');
                    }
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
    </div>
  );
}
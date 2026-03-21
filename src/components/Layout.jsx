import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, ShoppingCart, Leaf, Users, MoreHorizontal, Home } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/diagnostico', icon: Camera, label: 'Diagnóstico' },
  { path: '/parcela', icon: Leaf, label: 'Mi Parcela' },
  { path: '/comunidad', icon: Users, label: 'Comunidad' },
  { path: '/mas', icon: MoreHorizontal, label: 'Más' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 shadow-lg z-50">
        <div className="flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-primary' : 'text-gray-400'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

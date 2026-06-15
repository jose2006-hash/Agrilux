import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import SelectorUbicacion from './components/SelectorUbicacion';
import { InstallPromptProvider } from './components/InstallPrompt';
import InstallScreen from './components/InstallScreen';
import Registro from './pages/Registro';
import Diagnostico from './pages/Diagnostico';
import Mercado from './pages/Mercado';
import Admin from './pages/Admin';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [plagaDetectada, setPlagaDetectada] = useState('');

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl">🌾</span>
        </div>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  );

  if (user && !user.ubicacion) {
    return <SelectorUbicacion esPrimeraVez={true} />;
  }

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />

      <Route path="*" element={
        !user ? <Registro /> : (
          <Layout>
            <Routes>
              <Route path="/" element={<Diagnostico onPlagaDetectada={setPlagaDetectada} />} />
              <Route path="/mercado" element={<Mercado plagaBuscada={plagaDetectada} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        )
      } />
    </Routes>
  );
}

export default function App() {
  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;
  const wasSkipped = localStorage.getItem('agrilux_install_dismissed');

  const [showInstall, setShowInstall] = useState(!isInstalled && !wasSkipped);

  if (showInstall) {
    return <InstallScreen onContinue={() => setShowInstall(false)} />;
  }

  return (
    <AuthProvider>
      <InstallPromptProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </InstallPromptProvider>
    </AuthProvider>
  );
}
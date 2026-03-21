import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';

import Registro from './pages/Registro';
import Home from './pages/Home';
import Mercado from './pages/Mercado';
import Diagnostico from './pages/Diagnostico';
import MiParcela from './pages/MiParcela';
import Comunidad from './pages/Comunidad';
import Mas from './pages/Mas';
import SaludFinanciera from './pages/SaludFinanciera';
import Admin from './pages/Admin';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <Routes>
      <Route path="*" element={<Registro />} />
    </Routes>
  );

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mercado" element={<Mercado />} />
        <Route path="/diagnostico" element={<Diagnostico />} />
        <Route path="/parcela" element={<MiParcela />} />
        <Route path="/comunidad" element={<Comunidad />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="/financiera" element={<SaludFinanciera />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

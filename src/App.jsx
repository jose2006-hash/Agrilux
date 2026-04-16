import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';

import Diagnostico from './pages/Diagnostico';
import Mercado from './pages/Mercado';
import MiParcela from './pages/MiParcela';

// Wrapper para pasar plaga detectada al mercado
function AppRoutes() {
  const [plagaDetectada, setPlagaDetectada] = useState('');

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Diagnostico onPlagaDetectada={setPlagaDetectada} />} />
        <Route path="/mercado" element={<Mercado plagaBuscada={plagaDetectada} />} />
        <Route path="/parcela" element={<MiParcela />} />
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
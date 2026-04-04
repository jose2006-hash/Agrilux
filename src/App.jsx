import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';

import Diagnostico from './pages/Diagnostico';
import Mercado from './pages/Mercado';
import MiParcela from './pages/MiParcela';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Diagnostico />} />
            <Route path="/mercado" element={<Mercado />} />
            <Route path="/parcela" element={<MiParcela />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
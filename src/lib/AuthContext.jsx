import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [marketUser, setMarketUser] = useState(null); // solo para marketplace

  useEffect(() => {
    const stored = localStorage.getItem('agrilux_market_user');
    if (stored) setMarketUser(JSON.parse(stored));
  }, []);

  // Registrar usuario del marketplace (agricultor o proveedor)
  const registerMarketUser = async (data) => {
    const docRef = await addDoc(collection(db, 'usuariosMercado'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
    const userData = { id: docRef.id, ...data };
    localStorage.setItem('agrilux_market_user', JSON.stringify(userData));
    setMarketUser(userData);
    return userData;
  };

  const logoutMarket = () => {
    localStorage.removeItem('agrilux_market_user');
    setMarketUser(null);
  };

  // user genérico para diagnóstico (sin registro)
  const user = {
    id: 'anonimo',
    nombre: marketUser?.nombre || 'Agricultor',
    ubicacion: marketUser?.ubicacion || 'Perú',
    tipo: marketUser?.tipo || 'agricultor',
    whatsapp: marketUser?.celular || '',
  };

  return (
    <AuthContext.Provider value={{ user, marketUser, registerMarketUser, logoutMarket }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
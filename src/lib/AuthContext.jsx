import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [marketUser, setMarketUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('agrilux_market_user');
    if (stored) setMarketUser(JSON.parse(stored));
  }, []);

  const registerMarketUser = async (data) => {
    const docRef = await addDoc(collection(db, 'usuariosMercado'), {
      ...data, createdAt: new Date().toISOString(),
    });
    const userData = { id: docRef.id, ...data };
    localStorage.setItem('agrilux_market_user', JSON.stringify(userData));
    setMarketUser(userData);
    return userData;
  };

  const loginMarketUser = async (celular, codigo) => {
    const q = query(collection(db, 'usuariosMercado'),
      where('celular', '==', celular.replace(/\D/g,'')),
      where('codigo', '==', codigo.toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Celular o código incorrecto');
    const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    localStorage.setItem('agrilux_market_user', JSON.stringify(userData));
    setMarketUser(userData);
    return userData;
  };

  // user genérico para diagnóstico (sin registro)
  const user = {
    id: marketUser?.id || 'anonimo',
    nombre: marketUser?.nombre || 'Agricultor',
    ubicacion: marketUser?.ubicacion || 'Perú',
    tipo: marketUser?.tipo || 'agricultor',
    whatsapp: marketUser?.celular || '',
  };

  return (
    <AuthContext.Provider value={{ user, marketUser, registerMarketUser, loginMarketUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
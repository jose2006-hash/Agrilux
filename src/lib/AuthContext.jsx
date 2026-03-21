import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, increment } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('agrilux_user');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = (userData) => {
    localStorage.setItem('agrilux_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('agrilux_user');
    setUser(null);
  };

  const registerUser = async (data) => {
    // Guardar en Firebase
    const docRef = await addDoc(collection(db, 'usuarios'), {
      ...data,
      createdAt: new Date().toISOString(),
      tipo: data.tipo || 'agricultor',
    });
    const userData = { id: docRef.id, ...data };
    login(userData);
    return userData;
  };

  const loginWithCode = async (whatsapp, code) => {
    // Buscar usuario por whatsapp y código
    const q = query(
      collection(db, 'usuarios'),
      where('whatsapp', '==', whatsapp),
      where('codigo', '==', code)
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Código incorrecto o número no registrado');
    const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    login(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerUser, loginWithCode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

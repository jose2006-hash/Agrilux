import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marketUser, setMarketUser] = useState(null);

  // ── Firebase Auth listener ──────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Cargar perfil desde Firestore
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        const perfil = snap.exists() ? snap.data() : {};
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, nombre: firebaseUser.displayName || perfil.nombre || '', ...perfil });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Marketplace user (proveedor/agricultor marketplace)
    const stored = localStorage.getItem('agrilux_market_user');
    if (stored) setMarketUser(JSON.parse(stored));

    return () => unsub();
  }, []);

  // ── Registro con email ──────────────────────────────────────
  const register = async ({ nombre, email, password }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    // Guardar en Firestore para entrenamiento IA
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre,
      email,
      createdAt: new Date().toISOString(),
      diagnosticos: [],
      cultivos: [],
    });
    setUser({ uid: cred.user.uid, email, nombre });
    return cred.user;
  };

  // ── Login con email ─────────────────────────────────────────
  const login = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  // ── Logout ──────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // ── Marketplace user (proveedor/agricultor de fungicidas) ───
  const registerMarketUser = async (data) => {
    const { addDoc } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, 'usuariosMercado'), {
      ...data, createdAt: new Date().toISOString(),
    });
    const userData = { id: docRef.id, ...data };
    localStorage.setItem('agrilux_market_user', JSON.stringify(userData));
    setMarketUser(userData);
    return userData;
  };

  const loginMarketUser = async (celular, codigo) => {
    const q = query(
      collection(db, 'usuariosMercado'),
      where('celular', '==', celular.replace(/\D/g, '')),
      where('codigo', '==', codigo.toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Celular o código incorrecto');
    const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    localStorage.setItem('agrilux_market_user', JSON.stringify(userData));
    setMarketUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, register, login, logout,
      marketUser, registerMarketUser, loginMarketUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
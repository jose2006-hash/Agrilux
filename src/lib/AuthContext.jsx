/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + contraseña
 * Login:    correo + contraseña
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        const perfil = snap.exists() ? snap.data() : {};
        setUser({
          uid:    firebaseUser.uid,
          email:  firebaseUser.email,
          nombre: firebaseUser.displayName || perfil.nombre || '',
          ...perfil,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Registro: nombre + email + contraseña ────────────────────────────────
  const register = async ({ nombre, email, password }) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: nombre.trim() });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:    nombre.trim(),
      email:     email.trim().toLowerCase(),
      rol:       'agricultor',
      creadoPor: 'self',
      createdAt: new Date().toISOString(),
    });
    setUser({ uid: cred.user.uid, email: email.trim(), nombre: nombre.trim(), rol: 'agricultor' });
    return cred.user;
  };

  // ── Login: email + contraseña ────────────────────────────────────────────
  const login = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + DNI
 * Login:    correo + DNI
 *
 * El DNI se usa internamente como contraseña en Firebase Auth.
 * El usuario nunca ve ni escucha la palabra "contraseña".
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

  // ── Registro: nombre + email + DNI ───────────────────────────────────────
  const register = async ({ nombre, email, dni }) => {
    // El DNI actúa como contraseña en Firebase (mínimo 6 chars — DNI tiene 8)
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), dni);
    await updateProfile(cred.user, { displayName: nombre.trim() });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:    nombre.trim(),
      email:     email.trim().toLowerCase(),
      dni,                          // guardamos el DNI para referencia
      rol:       'agricultor',
      creadoPor: 'self',
      createdAt: new Date().toISOString(),
    });
    setUser({ uid: cred.user.uid, email: email.trim(), nombre: nombre.trim(), dni, rol: 'agricultor' });
    return cred.user;
  };

  // ── Login: email + DNI ───────────────────────────────────────────────────
  const login = async ({ email, dni }) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), dni);
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
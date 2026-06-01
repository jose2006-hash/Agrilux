/**
 * src/lib/AuthContext.jsx
 *
 * Login solo con nombre completo (pruebas piloto).
 * Internamente genera un email sintético para Firebase Auth:
 *   "juan.perez.garcia@agrilux.app"
 * El usuario nunca ve ni necesita un email.
 *
 * Registro: nombre completo + contraseña
 * Login:    solo nombre completo (busca el email sintético en Firestore)
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
import {
  doc, setDoc, getDoc,
  collection, query, where, getDocs,
} from 'firebase/firestore';

const AuthContext = createContext();

// Convierte "Juan Pérez García" → "juan.perez.garcia@agrilux.app"
function nombreToEmail(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes
    .replace(/[^a-z0-9\s]/g, '')       // quita caracteres especiales
    .trim()
    .replace(/\s+/g, '.')              // espacios → puntos
    + '@agrilux.app';
}

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

  // ── Registro: nombre + contraseña ─────────────────────────────────────────
  const register = async ({ nombre, password }) => {
    if (!nombre?.trim()) throw { code: 'agrilux/nombre-requerido' };
    if (!password || password.length < 6) throw { code: 'auth/weak-password' };

    const emailSintetico = nombreToEmail(nombre.trim());

    // Verificar si ya existe ese nombre
    const q = query(collection(db, 'usuarios'), where('nombre', '==', nombre.trim()));
    const existe = await getDocs(q);
    if (!existe.empty) throw { code: 'agrilux/nombre-en-uso' };

    const cred = await createUserWithEmailAndPassword(auth, emailSintetico, password);
    await updateProfile(cred.user, { displayName: nombre.trim() });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:        nombre.trim(),
      emailSintetico,
      rol:           'agricultor',
      creadoPor:     'self',
      createdAt:     new Date().toISOString(),
    });
    setUser({ uid: cred.user.uid, nombre: nombre.trim(), rol: 'agricultor' });
    return cred.user;
  };

  // ── Login: solo nombre completo ───────────────────────────────────────────
  const login = async ({ nombre, password }) => {
    if (!nombre?.trim()) throw { code: 'agrilux/nombre-requerido' };

    // Buscar el emailSintético en Firestore por nombre exacto
    const q = query(
      collection(db, 'usuarios'),
      where('nombre', '==', nombre.trim())
    );
    const snap = await getDocs(q);
    if (snap.empty) throw { code: 'agrilux/usuario-no-encontrado' };

    const perfil = snap.docs[0].data();
    const emailSintetico = perfil.emailSintetico || nombreToEmail(nombre.trim());

    // En pruebas piloto: si el admin creó el usuario sin contraseña,
    // usamos una contraseña default que el admin conoce
    const passUsada = password || import.meta.env.VITE_PILOT_DEFAULT_PASS || 'agrilux2024';

    const cred = await signInWithEmailAndPassword(auth, emailSintetico, passUsada);
    return cred.user;
  };

  // ── Login por email sintético (uso interno del Admin) ─────────────────────
  const loginAdmin = async (claveAdmin) => {
    const claveCorrecta = import.meta.env.VITE_ADMIN_KEY;
    if (!claveCorrecta) throw new Error('VITE_ADMIN_KEY no configurada en .env');
    if (claveAdmin !== claveCorrecta) throw { code: 'agrilux/clave-incorrecta' };
    // El admin no necesita sesión Firebase — solo pasa la clave
    return true;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, loginAdmin, logout, nombreToEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
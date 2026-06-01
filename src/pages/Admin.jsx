/**
 * src/pages/Admin.jsx
 *
 * Acceso: protegido por VITE_ADMIN_KEY en .env
 * Solo tú (Lumajira SAC) puedes entrar.
 *
 * Funciones:
 *   - Ver todos los usuarios registrados
 *   - Agregar nuevos usuarios manualmente
 *   - Ver diagnósticos
 *   - Exportar dataset
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import JSZip from 'jszip';
import {
  Users, Camera, Download, RefreshCw, ChevronDown, ChevronUp,
  Search, X, MapPin, Phone, Calendar, TrendingUp, CloudUpload,
  CheckCircle, AlertCircle, Loader2, FolderOpen, ExternalLink,
  Plus, Eye, EyeOff, Lock, UserPlus, LogOut,
} from 'lucide-react';

// ─── Config ────────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DRIVE_FOLDER_NAME  = 'Agrilux-Dataset';
const DRIVE_SCOPE        = 'https://www.googleapis.com/auth/drive.file';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatFecha(val) {
  if (!val) return '—';
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof val === 'string') return new Date(val).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  return '—';
}

function serializarDoc(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v?.seconds) out[k] = new Date(v.seconds * 1000).toISOString();
    else if (Array.isArray(v)) out[k] = v;
    else if (v && typeof v === 'object') out[k] = serializarDoc(v);
    else out[k] = v ?? null;
  }
  return out;
}

function flattenCSV(obj, prefix = '') {
  return Object.keys(obj || {}).reduce((acc, key) => {
    const val = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(acc, flattenCSV(val, newKey));
    else if (Array.isArray(val)) acc[newKey] = val.join(' | ');
    else acc[newKey] = val ?? '';
    return acc;
  }, {});
}

function toCSV(data) {
  if (!data.length) return '';
  const flat = data.map(d => flattenCSV(serializarDoc(d)));
  const headers = [...new Set(flat.flatMap(Object.keys))];
  const rows = flat.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// Convierte nombre a email sintético (mismo que AuthContext)
function nombreToEmail(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    + '@agrilux.app';
}

// ─── Google Drive ──────────────────────────────────────────────────────────────
let driveToken = null;
async function obtenerTokenDrive() {
  return new Promise((resolve, reject) => {
    if (!window.google) { reject(new Error('Google SDK no cargado')); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: DRIVE_SCOPE,
      callback: (res) => { if (res.error) reject(new Error(res.error)); else { driveToken = res.access_token; resolve(res.access_token); } },
    });
    client.requestAccessToken({ prompt: driveToken ? '' : 'consent' });
  });
}
async function buscarOCrearCarpeta(token, nombre) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,webViewLink)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0];
  const crear = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder' }) });
  return await crear.json();
}
async function subirArchivoADrive(token, carpetaId, nombre, blob) {
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify({ name: nombre, parents: [carpetaId] })], { type: 'application/json' }));
  formData.append('file', blob);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  return await res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGIN ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginAdmin({ onAcceso }) {
  const [clave, setClave]     = useState('');
  const [verClave, setVer]    = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const intentar = async () => {
    setError('');
    const claveCorrecta = import.meta.env.VITE_ADMIN_KEY;
    if (!claveCorrecta) { setError('VITE_ADMIN_KEY no está configurada en .env'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400)); // pequeño delay anti-brute
    if (clave === claveCorrecta) {
      onAcceso();
    } else {
      setError('Clave incorrecta. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Panel Admin</h1>
          <p className="text-gray-500 text-xs mt-1">Agrilux · Lumajira SAC</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">Clave de administrador</label>
            <div className="relative">
              <input
                type={verClave ? 'text' : 'password'}
                value={clave}
                onChange={e => setClave(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && intentar()}
                placeholder="••••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600 pr-12"
              />
              <button onClick={() => setVer(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            onClick={intentar}
            disabled={loading || !clave}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"
          >
            {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Verificando...</span> : 'Entrar →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AGREGAR USUARIO
// ═══════════════════════════════════════════════════════════════════════════════
function ModalAgregarUsuario({ onCerrar, onAgregado }) {
  const { nombreToEmail } = useAuth();
  const [form, setForm]   = useState({ nombre: '', rol: 'agricultor', celular: '', ubicacion: '' });
  const [pass, setPass]   = useState('agrilux2024');
  const [verPass, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  const agregar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    setError('');
    try {
      // Crear en Firebase Auth vía fetch a la API REST
      // (no podemos usar createUserWithEmailAndPassword sin cerrar sesión admin)
      // Usamos Firestore directamente + guardamos los datos
      // El usuario podrá hacer login con su nombre la próxima vez
      const emailSintetico = nombreToEmail(form.nombre.trim());
      const uid = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      await setDoc(doc(db, 'usuarios', uid), {
        nombre:         form.nombre.trim(),
        emailSintetico,
        rol:            form.rol,
        celular:        form.celular || null,
        ubicacion:      form.ubicacion || null,
        passwordDefault: pass,   // el admin le da esta clave al agricultor
        creadoPor:      'admin',
        createdAt:      new Date().toISOString(),
      });

      onAgregado({ id: uid, ...form, emailSintetico, creadoPor: 'admin' });
      onCerrar();
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] p-6 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-800 text-lg">Agregar agricultor</h3>
          <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-red-600 text-sm">{error}</p></div>}

        {[
          { label: 'Nombre completo *', key: 'nombre', placeholder: 'Ej: Juan Pérez García' },
          { label: 'Celular / WhatsApp', key: 'celular', placeholder: 'Ej: 987654321' },
          { label: 'Ubicación / Distrito', key: 'ubicacion', placeholder: 'Ej: Cutervo, Cajamarca' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
            <input
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Rol</label>
          <select
            value={form.rol}
            onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            <option value="agricultor">🌾 Agricultor</option>
            <option value="agronomo">👨‍🔬 Agrónomo</option>
            <option value="tienda">🏪 Agroveterinaria</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Contraseña para el usuario</label>
          <div className="relative">
            <input
              type={verPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary pr-10"
            />
            <button onClick={() => setVer(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Dile esta clave al agricultor. Podrá ingresar con su nombre completo.</p>
        </div>

        {form.nombre.trim() && (
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-700 font-semibold">Vista previa de acceso:</p>
            <p className="text-xs text-green-600 mt-1">Nombre: <strong>{form.nombre}</strong></p>
            <p className="text-xs text-green-600">Contraseña: <strong>{pass}</strong></p>
          </div>
        )}

        <button
          onClick={agregar}
          disabled={loading || !form.nombre.trim()}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><UserPlus size={16} /> Agregar agricultor</>}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL ADMIN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function Admin() {
  const [autorizado, setAutorizado] = useState(false);
  const [tab, setTab]               = useState('usuarios');
  const [usuarios, setUsuarios]     = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [expandido, setExpandido]   = useState(null);
  const [modalAgregar, setModalAgregar] = useState(false);

  // Exportar
  const [exportState, setExportState]     = useState('idle');
  const [exportProgress, setExportProgress] = useState({ paso: '', porcentaje: 0, detalle: '' });
  const [driveLink, setDriveLink]         = useState('');
  const [exportError, setExportError]     = useState('');
  const [ultimaExport, setUltimaExport]   = useState(null);

  // Guardar autorización en sessionStorage para no pedir clave al refrescar
  useEffect(() => {
    if (sessionStorage.getItem('agrilux_admin') === 'ok') setAutorizado(true);
  }, []);

  const handleAcceso = () => {
    sessionStorage.setItem('agrilux_admin', 'ok');
    setAutorizado(true);
  };

  const handleSalir = () => {
    sessionStorage.removeItem('agrilux_admin');
    setAutorizado(false);
  };

  // Cargar datos en tiempo real
  useEffect(() => {
    if (!autorizado) return;
    setLoading(true);
    const unsubs = [];

    const cargar = (colName, setter) => {
      try {
        const q = query(collection(db, colName), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q,
          snap => { setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
          async () => {
            const snap = await getDocs(collection(db, colName)).catch(() => ({ docs: [] }));
            setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false);
          }
        );
        unsubs.push(unsub);
      } catch { setLoading(false); }
    };

    cargar('usuarios', setUsuarios);
    cargar('diagnosticos', setDiagnosticos);
    return () => unsubs.forEach(u => u());
  }, [autorizado]);

  // ── Exportar ────────────────────────────────────────────────────────────────
  const exportar = useCallback(async (destino) => {
    setExportState('preparando'); setExportError(''); setDriveLink('');
    try {
      const zip = new JSZip();
      const ahora = new Date();
      const fechaStr = ahora.toISOString().slice(0, 10);

      setExportProgress({ paso: '1/3', porcentaje: 20, detalle: 'Serializando datos...' });
      const diagSer  = diagnosticos.map(serializarDoc);
      const userSer  = usuarios.map(d => {
        // No exportar passwordDefault por seguridad
        const { passwordDefault, ...resto } = serializarDoc(d);
        return resto;
      });

      setExportProgress({ paso: '2/3', porcentaje: 60, detalle: 'Creando archivos...' });
      zip.file('dataset.json', JSON.stringify({ version: '1.0', exportado: ahora.toISOString(), usuarios: userSer, diagnosticos: diagSer }, null, 2));
      zip.file('usuarios.csv', '\uFEFF' + toCSV(userSer));
      zip.file('diagnosticos.csv', '\uFEFF' + toCSV(diagSer));

      const trainingLines = diagSer
        .filter(d => (d.pregunta || d.descripcion) && (d.resultado || d.respuesta))
        .map(d => JSON.stringify({
          messages: [
            { role: 'user', content: d.pregunta || d.descripcion || '' },
            { role: 'assistant', content: d.resultado || d.respuesta || '' },
          ],
        }));
      zip.file('training.jsonl', trainingLines.join('\n'));
      zip.file('README.md', `# Agrilux Dataset — ${fechaStr}\n\n- Usuarios: ${userSer.length}\n- Diagnósticos: ${diagSer.length}\n- Pares training: ${trainingLines.length}\n`);

      setExportProgress({ paso: '3/3', porcentaje: 80, detalle: 'Comprimiendo...' });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const nombreZip = `agrilux_dataset_${fechaStr}.zip`;

      if (destino === 'local') {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a'); a.href = url; a.download = nombreZip; a.click();
        URL.revokeObjectURL(url);
      } else {
        setExportProgress({ paso: '3/3', porcentaje: 85, detalle: 'Subiendo a Drive...' });
        if (!GOOGLE_CLIENT_ID) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en .env');
        const token = await obtenerTokenDrive();
        const carpeta = await buscarOCrearCarpeta(token, DRIVE_FOLDER_NAME);
        await subirArchivoADrive(token, carpeta.id, nombreZip, zipBlob);
        setDriveLink(carpeta.webViewLink || `https://drive.google.com/drive/folders/${carpeta.id}`);
      }

      setUltimaExport({ fecha: ahora.toISOString(), usuarios: userSer.length, diagnosticos: diagSer.length, pares: trainingLines.length });
      setExportProgress({ paso: '✓', porcentaje: 100, detalle: 'Exportación completada.' });
      setExportState('listo');
    } catch (err) {
      setExportError(err.message || 'Error al exportar');
      setExportState('error');
    }
  }, [diagnosticos, usuarios]);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter(u =>
    !busqueda || u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || u.ubicacion?.toLowerCase().includes(busqueda.toLowerCase())
  );
  const diagFiltrados = diagnosticos.filter(d =>
    !busqueda || d.cultivo?.toLowerCase().includes(busqueda.toLowerCase()) || (d.pregunta || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const enProceso = ['preparando', 'zipeando', 'subiendo_drive'].includes(exportState);

  if (!autorizado) return <LoginAdmin onAcceso={handleAcceso} />;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-50">
      <Loader2 size={28} className="animate-spin text-primary" />
      <p className="text-sm text-gray-500">Cargando datos...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {modalAgregar && (
        <ModalAgregarUsuario
          onCerrar={() => setModalAgregar(false)}
          onAgregado={u => setUsuarios(prev => [u, ...prev])}
        />
      )}

      {/* Header */}
      <div className="bg-gray-900 text-white px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">Panel Admin</p>
            <h1 className="text-xl font-bold">Agrilux · Lumajira SAC</h1>
          </div>
          <button onClick={handleSalir} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
            <LogOut size={14} /> Salir
          </button>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Usuarios', val: usuarios.length, emoji: '👥' },
            { label: 'Diagnósticos', val: diagnosticos.length, emoji: '🔬' },
            { label: 'Con IA', val: diagnosticos.filter(d => d.resultado?.tiene_problema !== undefined).length, emoji: '🤖' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-lg">{s.emoji}</p>
              <p className="text-lg font-bold">{s.val}</p>
              <p className="text-xs text-white/50">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          {[
            { id: 'usuarios', label: 'Usuarios', icon: Users },
            { id: 'diagnosticos', label: 'Diagnósticos', icon: Camera },
            { id: 'exportar', label: 'Exportar', icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setBusqueda(''); setExpandido(null); }}
              className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-semibold gap-0.5 transition-all ${tab === id ? 'bg-white text-gray-900' : 'text-white/60'}`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* ── USUARIOS ──────────────────────────────────────────────────────── */}
        {tab === 'usuarios' && (
          <>
            {/* Buscador + botón agregar */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
                <Search size={14} className="text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o ubicación..."
                  className="flex-1 py-2.5 text-sm outline-none" />
                {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
              </div>
              <button
                onClick={() => setModalAgregar(true)}
                className="bg-primary text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-bold shadow-sm">
                <Plus size={16} /> Agregar
              </button>
            </div>

            <p className="text-xs text-gray-400">{usuariosFiltrados.length} usuarios registrados</p>

            <div className="space-y-2">
              {usuariosFiltrados.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="text-gray-500 text-sm">No hay usuarios aún.</p>
                  <button onClick={() => setModalAgregar(true)}
                    className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                    + Agregar el primero
                  </button>
                </div>
              )}
              {usuariosFiltrados.map(u => (
                <div key={u.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-base font-bold text-green-700 flex-shrink-0">
                      {u.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{u.nombre || 'Sin nombre'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.rol === 'agronomo' ? 'bg-blue-100 text-blue-600'
                          : u.rol === 'tienda' ? 'bg-purple-100 text-purple-600'
                          : 'bg-green-100 text-green-600'
                        }`}>
                          {u.rol === 'agronomo' ? '👨‍🔬 Agrónomo' : u.rol === 'tienda' ? '🏪 Tienda' : '🌾 Agricultor'}
                        </span>
                        {u.creadoPor === 'admin' && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Admin</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-300">{formatFecha(u.createdAt)}</p>
                      {expandido === u.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {expandido === u.id && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: MapPin, label: 'Ubicación', val: u.ubicacion || '—' },
                          { icon: Phone, label: 'Celular', val: u.celular || '—' },
                          { icon: Calendar, label: 'Registro', val: formatFecha(u.createdAt) },
                          { icon: Users, label: 'Diagnósticos', val: diagnosticos.filter(d => d.userId === u.id).length },
                        ].map(({ icon: Icon, label, val }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1 mb-1"><Icon size={11} className="text-gray-400" /><p className="text-xs text-gray-400">{label}</p></div>
                            <p className="text-sm font-semibold text-gray-700 truncate">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Credenciales de acceso */}
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-blue-600 mb-1">🔑 Datos de acceso (solo tú ves esto)</p>
                        <p className="text-xs text-blue-700">Nombre: <strong>{u.nombre}</strong></p>
                        {u.passwordDefault && (
                          <p className="text-xs text-blue-700 mt-0.5">Contraseña: <strong>{u.passwordDefault}</strong></p>
                        )}
                      </div>

                      {u.celular && (
                        <a href={`https://wa.me/51${u.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold">
                          💬 Contactar por WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── DIAGNÓSTICOS ──────────────────────────────────────────────────── */}
        {tab === 'diagnosticos' && (
          <>
            <div className="flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
              <Search size={14} className="text-gray-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por cultivo o consulta..."
                className="flex-1 py-2.5 text-sm outline-none" />
              {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
            </div>
            <p className="text-xs text-gray-400">{diagFiltrados.length} diagnósticos</p>

            <div className="space-y-2">
              {diagFiltrados.map(d => {
                const autorNombre = usuarios.find(u => u.id === d.userId)?.nombre || d.userName || 'Desconocido';
                const res = d.resultado || {};
                return (
                  <div key={d.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button onClick={() => setExpandido(expandido === d.id ? null : d.id)}
                      className="w-full flex items-center gap-3 p-4 text-left">
                      <span className="text-2xl flex-shrink-0">
                        {d.cultivo === 'papa' ? '🥔' : d.cultivo === 'palta' ? '🥑' : d.cultivo === 'arandano' ? '🫐' : '🌿'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-800 capitalize">{d.cultivoNombre || d.cultivo || 'General'}</p>
                          {res.tiene_problema !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${res.tiene_problema ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {res.tiene_problema ? '⚠ ' + (res.gravedad || 'problema') : '✓ sano'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{autorNombre} · {res.nombre_problema || d.consultaTexto || '—'}</p>
                      </div>
                      <p className="text-xs text-gray-300 flex-shrink-0">{formatFecha(d.fecha || d.createdAt)}</p>
                    </button>

                    {expandido === d.id && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Agricultor</p>
                            <p className="text-sm font-semibold text-gray-700">{autorNombre}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-semibold text-gray-700">{formatFecha(d.fecha || d.createdAt)}</p>
                          </div>
                        </div>
                        {res.nombre_problema && (
                          <div className={`rounded-xl p-3 border ${res.gravedad === 'critica' || res.gravedad === 'grave' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                            <p className="text-xs font-bold text-gray-500 mb-1">Diagnóstico IA</p>
                            <p className="text-sm font-semibold text-gray-800">{res.nombre_problema}</p>
                            {res.nombre_cientifico && <p className="text-xs text-gray-500 italic">{res.nombre_cientifico}</p>}
                            <p className="text-xs text-gray-600 mt-1">{res.que_tiene}</p>
                          </div>
                        )}
                        {d.climaContexto && (
                          <div className="bg-blue-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-blue-600 mb-1">🌡 Contexto climático usado</p>
                            <p className="text-xs text-blue-700">{d.climaContexto}</p>
                          </div>
                        )}
                        {res.productos?.length > 0 && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-500 mb-2">💊 Productos recomendados</p>
                            {res.productos.slice(0, 2).map((p, i) => (
                              <p key={i} className="text-xs text-gray-600">• {p.nombre} — {p.dosis}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── EXPORTAR ──────────────────────────────────────────────────────── */}
        {tab === 'exportar' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-gray-900 to-green-950 rounded-2xl p-4 text-white">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-3">📊 Tu dataset actual</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '👥', val: usuarios.length, label: 'Usuarios' },
                  { emoji: '🔬', val: diagnosticos.length, label: 'Diagnósticos' },
                  { emoji: '🤖', val: diagnosticos.filter(d => (d.resultado?.nombre_problema || d.pregunta) && d.resultado?.que_hacer).length, label: 'Pares training' },
                  { emoji: '🌡', val: diagnosticos.filter(d => d.climaContexto).length, label: 'Con contexto clima' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-3">
                    <p className="text-xl">{s.emoji}</p>
                    <p className="text-xl font-bold mt-1">{s.val}</p>
                    <p className="text-xs text-white/50">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {enProceso && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 size={16} className="text-green-600 animate-spin" />
                  <p className="text-sm font-semibold text-gray-700">Exportando... {exportProgress.paso}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${exportProgress.porcentaje}%` }} />
                </div>
                <p className="text-xs text-gray-400">{exportProgress.detalle}</p>
              </div>
            )}

            {exportState === 'listo' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex gap-2 items-start">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">¡Exportación completa!</p>
                    {ultimaExport && <p className="text-xs text-green-600 mt-1">{ultimaExport.usuarios} usuarios · {ultimaExport.diagnosticos} diagnósticos · {ultimaExport.pares} pares training</p>}
                    {driveLink && <a href={driveLink} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-green-700 font-semibold"><FolderOpen size={13} /> Abrir en Google Drive <ExternalLink size={11} /></a>}
                  </div>
                </div>
              </div>
            )}

            {exportState === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex gap-2"><AlertCircle size={16} className="text-red-500" /><p className="text-sm text-red-700">{exportError}</p></div>
              </div>
            )}

            {!enProceso && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⬇ Descargar en tu dispositivo</p>
                  <button onClick={() => exportar('local')}
                    className="w-full bg-gray-900 text-white rounded-xl py-4 flex items-center gap-3 px-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📦</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Descargar ZIP</p>
                      <p className="text-xs text-white/50">JSON + CSV + JSONL training</p>
                    </div>
                    <Download size={18} className="text-white/60" />
                  </button>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">☁ Google Drive</p>
                  <button onClick={() => exportar('drive')}
                    className="w-full bg-blue-600 text-white rounded-xl py-4 flex items-center gap-3 px-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📁</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Subir a Google Drive</p>
                      <p className="text-xs text-white/50">Carpeta: Agrilux-Dataset/</p>
                    </div>
                    <CloudUpload size={18} className="text-white/60" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
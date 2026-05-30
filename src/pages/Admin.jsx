/**
 * Admin.jsx — Panel de administración Agrilux
 * 
 * DEPENDENCIAS NECESARIAS (instalar en tu proyecto):
 *   npm install jszip
 * 
 * CONFIGURACIÓN GOOGLE DRIVE:
 *   1. Ve a https://console.cloud.google.com/
 *   2. Crea un proyecto → habilita "Google Drive API"
 *   3. Crea credenciales OAuth 2.0 (tipo: Web application)
 *   4. Agrega tu dominio en "Authorized JavaScript origins"
 *   5. Copia el Client ID y ponlo en VITE_GOOGLE_CLIENT_ID en tu .env
 *   6. Agrega en index.html: <script src="https://accounts.google.com/gsi/client"></script>
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import JSZip from 'jszip';
import {
  Users, Camera, Leaf, MessageSquare, Download, RefreshCw,
  ChevronDown, ChevronUp, Search, X, FileJson, FileText,
  MapPin, Phone, Calendar, TrendingUp, CloudUpload, CheckCircle,
  AlertCircle, Loader2, Database, Image, FolderOpen, Zap,
  ExternalLink, Clock, Eye
} from 'lucide-react';

// ─── Config ────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'Agrilux-Dataset';

// ─── Helpers ───────────────────────────────────────────────────────
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

async function fetchImagenBlob(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// ─── Google Drive helpers ──────────────────────────────────────────
let driveToken = null;

async function obtenerTokenDrive() {
  return new Promise((resolve, reject) => {
    if (!window.google) { reject(new Error('Google SDK no cargado. Agrega el script en index.html')); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (res.error) reject(new Error(res.error));
        else { driveToken = res.access_token; resolve(res.access_token); }
      },
    });
    client.requestAccessToken({ prompt: driveToken ? '' : 'consent' });
  });
}

async function buscarOCrearCarpeta(token, nombreCarpeta) {
  // Buscar carpeta existente
  const buscarRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${nombreCarpeta}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,webViewLink)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const buscarData = await buscarRes.json();
  if (buscarData.files?.length > 0) return buscarData.files[0];

  // Crear nueva carpeta
  const crearRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombreCarpeta, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return await crearRes.json();
}

async function subirArchivoADrive(token, carpetaId, nombreArchivo, blob, mimeType) {
  const metadata = { name: nombreArchivo, parents: [carpetaId] };
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
  );
  return await res.json();
}

// ─── Componente principal ─────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState({ usuarios: 0, diagnosticos: 0, parcelas: 0, comunidad: 0 });
  const [usuarios, setUsuarios] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [parcelas, setParcelas] = useState([]);
  const [comunidad, setComunidad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState(null);

  // Estados de exportación
  const [exportState, setExportState] = useState('idle'); // idle | preparando | descargando_imgs | zipeando | subiendo_drive | listo | error
  const [exportProgress, setExportProgress] = useState({ paso: '', porcentaje: 0, detalle: '' });
  const [driveLink, setDriveLink] = useState('');
  const [exportError, setExportError] = useState('');
  const [ultimaExport, setUltimaExport] = useState(null);

  // Listener en tiempo real de Firestore
  useEffect(() => {
    setLoading(true);
    const unsubs = [];

    const cargarColeccion = (colName, setter, statKey) => {
      const q = query(collection(db, colName), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setter(data);
          setStats(prev => ({ ...prev, [statKey]: snap.size }));
        },
        // Fallback sin orderBy si falla el índice
        async () => {
          const snap = await getDocs(collection(db, colName)).catch(() => ({ docs: [], size: 0 }));
          const data = snap.docs?.map(d => ({ id: d.id, ...d.data() })) || [];
          setter(data);
          setStats(prev => ({ ...prev, [statKey]: data.length }));
        }
      );
      unsubs.push(unsub);
    };

    cargarColeccion('usuarios', setUsuarios, 'usuarios');
    cargarColeccion('diagnosticos', setDiagnosticos, 'diagnosticos');
    cargarColeccion('parcelas', setParcelas, 'parcelas');
    cargarColeccion('comunidad', setComunidad, 'comunidad');
    setLoading(false);

    return () => unsubs.forEach(u => u());
  }, []);

  // ─── Función de exportación principal ───────────────────────────
  const exportarCompleto = useCallback(async (destino) => {
    setExportState('preparando');
    setExportError('');
    setDriveLink('');

    try {
      const zip = new JSZip();
      const imgFolder = zip.folder('imagenes');
      const ahora = new Date();
      const fechaStr = ahora.toISOString().slice(0, 10);

      // ── PASO 1: Serializar todos los datos ──────────────────────
      setExportProgress({ paso: '1/4', porcentaje: 10, detalle: 'Preparando datos de Firestore...' });

      const diagSerializados = diagnosticos.map(serializarDoc);
      const usuariosSerializados = usuarios.map(serializarDoc);
      const parcelasSerializadas = parcelas.map(serializarDoc);
      const comunidadSerializada = comunidad.map(serializarDoc);

      // ── PASO 2: Descargar imágenes ──────────────────────────────
      setExportState('descargando_imgs');
      const imagenesURLs = diagnosticos
        .filter(d => d.imagenUrl || d.imagen || d.imageUrl)
        .map(d => ({ id: d.id, url: d.imagenUrl || d.imagen || d.imageUrl, cultivo: d.cultivo || 'sin_cultivo' }));

      const imagenesDescargadas = [];
      for (let i = 0; i < imagenesURLs.length; i++) {
        const item = imagenesURLs[i];
        setExportProgress({
          paso: '2/4',
          porcentaje: 10 + Math.round((i / Math.max(imagenesURLs.length, 1)) * 40),
          detalle: `Descargando imagen ${i + 1} de ${imagenesURLs.length} (${item.cultivo})...`
        });
        const blob = await fetchImagenBlob(item.url);
        if (blob) {
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          const nombreArchivo = `${item.cultivo}_${item.id}.${ext}`;
          imgFolder.file(nombreArchivo, blob);
          imagenesDescargadas.push({ diagId: item.id, archivo: nombreArchivo, tamaño: blob.size });
        }
      }

      // ── PASO 3: Crear archivos del dataset ─────────────────────
      setExportState('zipeando');
      setExportProgress({ paso: '3/4', porcentaje: 55, detalle: 'Armando dataset completo...' });

      // dataset.json — todo
      const dataset = {
        version: '1.0',
        exportado: ahora.toISOString(),
        app: 'Agrilux',
        resumen: {
          total_usuarios: usuariosSerializados.length,
          total_diagnosticos: diagSerializados.length,
          total_parcelas: parcelasSerializadas.length,
          total_comunidad: comunidadSerializada.length,
          diagnosticos_con_imagen: imagenesDescargadas.length,
          pares_entrenamiento: diagSerializados.filter(d => (d.pregunta || d.descripcion) && (d.resultado || d.respuesta)).length,
        },
        usuarios: usuariosSerializados,
        diagnosticos: diagSerializados,
        parcelas: parcelasSerializadas,
        comunidad: comunidadSerializada,
        imagenes_descargadas: imagenesDescargadas,
      };
      zip.file('dataset.json', JSON.stringify(dataset, null, 2));

      // training.jsonl — formato fine-tuning (JSONL = 1 objeto por línea)
      const trainingLines = diagSerializados
        .filter(d => (d.pregunta || d.descripcion || d.input) && (d.resultado || d.respuesta || d.output))
        .map(d => JSON.stringify({
          messages: [
            {
              role: 'user',
              content: [
                d.pregunta || d.descripcion || d.input || '',
                d.cultivo ? `[Cultivo: ${d.cultivo}]` : '',
                d.ubicacion ? `[Ubicación: ${d.ubicacion}]` : '',
              ].filter(Boolean).join('\n')
            },
            {
              role: 'assistant',
              content: d.resultado || d.respuesta || d.output || ''
            }
          ],
          metadata: {
            id: d.id,
            cultivo: d.cultivo || null,
            tiene_imagen: imagenesDescargadas.some(img => img.diagId === d.id),
            imagen_archivo: imagenesDescargadas.find(img => img.diagId === d.id)?.archivo || null,
            fecha: d.createdAt || null,
            usuario_id: d.usuarioId || d.userId || null,
          }
        }));
      zip.file('training_finetuning.jsonl', trainingLines.join('\n'));

      // training_openai.jsonl — formato compatible OpenAI fine-tuning
      const openaiLines = diagSerializados
        .filter(d => (d.pregunta || d.descripcion) && (d.resultado || d.respuesta))
        .map(d => JSON.stringify({
          messages: [
            { role: 'system', content: 'Eres un experto agrónomo especializado en cultivos peruanos. Diagnostica plagas, enfermedades y malezas.' },
            { role: 'user', content: d.pregunta || d.descripcion || '' },
            { role: 'assistant', content: d.resultado || d.respuesta || '' }
          ]
        }));
      zip.file('training_openai_format.jsonl', openaiLines.join('\n'));

      // CSVs
      zip.file('usuarios.csv', '\uFEFF' + toCSV(usuariosSerializados));
      zip.file('diagnosticos.csv', '\uFEFF' + toCSV(diagSerializados));
      if (parcelasSerializadas.length) zip.file('parcelas.csv', '\uFEFF' + toCSV(parcelasSerializadas));

      // README
      const readme = `# Agrilux Dataset — ${fechaStr}

## Contenido
- **dataset.json** — Todos los datos de la app (usuarios, diagnósticos, parcelas, comunidad)
- **training_finetuning.jsonl** — Pares input/output para fine-tuning (formato Anthropic/genérico)
- **training_openai_format.jsonl** — Mismos datos en formato OpenAI fine-tuning
- **usuarios.csv** / **diagnosticos.csv** — Para análisis en Excel/Sheets
- **imagenes/** — Fotos de cultivos subidas por usuarios (${imagenesDescargadas.length} imágenes)

## Estadísticas
- Usuarios: ${usuariosSerializados.length}
- Diagnósticos: ${diagSerializados.length}
- Pares de entrenamiento válidos: ${trainingLines.length}
- Imágenes descargadas: ${imagenesDescargadas.length}

## Uso para fine-tuning
### Anthropic Claude
Sube \`training_finetuning.jsonl\` al proceso de fine-tuning de Anthropic.

### OpenAI
Sube \`training_openai_format.jsonl\` a platform.openai.com/fine-tuning

### Hugging Face
Carga \`dataset.json\` con datasets.load_dataset('json', data_files='dataset.json')
`;
      zip.file('README.md', readme);

      setExportProgress({ paso: '3/4', porcentaje: 75, detalle: 'Comprimiendo ZIP...' });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const nombreZip = `agrilux_dataset_${fechaStr}.zip`;

      // ── PASO 4: Destino ─────────────────────────────────────────
      if (destino === 'local') {
        setExportProgress({ paso: '4/4', porcentaje: 95, detalle: 'Descargando ZIP...' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a'); a.href = url; a.download = nombreZip; a.click();
        URL.revokeObjectURL(url);
      }

      if (destino === 'drive') {
        setExportState('subiendo_drive');
        setExportProgress({ paso: '4/4', porcentaje: 80, detalle: 'Autorizando Google Drive...' });

        if (!GOOGLE_CLIENT_ID) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en tu .env — ver instrucciones arriba del archivo');
        const token = await obtenerTokenDrive();

        setExportProgress({ paso: '4/4', porcentaje: 85, detalle: `Buscando carpeta "${DRIVE_FOLDER_NAME}"...` });
        const carpeta = await buscarOCrearCarpeta(token, DRIVE_FOLDER_NAME);

        setExportProgress({ paso: '4/4', porcentaje: 90, detalle: `Subiendo ${nombreZip} (${(zipBlob.size / 1024 / 1024).toFixed(1)} MB)...` });
        const archivo = await subirArchivoADrive(token, carpeta.id, nombreZip, zipBlob, 'application/zip');

        const linkCarpeta = carpeta.webViewLink || `https://drive.google.com/drive/folders/${carpeta.id}`;
        setDriveLink(linkCarpeta);
      }

      const resumen = {
        fecha: ahora.toISOString(),
        diagnosticos: diagSerializados.length,
        imagenes: imagenesDescargadas.length,
        pares_training: trainingLines.length,
        tamaño_mb: (zipBlob.size / 1024 / 1024).toFixed(2),
        destino,
      };
      setUltimaExport(resumen);
      setExportProgress({ paso: '✓', porcentaje: 100, detalle: 'Exportación completada exitosamente.' });
      setExportState('listo');

    } catch (err) {
      console.error('Error exportando:', err);
      setExportError(err.message || 'Error desconocido al exportar');
      setExportState('error');
    }
  }, [diagnosticos, usuarios, parcelas, comunidad]);

  // ─── Filtros ─────────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter(u =>
    !busqueda ||
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.ubicacion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const diagFiltrados = diagnosticos.filter(d =>
    !busqueda ||
    d.cultivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.pregunta || d.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const enProceso = ['preparando', 'descargando_imgs', 'zipeando', 'subiendo_drive'].includes(exportState);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Cargando datos en tiempo real...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-gray-900 text-white px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">Panel Admin</p>
            <h1 className="text-xl font-bold">Agrilux</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">En tiempo real</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-white/10 rounded-xl p-1">
          {[
            { id: 'dashboard', label: 'Resumen', icon: TrendingUp },
            { id: 'usuarios', label: 'Usuarios', icon: Users },
            { id: 'diagnosticos', label: 'Diagnósticos', icon: Camera },
            { id: 'exportar', label: 'Exportar', icon: Download },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setBusqueda(''); setExpandido(null); }}
              className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-all gap-0.5 ${tab === id ? 'bg-white text-gray-900' : 'text-white/60'}`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* ── DASHBOARD ────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Usuarios', value: stats.usuarios, emoji: '👥', color: 'bg-blue-500' },
                { label: 'Diagnósticos', value: stats.diagnosticos, emoji: '🔬', color: 'bg-green-600' },
                { label: 'Parcelas', value: stats.parcelas, emoji: '🌱', color: 'bg-emerald-500' },
                { label: 'Posts', value: stats.comunidad, emoji: '💬', color: 'bg-purple-500' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className={`${s.color} w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2`}>{s.emoji}</div>
                  <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Stats de entrenamiento */}
            <div className="bg-gradient-to-br from-green-900 to-gray-900 rounded-2xl p-4 text-white">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-3">🤖 Dataset para IA</p>
              {[
                { label: 'Pares válidos para training', val: diagnosticos.filter(d => (d.pregunta || d.descripcion) && (d.resultado || d.respuesta)).length, color: 'text-green-400' },
                { label: 'Diagnósticos con imagen', val: diagnosticos.filter(d => d.imagenUrl || d.imagen || d.imageUrl).length, color: 'text-blue-400' },
                { label: 'Sin respuesta (incompletos)', val: diagnosticos.filter(d => !d.resultado && !d.respuesta).length, color: 'text-yellow-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
                  <p className="text-xs text-white/60">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
              <button onClick={() => setTab('exportar')}
                className="mt-3 w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
                <Download size={14} /> Exportar dataset completo
              </button>
            </div>

            {/* Últimos diagnósticos */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Últimos diagnósticos</p>
              {diagnosticos.slice(0, 6).map(d => (
                <div key={d.id} className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0 items-center">
                  <span className="text-xl">
                    {d.cultivo === 'papa' ? '🥔' : d.cultivo === 'palta' ? '🥑' : d.cultivo === 'arandano' ? '🫐' : '🌿'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{d.cultivo || 'Sin cultivo'}</p>
                    <p className="text-xs text-gray-400 truncate">{d.pregunta || d.descripcion || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs text-gray-300">{formatFecha(d.createdAt)}</p>
                    {(d.imagenUrl || d.imagen) && <span className="text-xs bg-blue-100 text-blue-500 px-1.5 rounded">📷</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── USUARIOS ─────────────────────────────────────────── */}
        {tab === 'usuarios' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
                <Search size={14} className="text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar usuario..."
                  className="flex-1 py-2.5 text-sm outline-none" />
                {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
              </div>
            </div>
            <p className="text-xs text-gray-400">{usuariosFiltrados.length} usuarios</p>
            <div className="space-y-2">
              {usuariosFiltrados.map(u => (
                <div key={u.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-base font-bold text-green-700 flex-shrink-0">
                      {u.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{u.nombre || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    {expandido === u.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {expandido === u.id && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: MapPin, label: 'Ubicación', val: u.ubicacion || u.region || '—' },
                          { icon: Phone, label: 'WhatsApp', val: u.whatsapp || '—' },
                          { icon: Leaf, label: 'Tipo', val: u.tipo || u.rol || '—' },
                          { icon: Calendar, label: 'Registro', val: formatFecha(u.createdAt) },
                        ].map(({ icon: Icon, label, val }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1 mb-1"><Icon size={11} className="text-gray-400" /><p className="text-xs text-gray-400">{label}</p></div>
                            <p className="text-sm font-semibold text-gray-700 truncate">{val}</p>
                          </div>
                        ))}
                      </div>
                      {/* Todos los campos extra */}
                      {Object.entries(u).filter(([k]) => !['id','nombre','email','whatsapp','phone','ubicacion','region','tipo','rol','createdAt','updatedAt'].includes(k)).length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                          <p className="text-xs text-gray-400 font-semibold mb-2">Campos adicionales</p>
                          {Object.entries(u).filter(([k]) => !['id','nombre','email','whatsapp','phone','ubicacion','region','tipo','rol','createdAt','updatedAt'].includes(k))
                            .map(([k, v]) => (
                            <div key={k} className="flex gap-2 text-xs">
                              <span className="text-gray-400 font-medium flex-shrink-0">{k}:</span>
                              <span className="text-gray-600 break-all">{typeof v === 'object' ? JSON.stringify(v).slice(0,100) : String(v ?? '').slice(0,150)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {u.whatsapp && (
                        <a href={`https://wa.me/51${u.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold">
                          💬 Contactar
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── DIAGNÓSTICOS ─────────────────────────────────────── */}
        {tab === 'diagnosticos' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
                <Search size={14} className="text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar diagnóstico..." className="flex-1 py-2.5 text-sm outline-none" />
                {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
              </div>
            </div>
            <p className="text-xs text-gray-400">{diagFiltrados.length} diagnósticos · {diagFiltrados.filter(d=>d.imagenUrl||d.imagen).length} con imagen</p>
            <div className="space-y-2">
              {diagFiltrados.map(d => (
                <div key={d.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandido(expandido === d.id ? null : d.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <span className="text-2xl flex-shrink-0">
                      {d.cultivo === 'papa' ? '🥔' : d.cultivo === 'palta' ? '🥑' : d.cultivo === 'arandano' ? '🫐' : '🌿'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-800 capitalize">{d.cultivo || 'General'}</p>
                        {(d.imagenUrl || d.imagen) && <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-md">📷</span>}
                        {(d.resultado || d.respuesta) && <span className="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-md">✓ IA</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{d.pregunta || d.descripcion || '—'}</p>
                    </div>
                    <p className="text-xs text-gray-300 flex-shrink-0">{formatFecha(d.createdAt)}</p>
                  </button>
                  {expandido === d.id && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                      {(d.imagenUrl || d.imagen || d.imageUrl) && (
                        <img src={d.imagenUrl || d.imagen || d.imageUrl} alt="cultivo" className="w-full max-h-52 object-cover rounded-xl" />
                      )}
                      {(d.pregunta || d.descripcion) && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-semibold mb-1">Consulta</p>
                          <p className="text-sm text-gray-700">{d.pregunta || d.descripcion}</p>
                        </div>
                      )}
                      {(d.resultado || d.respuesta) && (
                        <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                          <p className="text-xs text-green-600 font-semibold mb-1">Respuesta IA</p>
                          <p className="text-sm text-gray-700 line-clamp-5">{d.resultado || d.respuesta}</p>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 font-semibold mb-2">Todos los campos ({Object.keys(d).length})</p>
                        <div className="space-y-1">
                          {Object.entries(d).filter(([k]) => k !== 'id').map(([k,v]) => (
                            <div key={k} className="flex gap-2 text-xs">
                              <span className="text-gray-400 font-medium flex-shrink-0 min-w-20">{k}:</span>
                              <span className="text-gray-600 break-all">
                                {v?.seconds ? formatFecha(v) : typeof v === 'object' ? JSON.stringify(v).slice(0,120) : String(v??'').slice(0,200)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── EXPORTAR ─────────────────────────────────────────── */}
        {tab === 'exportar' && (
          <div className="space-y-4">

            {/* Stats dataset */}
            <div className="bg-gradient-to-br from-gray-900 to-green-950 rounded-2xl p-4 text-white">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-3">📊 Tu dataset actual</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '🔬', val: stats.diagnosticos, label: 'Diagnósticos' },
                  { emoji: '📷', val: diagnosticos.filter(d=>d.imagenUrl||d.imagen||d.imageUrl).length, label: 'Con imagen' },
                  { emoji: '🤖', val: diagnosticos.filter(d=>(d.pregunta||d.descripcion)&&(d.resultado||d.respuesta)).length, label: 'Pares training' },
                  { emoji: '👥', val: stats.usuarios, label: 'Usuarios' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-3">
                    <p className="text-xl">{s.emoji}</p>
                    <p className="text-xl font-bold mt-1">{s.val}</p>
                    <p className="text-xs text-white/50">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Barra de progreso (durante exportación) */}
            {enProceso && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 size={16} className="text-green-600 animate-spin" />
                  <p className="text-sm font-semibold text-gray-700">Exportando... paso {exportProgress.paso}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${exportProgress.porcentaje}%` }} />
                </div>
                <p className="text-xs text-gray-400">{exportProgress.detalle}</p>
              </div>
            )}

            {/* Resultado exitoso */}
            {exportState === 'listo' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex gap-2 items-start">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">¡Exportación completa!</p>
                    {ultimaExport && (
                      <p className="text-xs text-green-600 mt-1">
                        {ultimaExport.diagnosticos} diagnósticos · {ultimaExport.imagenes} imágenes · {ultimaExport.pares_training} pares training · {ultimaExport.tamaño_mb} MB
                      </p>
                    )}
                    {driveLink && (
                      <a href={driveLink} target="_blank" rel="noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                        <FolderOpen size={13} /> Abrir carpeta en Google Drive
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {exportState === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Error en la exportación</p>
                    <p className="text-xs text-red-500 mt-1">{exportError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de exportación */}
            {!enProceso && (
              <>
                {/* Descargar ZIP local */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⬇ Descargar en tu dispositivo</p>
                  <button onClick={() => exportarCompleto('local')}
                    className="w-full bg-gray-900 text-white rounded-xl py-4 flex items-center gap-3 px-4 active:scale-98 transition-all">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📦</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Descargar ZIP completo</p>
                      <p className="text-xs text-white/50">JSON + JSONL + CSV + todas las imágenes</p>
                    </div>
                    <Download size={18} className="text-white/60" />
                  </button>
                </div>

                {/* Subir a Google Drive */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">☁ Sincronizar a Google Drive</p>
                  <p className="text-xs text-gray-400 mb-3">Se guarda en carpeta <strong>Agrilux-Dataset/</strong> de tu Drive. Desde ahí puedes conectar a Colab, Vertex AI, etc.</p>
                  <button onClick={() => exportarCompleto('drive')}
                    className="w-full bg-blue-600 text-white rounded-xl py-4 flex items-center gap-3 px-4 active:scale-98 transition-all">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📁</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Subir a Google Drive</p>
                      <p className="text-xs text-white/50">Requiere autorizar acceso a Drive</p>
                    </div>
                    <CloudUpload size={18} className="text-white/60" />
                  </button>
                  {!GOOGLE_CLIENT_ID && (
                    <div className="mt-2 bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-amber-700 font-semibold">⚠ Configuración requerida</p>
                      <p className="text-xs text-amber-600 mt-1">Agrega <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> en tu .env. Ver instrucciones al inicio del archivo.</p>
                    </div>
                  )}
                </div>

                {/* Contenido del ZIP */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">📂 Contenido del ZIP</p>
                  {[
                    { archivo: 'dataset.json', desc: 'Todo: usuarios + diagnósticos + parcelas + comunidad', icon: '🗂' },
                    { archivo: 'training_finetuning.jsonl', desc: 'Pares input/output — formato Anthropic/genérico', icon: '🤖' },
                    { archivo: 'training_openai_format.jsonl', desc: 'Mismo dataset — formato OpenAI fine-tuning', icon: '⚡' },
                    { archivo: 'diagnosticos.csv', desc: 'Tabla de diagnósticos para Excel/Sheets', icon: '📊' },
                    { archivo: 'usuarios.csv', desc: 'Tabla de usuarios registrados', icon: '👥' },
                    { archivo: 'imagenes/', desc: `Fotos de cultivos (${diagnosticos.filter(d=>d.imagenUrl||d.imagen).length} imágenes)`, icon: '📷' },
                    { archivo: 'README.md', desc: 'Instrucciones de uso para fine-tuning', icon: '📋' },
                  ].map(item => (
                    <div key={item.archivo} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-xs font-mono font-semibold text-gray-700">{item.archivo}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
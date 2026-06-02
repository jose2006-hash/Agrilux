import React, { useState, useEffect } from 'react';
import { Loader2, Star } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function TiendasConProducto({ productoBuscado, onCerrar, ubicacionUsuario = '' }) {
  const [tiendas, setTiendas] = useState([]);
  const [tiendasLocales, setTiendasLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { buscarProductoEnTiendas(); }, [productoBuscado]);

  const buscarProductoEnTiendas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const palabrasClave = productoBuscado.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      const coincidentes = todos.filter(p => {
        const nombreProd = (p.nombre || '').toLowerCase();
        const plagasProd = (p.plagasQueControla || '').toLowerCase();
        return palabrasClave.some(pc =>
          nombreProd.includes(pc) ||
          plagasProd.includes(pc) ||
          pc.includes(nombreProd.split(' ')[0])
        );
      });

      const tiendasSnap = await getDocs(collection(db, 'tiendas'));
      const tiendasMap = {};
      tiendasSnap.docs.forEach(d => { tiendasMap[d.id] = { id: d.id, ...d.data() }; });

      const resultado = coincidentes
        .filter(prod => tiendasMap[prod.tiendaId] && prod.disponible)
        .map(prod => ({ ...prod, tiendaInfo: tiendasMap[prod.tiendaId] }))
        .sort((a, b) => (parseFloat(a.precio) || 9999) - (parseFloat(b.precio) || 9999));

      setTiendas(resultado);

      const u = (ubicacionUsuario || '').trim().toLowerCase();
      if (u) {
        const tokens = u.split(/[,\\s]+/).filter(t => t.length > 2);
        const locales = resultado.filter(prod => {
          const tUb = (prod.tiendaInfo?.ubicacion || '').toLowerCase();
          return tokens.some(tok => tUb.includes(tok));
        });
        setTiendasLocales(locales);
      } else {
        setTiendasLocales([]);
      }
    } catch (e) {
      setTiendas([]);
      setTiendasLocales([]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] mx-auto max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-gray-800">🛡️ {productoBuscado}</h3>
              <p className="text-xs text-gray-500">Tiendas disponibles ordenadas por precio</p>
            </div>
            <button onClick={onCerrar}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">✕</button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-gray-500">Buscando en tiendas registradas...</p>
            </div>
          ) : tiendas.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🏪</p>
              <p className="font-bold text-gray-700">No encontramos este producto</p>
              <button onClick={() => { navigate('/mercado'); onCerrar(); }}
                className="bg-primary text-white font-bold px-6 py-3 rounded-2xl text-sm mt-4">
                Ver todas las tiendas →
              </button>
            </div>
          ) : (
            <>
              {!!ubicacionUsuario?.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <p className="text-xs font-bold text-blue-700">
                    📍 Buscando tiendas cerca de: {ubicacionUsuario}
                  </p>
                  {tiendasLocales.length === 0 ? (
                    <p className="text-xs text-blue-700/80 mt-1">
                      No encontramos tiendas locales con este producto. Te muestro igual las tiendas disponibles.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-700/80 mt-1">
                      Encontramos {tiendasLocales.length} opción(es) cerca. Te las muestro primero.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                <Star size={16} className="text-green-600 fill-green-600" />
                <p className="text-xs font-bold text-green-700">
                  Mejor precio: {tiendas[0].tiendaInfo?.empresa} — S/ {tiendas[0].precio}
                </p>
              </div>

              {(tiendasLocales.length > 0 ? tiendasLocales : tiendas).map((prod, idx) => (
                <div key={prod.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${idx === 0 ? 'border-primary' : 'border-gray-100'}`}>
                  {idx === 0 && (
                    <span className="text-xs bg-primary text-white font-bold px-2.5 py-1 rounded-full mb-2 inline-block">
                      ⭐ Mejor precio
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{prod.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">🏪 {prod.tiendaInfo?.empresa}</p>
                      <p className="text-xs text-gray-400">📍 {prod.tiendaInfo?.ubicacion}</p>
                      {prod.plagasQueControla && <p className="text-xs text-red-500 mt-1">🐛 {prod.plagasQueControla}</p>}
                      {prod.uso && <p className="text-xs text-gray-500 mt-0.5">💊 {prod.uso}</p>}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-primary">S/ {prod.precio}</p>
                      <p className="text-xs text-gray-400">por unidad</p>
                    </div>
                  </div>
                  {prod.tiendaInfo?.celular && (
                    <div className="mt-3">
                      <a
                        href={`https://wa.me/51${prod.tiendaInfo.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi en AGRILUX que tienen ${prod.nombre}. ¿Está disponible?`)}`}
                        target="_blank" rel="noreferrer"
                        className="block text-center bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl">
                        📲 Consultar por WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

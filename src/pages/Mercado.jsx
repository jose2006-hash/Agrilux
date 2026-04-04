import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS, WHATSAPP } from '../lib/constants';

const FUNGICIDAS = [
  {
    id: 1,
    nombre: 'Fungicida Cúprico',
    descripcion: 'Controla hongos y bacterias en hojas y frutos',
    cultivos: ['papa', 'tomate', 'cebolla', 'maiz'],
    uso: 'Diluir 2-3 g/litro de agua. Aplicar cada 7-10 días.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'],
  },
  {
    id: 2,
    nombre: 'Mancozeb 80% WP',
    descripcion: 'Fungicida de contacto para tizón tardío (rancha) en papa',
    cultivos: ['papa'],
    uso: 'Diluir 2 g/litro. Aplicar preventivamente cada 7 días.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'],
  },
  {
    id: 3,
    nombre: 'Metalaxil + Mancozeb',
    descripcion: 'Doble acción sistémica y de contacto. Ideal para Phytophthora.',
    cultivos: ['papa', 'tomate'],
    uso: 'Diluir 2.5 g/litro. Aplicar cada 10-14 días.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Cutervo', 'Lima'],
  },
  {
    id: 4,
    nombre: 'Propineb 70% WP',
    descripcion: 'Control de manchas foliares y mildiu en hortalizas',
    cultivos: ['tomate', 'cebolla', 'lechuga'],
    uso: 'Diluir 2 g/litro. Aplicar cada 7 días.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Lima', 'Cajamarca'],
  },
  {
    id: 5,
    nombre: 'Azoxystrobin 25% SC',
    descripcion: 'Fungicida sistémico de amplio espectro para cereales y frutales',
    cultivos: ['arroz', 'maiz', 'palta', 'cafe', 'cacao'],
    uso: 'Diluir 1 ml/litro. Aplicar cada 14-21 días.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Lima'],
  },
  {
    id: 6,
    nombre: 'Tebuconazol 25% EW',
    descripcion: 'Control de roya y oidio en frutales y cultivos comerciales',
    cultivos: ['cafe', 'cacao', 'palta', 'mango', 'aji'],
    uso: 'Diluir 0.5-1 ml/litro. Aplicar cada 14 días.',
    certificada: true,
    disponible: false,
    ubicaciones: [],
  },
  {
    id: 7,
    nombre: 'Cymoxanil + Famoxadone',
    descripcion: 'Fungicida sistémico preventivo y curativo para papa',
    cultivos: ['papa'],
    uso: 'Diluir 2 g/litro. Aplicar cada 7-10 días en época lluviosa.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'],
  },
  {
    id: 8,
    nombre: 'Trichoderma (Biofungicida)',
    descripcion: 'Control biológico de hongos del suelo. Sin residuos químicos.',
    cultivos: ['papa', 'maiz', 'tomate', 'lechuga', 'zanahoria'],
    uso: 'Aplicar 5 g/litro al suelo antes de la siembra.',
    certificada: true,
    disponible: true,
    ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'],
  },
];

export default function Mercado() {
  const { user } = useAuth();
  const [selectedCultivo, setSelectedCultivo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cultivosConFungicida = CULTIVOS.filter(c =>
    FUNGICIDAS.some(f => f.cultivos.includes(c.id))
  );

  const fungicidasFiltrados = FUNGICIDAS.filter(f => {
    const porCultivo = selectedCultivo === '' || f.cultivos.includes(selectedCultivo);
    const porBusqueda = busqueda === '' ||
      f.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.descripcion.toLowerCase().includes(busqueda.toLowerCase());
    return porCultivo && porBusqueda;
  });

  const solicitar = (fungicida) => {
    const userLoc = user?.ubicacion || 'No especificada';
    const disponibleEnZona = fungicida.disponible &&
      fungicida.ubicaciones.some(u =>
        userLoc.toLowerCase().includes(u.toLowerCase()) || u === 'Lima'
      );
    const msg = encodeURIComponent(
      `🛡️ *SOLICITUD DE FUNGICIDA - AGRILUX*\n\n` +
      `📦 *Producto:* ${fungicida.nombre}\n` +
      `🌱 *Para mi cultivo:* ${selectedCultivo ? CULTIVOS.find(c => c.id === selectedCultivo)?.nombre : 'Por definir'}\n` +
      `📍 *Mi ubicación:* ${userLoc}\n` +
      `${disponibleEnZona ? '✅ Indicaste que está disponible en mi zona' : '⚠️ Consulto disponibilidad en mi zona'}\n\n` +
      `👤 *Agricultor:* ${user?.nombre}\n\n` +
      `¿Pueden darme la cotización y disponibilidad?`
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">🛡️ Fungicidas</h1>
        <p className="text-white/70 text-sm mt-1">Productos certificados SENASA para tu cultivo</p>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Buscador */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
          <span className="text-gray-400">🔍</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar fungicida..."
            className="flex-1 text-sm focus:outline-none text-gray-700"
          />
        </div>

        {/* Filtro por cultivo */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Filtrar por cultivo
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setSelectedCultivo('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                !selectedCultivo ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              Todos
            </button>
            {cultivosConFungicida.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCultivo(c.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedCultivo === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}>
                <span>{c.emoji}</span>{c.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de fungicidas */}
        <div className="space-y-3">
          {fungicidasFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-gray-500 text-sm">No hay fungicidas para esta selección</p>
            </div>
          ) : fungicidasFiltrados.map(f => {
            const userLoc = user?.ubicacion || '';
            const disponible = f.disponible && f.ubicaciones.some(u =>
              userLoc.toLowerCase().includes(u.toLowerCase()) || u === 'Lima'
            );
            return (
              <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {f.certificada && (
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                      ✓ Certificada SENASA
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    disponible
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {disponible ? 'Disponible' : 'Consultar disponibilidad'}
                  </span>
                </div>

                {/* Info */}
                <h3 className="font-bold text-gray-800 text-base">{f.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-2">{f.descripcion}</p>

                {/* Uso */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">💊 Modo de uso</p>
                  <p className="text-xs text-gray-700">{f.uso}</p>
                </div>

                {/* Cultivos */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {f.cultivos.map(cId => {
                    const c = CULTIVOS.find(x => x.id === cId);
                    return c ? (
                      <span key={cId} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {c.emoji} {c.nombre}
                      </span>
                    ) : null;
                  })}
                </div>

                {/* Zonas */}
                {f.ubicaciones.length > 0 && (
                  <p className="text-xs text-gray-400 mb-3">
                    📍 Zonas: {f.ubicaciones.join(', ')}
                  </p>
                )}

                <button
                  onClick={() => solicitar(f)}
                  className="w-full bg-primary text-white text-sm font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors">
                  📲 Solicitar Cotización
                </button>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Importante</p>
          <p className="text-xs text-amber-600">
            Todos nuestros productos están certificados por SENASA. Aplica siempre siguiendo las instrucciones de la etiqueta. Para más información llama al{' '}
            <span className="font-bold">935 211 605</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
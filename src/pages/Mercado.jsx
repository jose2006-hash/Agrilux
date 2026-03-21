import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS, PRECIOS_BASE, INSUMOS_DISPONIBLES, WHATSAPP } from '../lib/constants';
import { ShoppingCart, TrendingUp, TrendingDown, Minus, Package, Sprout, FlaskConical, Bug, Wrench } from 'lucide-react';

const tabs = [
  { id: 'precios', label: 'Precios', emoji: '📊' },
  { id: 'comprar', label: 'Comprar', emoji: '🛒' },
  { id: 'vender', label: 'Vender', emoji: '💰' },
  { id: 'insumos', label: 'Insumos', emoji: '🌱' },
  { id: 'servicios', label: 'Servicios', emoji: '🔧' },
];

function Precios() {
  const [selectedId, setSelectedId] = useState('papa');
  const cultivo = CULTIVOS.find(c => c.id === selectedId);
  const precio = PRECIOS_BASE[selectedId];

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CULTIVOS.map(c => (
          <button key={c.id} onClick={() => setSelectedId(c.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedId === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <span>{c.emoji}</span>{c.nombre}
          </button>
        ))}
      </div>

      {/* Precio card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Mercado Mayorista Lima</p>
            <h3 className="text-xl font-display font-bold text-gray-800 mt-1">{cultivo.emoji} {cultivo.nombre}</h3>
          </div>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} /> Activo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Precio mínimo</p>
            <p className="text-2xl font-bold text-primary">S/ {precio.min.toFixed(2)}</p>
            <p className="text-xs text-gray-400">por {precio.unidad}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Precio máximo</p>
            <p className="text-2xl font-bold text-gray-800">S/ {precio.max.toFixed(2)}</p>
            <p className="text-xs text-gray-400">por {precio.unidad}</p>
          </div>
        </div>
        <div className="bg-primary/5 rounded-xl p-3">
          <p className="text-xs text-primary font-semibold">💡 Precio en chacra (estimado)</p>
          <p className="text-lg font-bold text-primary">S/ {(precio.min * 0.7).toFixed(2)} - S/ {(precio.max * 0.7).toFixed(2)}</p>
          <p className="text-xs text-gray-500">70% del precio mayorista</p>
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">⚠️ Precios referenciales. Actualizados diariamente.</p>
      </div>

      {/* Variedades */}
      {cultivo.variedades.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Variedades disponibles</p>
          <div className="flex flex-wrap gap-2">
            {cultivo.variedades.map(v => (
              <span key={v} className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">{v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Comprar() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('papa');
  const [variedad, setVariedad] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [ciudad, setCiudad] = useState(user?.ubicacion || '');
  const cultivo = CULTIVOS.find(c => c.id === selectedId);
  const precio = PRECIOS_BASE[selectedId];
  const total = cantidad ? (parseFloat(cantidad) * ((precio.min + precio.max) / 2)).toFixed(2) : 0;

  const sendWhatsApp = () => {
    if (!variedad || !cantidad || !ciudad) { alert('Completa todos los campos'); return; }
    const msg = encodeURIComponent(`🛒 *SOLICITUD DE COMPRA - AGRILUX*\n\n${cultivo.emoji} *Producto:* ${cultivo.nombre} - ${variedad}\n📦 *Cantidad:* ${cantidad} kg\n📍 *Entrega en:* ${ciudad}\n💰 *Presupuesto aprox.:* S/ ${total}\n\n👤 *Comprador:* ${user?.nombre}\n📱 *WhatsApp:* ${user?.whatsapp}\n\n¿Pueden cotizarme?`);
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CULTIVOS.map(c => (
          <button key={c.id} onClick={() => { setSelectedId(c.id); setVariedad(''); }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedId === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <span>{c.emoji}</span>{c.nombre}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Variedad</p>
          <div className="grid grid-cols-2 gap-2">
            {cultivo.variedades.map(v => (
              <button key={v} onClick={() => setVariedad(v)}
                className={`py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                  variedad === v ? 'bg-primary text-white' : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}>{v}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Cantidad (kg)</p>
          <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
            placeholder="Ej: 100" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Ciudad / Distrito de entrega</p>
          <input value={ciudad} onChange={e => setCiudad(e.target.value)}
            placeholder="Ej: Cutervo, Cajamarca" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        {cantidad && variedad && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Total estimado</p>
            <p className="text-xl font-bold text-primary">S/ {total}</p>
            <p className="text-xs text-gray-400">Precio final según negociación</p>
          </div>
        )}
        <button onClick={sendWhatsApp} className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl hover:bg-green-600 transition-colors">
          📲 Solicitar cotización por WhatsApp
        </button>
      </div>
    </div>
  );
}

function Vender() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('papa');
  const [variedad, setVariedad] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [calidad, setCalidad] = useState('Buena');
  const [fotos, setFotos] = useState([]);
  const cultivo = CULTIVOS.find(c => c.id === selectedId);
  const precio = PRECIOS_BASE[selectedId];
  const precioChacra = ((precio.min + precio.max) / 2 * 0.7).toFixed(2);

  const handleFoto = (e) => {
    const files = Array.from(e.target.files).slice(0, 3);
    setFotos(files.map(f => URL.createObjectURL(f)));
  };

  const sendWhatsApp = () => {
    if (!variedad || !cantidad) { alert('Completa los campos'); return; }
    const msg = encodeURIComponent(`💰 *QUIERO VENDER MI COSECHA - AGRILUX*\n\n${cultivo.emoji} *Producto:* ${cultivo.nombre} - ${variedad}\n📦 *Cantidad disponible:* ${cantidad} kg\n⭐ *Calidad:* ${calidad}\n📍 *Ubicación:* ${user?.ubicacion}\n\n👤 *Agricultor:* ${user?.nombre}\n📱 *WhatsApp:* ${user?.whatsapp}\n\n¿Cuándo pueden recoger?`);
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CULTIVOS.map(c => (
          <button key={c.id} onClick={() => { setSelectedId(c.id); setVariedad(''); }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedId === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <span>{c.emoji}</span>{c.nombre}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Variedad</p>
          <div className="grid grid-cols-2 gap-2">
            {cultivo.variedades.map(v => (
              <button key={v} onClick={() => setVariedad(v)}
                className={`py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                  variedad === v ? 'bg-primary text-white' : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}>{v}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Cantidad disponible (kg)</p>
          <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
            placeholder="Ej: 500" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Calidad</p>
          <div className="grid grid-cols-3 gap-2">
            {['Regular', 'Buena', 'Primera'].map(c => (
              <button key={c} onClick={() => setCalidad(c)}
                className={`py-2 rounded-xl text-sm font-semibold transition-all ${
                  calidad === c ? 'bg-primary text-white' : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}>{c}</button>
            ))}
          </div>
        </div>

        {variedad && (
          <div className="bg-primary/5 rounded-xl p-3">
            <p className="text-xs text-primary font-semibold">Precio promedio en chacra - {variedad}</p>
            <p className="text-xl font-bold text-primary">S/ {precioChacra} /kg</p>
            <p className="text-xs text-gray-500">El precio final se define según calidad y logística</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Fotos de tu cosecha (opcional)</p>
          <input type="file" accept="image/*" multiple onChange={handleFoto} className="text-xs text-gray-500" />
          {fotos.length > 0 && (
            <div className="flex gap-2 mt-2">
              {fotos.map((f, i) => <img key={i} src={f} alt="" className="w-16 h-16 rounded-lg object-cover" />)}
            </div>
          )}
        </div>

        <button onClick={sendWhatsApp} className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl hover:bg-green-600 transition-colors">
          📲 Contactar por WhatsApp
        </button>
      </div>
    </div>
  );
}

function Insumos() {
  const { user } = useAuth();
  const [tipoInsumo, setTipoInsumo] = useState('semilla');
  const [selectedCultivo, setSelectedCultivo] = useState('');

  const tipos = [
    { id: 'semilla', label: 'Semillas', emoji: '🌱' },
    { id: 'fertilizante', label: 'Fertilizantes', emoji: '💧' },
    { id: 'fungicida', label: 'Fungicidas', emoji: '🛡️' },
  ];

  const insumosFiltrados = INSUMOS_DISPONIBLES.filter(i => i.tipo === tipoInsumo && (selectedCultivo === '' || i.cultivo === selectedCultivo));

  const solicitar = (insumo) => {
    const userLoc = user?.ubicacion || '';
    const disponibleEnZona = insumo.ubicaciones.some(u => userLoc.toLowerCase().includes(u.toLowerCase()));
    const msg = encodeURIComponent(`🌱 *SOLICITUD DE INSUMO - AGRILUX*\n\n📦 *Producto:* ${insumo.nombre}\n📍 *Mi ubicación:* ${userLoc}\n${disponibleEnZona ? '✅ Disponible en mi zona' : '⚠️ Consulta disponibilidad'}\n\n👤 *Agricultor:* ${user?.nombre}\n📱 *WhatsApp:* ${user?.whatsapp}\n\n¿Pueden darme la cotización?`);
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tipos.map(t => (
          <button key={t.id} onClick={() => setTipoInsumo(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              tipoInsumo === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <span className="text-lg">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Filtrar por cultivo</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button onClick={() => setSelectedCultivo('')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${!selectedCultivo ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            Todos
          </button>
          {CULTIVOS.filter(c => INSUMOS_DISPONIBLES.some(i => i.cultivo === c.id)).map(c => (
            <button key={c.id} onClick={() => setSelectedCultivo(c.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${selectedCultivo === c.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {c.emoji} {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {insumosFiltrados.map(insumo => {
          const userLoc = user?.ubicacion || '';
          const disponible = insumo.disponible && insumo.ubicaciones.some(u => userLoc.toLowerCase().includes(u.toLowerCase()) || u === 'Lima');
          return (
            <div key={insumo.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">✓ Certificada SENASA</span>
                    {disponible ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Disponible</span> : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">No disponible</span>}
                  </div>
                  <h3 className="font-bold text-gray-800">{insumo.nombre}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Zonas: {insumo.ubicaciones.join(', ') || 'No disponible'}</p>
                </div>
              </div>
              <button onClick={() => solicitar(insumo)}
                className="w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary-dark transition-colors">
                📲 Solicitar Cotización
              </button>
            </div>
          );
        })}
        {insumosFiltrados.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm">No hay insumos disponibles para esta selección</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Servicios() {
  const { user } = useAuth();
  const serviciosList = [
    { emoji: '🚜', titulo: 'Preparación del Terreno', items: ['Tractor agrícola', 'Arado', 'Rastra'], cultivos: 'Maíz, Arroz, Papa' },
    { emoji: '🌱', titulo: 'Siembra', items: ['Sembradora mecánica', 'Trasplantadora'], cultivos: 'Tomate, Lechuga, Papa' },
    { emoji: '💧', titulo: 'Riego', items: ['Riego por goteo', 'Riego por aspersión', 'Bombas de agua'], cultivos: 'Palta, Cebolla' },
    { emoji: '🔧', titulo: 'Manejo de Cultivos', items: ['Fumigadoras', 'Abonadoras', 'Sensores de clima'], cultivos: 'Cacao, Café' },
    { emoji: '🌾', titulo: 'Cosecha', items: ['Cosechadoras', 'Herramientas manuales'], cultivos: 'Arroz' },
    { emoji: '📦', titulo: 'Postcosecha', items: ['Clasificadoras', 'Empacadoras', 'Cámaras de frío'], cultivos: 'Mango, Naranja' },
  ];

  const solicitar = (servicio) => {
    const msg = encodeURIComponent(`🔧 *SOLICITUD DE SERVICIO - AGRILUX*\n\n⚙️ *Servicio:* ${servicio.titulo}\n📍 *Ubicación:* ${user?.ubicacion}\n\n👤 *Agricultor:* ${user?.nombre}\n📱 *WhatsApp:* ${user?.whatsapp}\n\n¿Cuándo pueden atenderme?`);
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-3">
      {serviciosList.map(s => (
        <div key={s.titulo} className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <h3 className="font-bold text-gray-800">{s.titulo}</h3>
              <p className="text-xs text-gray-500">Para: {s.cultivos}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {s.items.map(i => <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg">{i}</span>)}
          </div>
          <button onClick={() => solicitar(s)}
            className="w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary-dark transition-colors">
            📲 Consultar disponibilidad
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Mercado() {
  const [activeTab, setActiveTab] = useState('precios');

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Mercado Agrícola</h1>
        <p className="text-white/70 text-sm mt-1">Compra, vende e insumos certificados</p>
      </div>

      <div className="px-4 -mt-2 sticky top-0 z-10 bg-[#f8faf8] pt-2 pb-1">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t.id ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 animate-fadeIn">
        {activeTab === 'precios' && <Precios />}
        {activeTab === 'comprar' && <Comprar />}
        {activeTab === 'vender' && <Vender />}
        {activeTab === 'insumos' && <Insumos />}
        {activeTab === 'servicios' && <Servicios />}
      </div>
    </div>
  );
}

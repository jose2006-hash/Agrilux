export const WHATSAPP = '51935211605';

export const CULTIVOS = [
  {
    id: 'papa',
    nombre: 'Papa',
    emoji: '🥔',
    categoria: 'basico',
    variedades: ['Yungay', 'Perricholi', 'Única', 'Canchán', 'Huayro', 'Peruanita'],
  },
  {
    id: 'maiz',
    nombre: 'Maíz',
    emoji: '🌽',
    categoria: 'basico',
    variedades: ['Amarillo duro', 'Blanco gigante', 'Choclo', 'Morado'],
  },
  {
    id: 'palta',
    nombre: 'Palta',
    emoji: '🥑',
    categoria: 'frutal',
    variedades: ['Hass', 'Fuerte', 'Criolla', 'Ettinger'],
  },
  {
    id: 'arandano',
    nombre: 'Arándano',
    emoji: '🫐',
    categoria: 'frutal',
    variedades: ['Biloxi', 'Emerald', 'Jewel', 'O\'Neal'],
  },
  {
    id: 'cana',
    nombre: 'Caña de azúcar',
    emoji: '🎋',
    categoria: 'industrial',
    variedades: ['NA56', 'CC01-941', 'SP71-6949', 'CP52-43', 'H59-3774'],
  },
  {
    id: 'platano',
    nombre: 'Plátano',
    emoji: '🍌',
    categoria: 'frutal',
    variedades: ['Sedita', 'Bellaco', 'Isla', 'Palillo', 'Guineo'],
  },
  {
    id: 'papaya',
    nombre: 'Papaya',
    emoji: '🍈',
    categoria: 'frutal',
    variedades: ['Hawaiana', 'Solo Sunrise', 'Tainung', 'Maradol', 'Venezolana'],
  },
];

export const PRECIOS_BASE = {
  papa:     { min: 0.80, max: 1.50, unidad: 'kg' },
  maiz:     { min: 1.20, max: 2.80, unidad: 'kg' },
  palta:    { min: 2.00, max: 5.00, unidad: 'kg' },
  arandano: { min: 8.00, max: 18.00, unidad: 'kg' },
  cana:     { min: 0.12, max: 0.22, unidad: 'kg' },
  platano:  { min: 1.00, max: 2.50, unidad: 'kg' },
  papaya:   { min: 1.50, max: 4.00, unidad: 'kg' },
};
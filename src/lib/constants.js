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
];

export const PRECIOS_BASE = {
  papa:     { min: 0.80, max: 1.50, unidad: 'kg' },
  palta:    { min: 2.00, max: 5.00, unidad: 'kg' },
  arandano: { min: 8.00, max: 18.00, unidad: 'kg' },
};
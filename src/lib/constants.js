export const WHATSAPP = '51935211605';

export const CULTIVOS = [
  { id: 'papa', nombre: 'Papa', emoji: '🥔', categoria: 'basico',
    variedades: ['Yungay', 'Perricholi', 'Única', 'Canchán', 'Huayro', 'Peruanita'] },
  { id: 'maiz', nombre: 'Maíz', emoji: '🌽', categoria: 'basico',
    variedades: ['Amarillo Duro', 'Blanco Urubamba', 'Morado', 'Choclo'] },
  { id: 'arroz', nombre: 'Arroz', emoji: '🌾', categoria: 'basico',
    variedades: ['La Conquista', 'NIR', 'Ferrón', 'Superior', 'Extra'] },
  { id: 'tomate', nombre: 'Tomate', emoji: '🍅', categoria: 'hortaliza',
    variedades: ['Río Grande', 'Daniela', 'Cherry', 'Híbrido'] },
  { id: 'cebolla', nombre: 'Cebolla', emoji: '🧅', categoria: 'hortaliza',
    variedades: ['Roja Arequipeña', 'Blanca', 'Amarilla'] },
  { id: 'lechuga', nombre: 'Lechuga', emoji: '🥬', categoria: 'hortaliza',
    variedades: ['Saladinah', 'Batavia', 'Romana', 'Crespa'] },
  { id: 'zanahoria', nombre: 'Zanahoria', emoji: '🥕', categoria: 'hortaliza',
    variedades: ['Chantenay', 'Nantes', 'Danvers'] },
  { id: 'palta', nombre: 'Palta', emoji: '🥑', categoria: 'frutal',
    variedades: ['Hass', 'Fuerte', 'Criolla', 'Ettinger'] },
  { id: 'platano', nombre: 'Plátano', emoji: '🍌', categoria: 'frutal',
    variedades: ['Isla', 'Seda', 'Bellaco', 'Manzano'] },
  { id: 'mango', nombre: 'Mango', emoji: '🥭', categoria: 'frutal',
    variedades: ['Kent', 'Edward', 'Haden', 'Tommy'] },
  { id: 'naranja', nombre: 'Naranja', emoji: '🍊', categoria: 'frutal',
    variedades: ['Valencia', 'Navel', 'Criolla'] },
  { id: 'cafe', nombre: 'Café', emoji: '☕', categoria: 'comercial',
    variedades: ['Arábica', 'Catimor', 'Typica', 'Bourbon'] },
  { id: 'cacao', nombre: 'Cacao', emoji: '🍫', categoria: 'comercial',
    variedades: ['CCN-51', 'Criollo', 'Forastero', 'Trinitario'] },
  { id: 'quinua', nombre: 'Quinua', emoji: '🌱', categoria: 'comercial',
    variedades: ['Salcedo INIA', 'Blanca Junín', 'Pasankalla', 'Negra'] },
  { id: 'aji', nombre: 'Ají', emoji: '🌶️', categoria: 'extra',
    variedades: ['Panca', 'Amarillo', 'Mirasol', 'Rocoto', 'Limo'] },
];

export const PRECIOS_BASE = {
  papa: { min: 0.80, max: 1.50, unidad: 'kg' },
  maiz: { min: 0.60, max: 1.20, unidad: 'kg' },
  arroz: { min: 1.80, max: 2.80, unidad: 'kg' },
  tomate: { min: 0.80, max: 2.00, unidad: 'kg' },
  cebolla: { min: 0.60, max: 1.50, unidad: 'kg' },
  lechuga: { min: 0.50, max: 1.20, unidad: 'unidad' },
  zanahoria: { min: 0.70, max: 1.50, unidad: 'kg' },
  palta: { min: 2.00, max: 5.00, unidad: 'kg' },
  platano: { min: 0.80, max: 2.00, unidad: 'kg' },
  mango: { min: 1.00, max: 3.00, unidad: 'kg' },
  naranja: { min: 0.50, max: 1.50, unidad: 'kg' },
  cafe: { min: 8.00, max: 15.00, unidad: 'kg' },
  cacao: { min: 6.00, max: 12.00, unidad: 'kg' },
  quinua: { min: 4.00, max: 8.00, unidad: 'kg' },
  aji: { min: 1.50, max: 5.00, unidad: 'kg' },
};

export const SERVICIOS = {
  preparacion: {
    titulo: 'Preparación del Terreno',
    items: ['Tractor agrícola', 'Arado (voltea la tierra)', 'Rastra (nivela el suelo)'],
    cultivos: ['Maíz', 'Arroz', 'Papa'],
  },
  siembra: {
    titulo: 'Siembra',
    items: ['Sembradora mecánica', 'Trasplantadora (hortalizas)'],
    cultivos: ['Tomate', 'Lechuga', 'Papa'],
  },
  riego: {
    titulo: 'Riego',
    items: ['Sistemas de riego por goteo', 'Riego por aspersión', 'Bombas de agua'],
    cultivos: ['Palta', 'Cebolla'],
  },
  manejo: {
    titulo: 'Manejo de Cultivos',
    items: ['Fumigadoras manuales o motorizadas', 'Abonadoras', 'Sensores de humedad y clima'],
    cultivos: ['Cacao', 'Café'],
  },
  cosecha: {
    titulo: 'Cosecha',
    items: ['Cosechadoras industriales', 'Herramientas manuales'],
    cultivos: ['Arroz'],
  },
  postcosecha: {
    titulo: 'Postcosecha',
    items: ['Clasificadoras', 'Empacadoras', 'Cámaras de frío'],
    cultivos: ['Mango', 'Naranja'],
  },
};

export const INSUMOS_DISPONIBLES = [
  { id: 1, cultivo: 'papa', tipo: 'semilla', nombre: 'Semilla Papa Yungay', certificada: true, disponible: true, ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'] },
  { id: 2, cultivo: 'papa', tipo: 'semilla', nombre: 'Semilla Papa Canchán', certificada: true, disponible: true, ubicaciones: ['Cutervo', 'Cajamarca'] },
  { id: 3, cultivo: 'maiz', tipo: 'semilla', nombre: 'Semilla Maíz Amarillo Duro', certificada: true, disponible: true, ubicaciones: ['Cutervo', 'Lima'] },
  { id: 4, cultivo: 'arroz', tipo: 'semilla', nombre: 'Semilla Arroz La Conquista', certificada: true, disponible: false, ubicaciones: [] },
  { id: 5, cultivo: 'papa', tipo: 'fertilizante', nombre: 'Guano de Isla', certificada: true, disponible: true, ubicaciones: ['Cutervo', 'Cajamarca', 'Lima'] },
  { id: 6, cultivo: 'papa', tipo: 'fungicida', nombre: 'Fungicida Cúprico', certificada: true, disponible: true, ubicaciones: ['Cutervo', 'Lima'] },
  { id: 7, cultivo: 'tomate', tipo: 'semilla', nombre: 'Semilla Tomate Río Grande', certificada: true, disponible: true, ubicaciones: ['Lima', 'Cajamarca'] },
  { id: 8, cultivo: 'palta', tipo: 'semilla', nombre: 'Plantón Palta Hass', certificada: true, disponible: true, ubicaciones: ['Lima'] },
];

// src/pages/diagnostico/diagnosticoPrompts.js

export const SISTEMA_PROMPT = {
  papa: `Eres PlaguIA, asistente agrónomo especializado en el cultivo de papa (Solanum tuberosum) para agricultores peruanos.
Ayudas a identificar el estado fitosanitario de las plantas analizando imágenes.
Conoces condiciones de sierra peruana: lluvia, heladas, altitud 2800-4000 msnm.
Siempre das dosis exactas, nombres comerciales disponibles en Perú y momento óptimo de aplicación.
IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.`,

  palta: `Eres PlaguIA, asistente agrónomo especializado en palta/aguacate (Persea americana) para agricultores peruanos.
Ayudas a evaluar el estado fitosanitario del cultivo analizando imágenes.
Conoces estándares GlobalGAP, SENASA y LMR Europa. Das períodos de carencia para exportación.
IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.`,

  arandano: `Eres PlaguIA, asistente agrónomo especializado en arándanos (Vaccinium corymbosum) para exportación peruana.
Ayudas a evaluar el estado fitosanitario del cultivo analizando imágenes.
Solo recomiendas productos con LMR permitido en UE/USA/Asia. Das períodos de carencia obligatorios para GlobalGAP.
IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.`,
};

export const CHAT_SYSTEM = {
  papa:     `Eres PlaguIA, agrónomo experto en papa para Perú. Da recomendaciones específicas de productos con dosis exactas.`,
  palta:    `Eres PlaguIA, agrónomo experto en palta/aguacate para Perú exportación.`,
  arandano: `Eres PlaguIA, agrónomo experto en arándanos para Perú exportación con estándares GlobalGAP.`,
};

export const ANALISIS_SCHEMA = {
  type: 'object',
  properties: {
    tiene_problema:       { type: 'boolean' },
    nombre_problema:      { type: 'string' },
    nombre_cientifico:    { type: 'string' },
    gravedad:             { type: 'string', enum: ['ninguna', 'leve', 'moderada', 'grave', 'critica'] },
    que_tiene:            { type: 'string' },
    causa:                { type: 'string' },
    aplicacion_inmediata: { type: 'string' },
    que_hacer:            { type: 'string' },
    productos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre:             { type: 'string' },
          ingrediente_activo: { type: 'string' },
          dosis:              { type: 'string' },
          frecuencia:         { type: 'string' },
          carencia:           { type: 'string' },
        },
      },
    },
    cuando_aplicar: { type: 'string' },
    prevencion:     { type: 'string' },
    alerta_clima:   { type: 'string' },
  },
};
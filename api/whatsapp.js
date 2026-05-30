/**
 * api/whatsapp.js — Proxy para Twilio WhatsApp Business API
 * Envía diagnósticos fitosanitarios directamente al WhatsApp del agricultor
 *
 * Variables necesarias en Vercel:
 *   TWILIO_ACCOUNT_SID    → Account SID de Twilio (empieza con AC...)
 *   TWILIO_AUTH_TOKEN     → Auth Token
 *   TWILIO_WHATSAPP_FROM  → Número Twilio WhatsApp (formato: whatsapp:+14155238886)
 *
 * Registro: https://www.twilio.com/try-twilio (prueba gratis con Sandbox)
 * En producción: aprobar plantillas en Meta Business (WhatsApp Business API)
 *
 * Usos en Agrilux:
 *   1. Diagnóstico completado → enviar resumen al agricultor
 *   2. Alerta de plaga en zona → notificar agricultores cercanos
 *   3. Pedido confirmado → enviar confirmación al agricultor
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return res.status(500).json({
      error: 'Variables Twilio no configuradas',
      needed: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'],
      hint: 'Configura las 3 variables en Vercel Environment Variables.',
    });
  }

  const { tipo, telefono, datos } = req.body;

  if (!telefono) return res.status(400).json({ error: 'telefono requerido' });

  // Limpiar número: solo dígitos, agregar código de Perú si falta
  let numLimpio = telefono.replace(/\D/g, '');
  if (numLimpio.length === 9) numLimpio = `51${numLimpio}`;
  const to = `whatsapp:+${numLimpio}`;

  // ─── Construir el mensaje según el tipo ────────────────────────────────────
  let body = '';

  if (tipo === 'diagnostico') {
    const { cultivo, problema, gravedad, accion, productos } = datos || {};
    const emojisGravedad = {
      critica: '🚨🚨🚨',
      grave: '🚨🚨',
      moderada: '⚠️',
      leve: '⚠️',
      ninguna: '✅',
    };
    const emoji = emojisGravedad[gravedad] || '⚠️';

    if (!problema || gravedad === 'ninguna') {
      body = `✅ *AGRILUX — Tu ${cultivo} está saludable*

No se detectaron plagas ni enfermedades en el análisis. Sigue con tus buenas prácticas agrícolas.

🌱 _Diagnóstico generado por PlaguIA_
📱 Descarga Agrilux: https://agrilux.pe`;
    } else {
      const listaProductos = (productos || [])
        .slice(0, 2)
        .map((p) => `• *${p.nombre}* — Dosis: ${p.dosis || 'consultar'}`)
        .join('\n');

      body = `${emoji} *AGRILUX — Alerta fitosanitaria*

🌱 *Cultivo:* ${cultivo}
🦠 *Problema detectado:* ${problema}
📊 *Gravedad:* ${gravedad?.toUpperCase()}

⚡ *Acción inmediata:*
${accion || 'Consulta la app para el plan de control completo.'}

💊 *Productos recomendados:*
${listaProductos || 'Ver en la app →'}

📱 *Ver diagnóstico completo:* https://agrilux.pe
🛒 *Comprar fungicida con delivery:* Abre la app y toca "Que el agente lo compre por ti"

_PlaguIA · AGRILUX_`;
    }

  } else if (tipo === 'alerta_zona') {
    const { zona, cultivo, plaga, agricultoresAfectados } = datos || {};
    body = `🚨 *AGRILUX — Alerta de plaga en tu zona*

📍 *Zona:* ${zona}
🌱 *Cultivo afectado:* ${cultivo}
🦠 *Plaga detectada:* ${plaga}
👨‍🌾 *Agricultores afectados en la zona:* ${agricultoresAfectados || 'varios'}

⚠️ Revisa tus parcelas en los próximos días.

📱 *Ver mapa de calor:* https://agrilux.pe/monitoreo
_PlaguIA · AGRILUX_`;

  } else if (tipo === 'pedido_confirmado') {
    const { producto, tienda, direccion, total } = datos || {};
    body = `✅ *AGRILUX — ¡Pedido confirmado!*

📦 *Producto:* ${producto}
🏪 *Tienda:* ${tienda}
📍 *Entrega en:* ${direccion}
💰 *Total:* S/ ${total}

Un motorizado coordinará la entrega con la tienda. Recibirás un mensaje cuando salga.

📱 *Ver estado del pedido:* https://agrilux.pe/mercado
_PlaguIA · AGRILUX_`;

  } else {
    // Mensaje genérico / personalizado
    body = datos?.mensaje || 'Mensaje de AGRILUX PlaguIA';
  }

  // ─── Enviar vía API REST de Twilio ─────────────────────────────────────────
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const formData = new URLSearchParams({
      From: from,
      To: to,
      Body: body,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio error:', JSON.stringify(result));
      return res.status(twilioRes.status).json({
        error: result.message || 'Error en Twilio',
        code: result.code,
        // Código 21211 = número inválido, 21408 = número no en sandbox
        hint: result.code === 21408
          ? 'En modo Sandbox: el agricultor debe enviar el código join primero a +14155238886'
          : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      sid: result.sid,
      status: result.status,
      to: result.to,
    });
  } catch (error) {
    console.error('Twilio proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
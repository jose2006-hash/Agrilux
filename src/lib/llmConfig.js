export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export const MODELS = {
  DEEPSEEK_FAST: 'deepseek-v4-flash',
  DEEPSEEK_QUALITY: 'deepseek-v4-pro',
  GEMINI_VISION: 'gemini-2.0-flash',
};

export function resolveDeepSeekKey(env) {
  return (
    env.DEEPSEEK_API_KEY ||
    env.VITE_DEEPSEEK_API_KEY ||
    env.OPENAI_API_KEY ||
    env.VITE_OPENAI_API_KEY ||
    ''
  );
}

export function resolveGeminiKey(env) {
  return env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
}

function schemaHint(schema) {
  if (!schema?.properties) return '';
  return Object.entries(schema.properties)
    .map(([key, value]) => {
      if (value.enum) return `${key}(${value.enum.join('|')})`;
      if (value.type === 'array') return `${key}[]`;
      return key;
    })
    .join(', ');
}

function buildMessages({
  prompt,
  file_urls = [],
  response_json_schema = null,
  systemPrompt = null,
}) {
  const imageUrls = file_urls.filter((url) => url?.startsWith('data:'));
  const useJson = Boolean(response_json_schema);
  const imageDetail = imageUrls.length > 1 ? 'low' : 'high';

  const jsonSuffix = useJson
    ? ` Responde únicamente con JSON válido. Campos: ${schemaHint(response_json_schema)}. Sin markdown.`
    : '';
  const system =
    (systemPrompt || 'Agrónomo experto en cultivos del Perú. Respuestas breves, prácticas y en español.') +
    jsonSuffix;

  let userText = prompt;
  if (useJson) {
    userText += '\n\nResponde en json siguiendo exactamente esos campos.';
  }

  const userContent = imageUrls.length
    ? [
        { type: 'text', text: userText },
        ...imageUrls.map((url) => ({
          type: 'image_url',
          image_url: { url, detail: imageDetail },
        })),
      ]
    : userText;

  return { imageUrls, useJson, messages: [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ] };
}

function buildBody({ messages, useJson, model, provider }) {
  const body = {
    model,
    messages,
    max_tokens: useJson ? 1536 : 768,
    temperature: useJson ? 0.2 : 0.5,
  };

  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  if (provider === 'deepseek') {
    body.thinking = { type: 'disabled' };
  }

  return body;
}

/** DeepSeek API es solo texto; imágenes van por Gemini (multimodal). */
export function resolveLlmRequest(env, options) {
  const { imageUrls, useJson, messages } = buildMessages(options);
  const hasImages = imageUrls.length > 0;

  if (hasImages) {
    const apiKey = resolveGeminiKey(env);
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY requerida para analizar imágenes. Obtén una gratis en https://aistudio.google.com/apikey'
      );
    }

    return {
      provider: 'gemini',
      url: GEMINI_URL,
      apiKey,
      body: buildBody({
        messages,
        useJson,
        model: MODELS.GEMINI_VISION,
        provider: 'gemini',
      }),
    };
  }

  const apiKey = resolveDeepSeekKey(env);
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY no configurada');
  }

  const model = useJson ? MODELS.DEEPSEEK_QUALITY : MODELS.DEEPSEEK_FAST;

  return {
    provider: 'deepseek',
    url: DEEPSEEK_URL,
    apiKey,
    body: buildBody({
      messages,
      useJson,
      model,
      provider: 'deepseek',
    }),
  };
}

export async function callChatCompletions({ url, apiKey, body }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message =
      errData.error?.message || errData.message || `Error LLM ${res.status}`;
    throw new Error(message);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

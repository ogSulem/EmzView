import axios from 'axios';

import { cacheGet, cacheSet } from './cache.js';

function isEnabled() {
  return String(process.env.LLM_ENABLED ?? '').toLowerCase() === 'true';
}

function getClient() {
  const baseURL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY;

  const headers = {
    'Content-Type': 'application/json',
  };

  // For local OpenAI-compatible servers (Ollama, llama.cpp server), API key is often optional.
  // If a key is provided, we still send it (works for OpenAI and many compatible gateways).
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  return axios.create({
    baseURL,
    headers,
    timeout: 15_000,
  });
}

export async function llmRewriteExplanation(input) {
  if (!isEnabled()) return input;
  if (!input || typeof input !== 'string') return input;

  const trimmed = input.trim();
  if (!trimmed) return input;

  const client = getClient();
  if (!client) return input;

  const cacheKey = `llm:explain:${hashKey(trimmed)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const system =
    'Ты помогаешь в приложении рекомендаций фильмов и сериалов. ' +
    'Твоя задача — переформулировать техническое объяснение рекомендации в 1–2 короткие фразы на русском. ' +
    'Без воды, без упоминания "алгоритмов"/"моделей". Не добавляй фактов, которых нет во входном тексте.';

  const user = `Исходное объяснение: ${trimmed}\n\nСделай 1–2 фразы.`;

  try {
    const { data } = await client.post('/chat/completions', {
      model,
      temperature: 0.4,
      max_tokens: 80,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const out = data?.choices?.[0]?.message?.content?.trim();
    const finalText = out && out.length <= 220 ? out : trimmed;

    const ttlMs = Number(process.env.LLM_EXPLANATION_CACHE_TTL_SEC ?? 86400) * 1000;
    cacheSet(cacheKey, finalText, ttlMs);

    return finalText;
  } catch {
    return trimmed;
  }
}

function hashKey(s) {
  // Small stable hash for cache key; not cryptographic.
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

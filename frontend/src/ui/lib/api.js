import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
  timeout: 20_000,
});

export function formatApiError(err, fallback) {
  const status = err?.response?.status;
  const code = err?.code;

  if (code === 'ECONNABORTED') return 'Сервер отвечает слишком долго. Попробуйте ещё раз.';
  if (status === 429) return 'Слишком много запросов. Подождите немного и попробуйте снова.';
  if (!status) return 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.';
  if (status >= 500) return 'Сервис временно недоступен. Попробуйте позже.';

  return err?.response?.data?.error ?? fallback ?? 'Ошибка запроса';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(err) {
  const cfg = err?.config;
  if (!cfg) return false;
  if (cfg.__noRetry) return false;
  const method = (cfg.method ?? 'get').toLowerCase();
  if (method !== 'get') return false;

  const status = err?.response?.status;
  const code = err?.code;

  if (code === 'ECONNABORTED') return true;
  if (!status) return true;
  if (status >= 500) return true;
  if (status === 429) return true;
  return false;
}

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export function getStoredAuthToken() {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function persistAuthToken(token) {
  try {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  } catch {
    // ignore
  }
  setAuthToken(token);
}

export function clearAuth({ redirectToLogin = true, includeNext = true } = {}) {
  persistAuthToken(null);
  if (redirectToLogin && typeof window !== 'undefined') {
    const pathname = window.location?.pathname ?? '';
    const search = window.location?.search ?? '';
    const hash = window.location?.hash ?? '';
    if (!pathname.startsWith('/login')) {
      if (includeNext && pathname && !pathname.startsWith('/register')) {
        const next = `${pathname}${search}${hash}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      } else {
        window.location.href = '/login';
      }
    }
  }
}

let installed = false;
if (!installed) {
  installed = true;
  api.interceptors.response.use(
    (res) => res,
    async (err) => {
      const status = err?.response?.status;
      if (status === 401) {
        clearAuth({ redirectToLogin: true });
      }

      if (shouldRetry(err)) {
        const cfg = err.config;
        cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;
        const max = cfg.__maxRetries ?? 2;
        if (cfg.__retryCount <= max) {
          const backoff = 250 * Math.pow(2, cfg.__retryCount - 1);
          const jitter = Math.floor(Math.random() * 120);
          await sleep(backoff + jitter);
          return api(cfg);
        }
      }

      return Promise.reject(err);
    }
  );
}

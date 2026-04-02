import axios from 'axios';

export function mlClient() {
  const baseURL = process.env.ML_SERVICE_URL;
  if (!baseURL) {
    throw new Error('ML_SERVICE_URL is required');
  }

  const timeoutMsRaw = process.env.ML_TIMEOUT_MS;
  const timeout = Number.isFinite(Number(timeoutMsRaw)) ? Number(timeoutMsRaw) : 3_000;

  return axios.create({
    baseURL,
    timeout,
  });
}

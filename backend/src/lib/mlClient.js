import axios from 'axios';

export function mlClient() {
  const baseURL = process.env.ML_SERVICE_URL;
  if (!baseURL) {
    throw new Error('ML_SERVICE_URL is required');
  }

  return axios.create({
    baseURL,
    timeout: 20_000,
  });
}

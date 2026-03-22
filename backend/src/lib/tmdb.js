import axios from 'axios';

const baseURL = 'https://api.themoviedb.org/3';

export function tmdbClient() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is required');
  }

  return axios.create({
    baseURL,
    params: {
      api_key: apiKey,
    },
  });
}

export function posterUrl(posterPath, size = 'w342') {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

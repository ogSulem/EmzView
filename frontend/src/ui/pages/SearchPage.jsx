import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { api, clearAuth, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { PosterCard } from '../components/PosterCard.jsx';

function useQueryParam(name) {
  const { search } = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get(name) ?? '';
  }, [name, search]);
}

export function SearchPage() {
  const navigate = useNavigate();
  const q = useQueryParam('q');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      clearAuth({ redirectToLogin: true, includeNext: true });
      return;
    }
    setAuthToken(token);
  }, [navigate]);

  const normalized = useMemo(() => (q ?? '').trim(), [q]);

  useEffect(() => {
    let mounted = true;
    const query = normalized;

    if (!query) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const t = window.setTimeout(async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          api.get(`/api/movies/search?q=${encodeURIComponent(query)}&type=movie`),
          api.get(`/api/movies/search?q=${encodeURIComponent(query)}&type=tv`),
        ]);

        const merged = [...(movieRes?.data?.results ?? []), ...(tvRes?.data?.results ?? [])]
          .map((r) => ({
            tmdbId: r.tmdbId,
            mediaType: r.mediaType,
            title: r.title,
            overview: r.overview,
            posterUrl: r.posterUrl,
            popularity: r.popularity ?? 0,
            explanation: null,
            score: null,
          }))
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

        if (!mounted) return;
        setResults(merged);
      } catch (err) {
        if (!mounted) return;
        setError(formatApiError(err, 'Поиск не удался'));
      } finally {
        if (mounted) setLoading(false);
      }
    }, 180);

    return () => {
      mounted = false;
      window.clearTimeout(t);
    };
  }, [normalized]);

  const onRatedInSearch = useCallback((ratedItem) => {
    setResults((prev) => (prev ?? []).filter((x) => `${x.mediaType}:${x.tmdbId}` !== `${ratedItem.mediaType}:${ratedItem.tmdbId}`));
  }, []);

  return (
    <div>
      <div className="hero hero--mb14">
        <h1 className="hero-title">Поиск</h1>
        <p className="hero-desc">Введите название в верхнем поле поиска.</p>
        {normalized ? <div className="small u-mt10">Запрос: «{normalized}»</div> : <div className="small u-mt10">Начните вводить, чтобы увидеть результаты.</div>}
        {error ? <div className="error u-mt10">{error}</div> : null}
      </div>

      {loading ? (
        <div className="results-grid results-grid--mt10">
          {Array.from({ length: 18 }).map((_, idx) => (
            <div key={idx} className="tile-skeleton">
              <div className="tile-skeleton__poster skeleton" />
              <div className="skeleton skeleton-line skeleton-line--mt8" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && normalized && results.length === 0 ? (
        <div className="hero hero-card">
          <div className="hero-title hero-title--sm u-mb4">Ничего не найдено</div>
          <div className="hero-desc">Попробуй другое название или уточни запрос.</div>
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <div className="results-grid">
          {results.map((it) => (
            <PosterCard key={`${it.mediaType}:${it.tmdbId}`} item={it} onRated={onRatedInSearch} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

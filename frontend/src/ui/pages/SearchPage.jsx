import React, { useEffect, useMemo, useState } from 'react';

import { api, setAuthToken } from '../lib/api.js';
import { PosterCard } from '../components/PosterCard.jsx';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('movie');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  const normalized = useMemo(() => q.trim(), [q]);

  async function search() {
    if (!normalized) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/api/movies/search?q=${encodeURIComponent(normalized)}&type=${type}`);
      const mapped = (data.results ?? []).map((r) => ({
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        title: r.title,
        overview: r.overview,
        posterUrl: r.posterUrl,
        explanation: null,
        score: null,
      }));
      setResults(mapped);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="hero" style={{ marginBottom: 14 }}>
        <h1 className="hero-title">Поиск</h1>
        <p className="hero-desc">Найди фильм или сериал и поставь лайк/дизлайк — рекомендации обновятся.</p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: Interstellar"
            style={{
              flex: '1 1 320px',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'rgba(18,18,26,.55)',
              color: 'var(--text)',
            }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setType('movie')} style={{ borderColor: type === 'movie' ? 'rgba(255,61,113,.75)' : undefined }}>
              Фильмы
            </button>
            <button className="btn" onClick={() => setType('tv')} style={{ borderColor: type === 'tv' ? 'rgba(255,61,113,.75)' : undefined }}>
              Сериалы
            </button>
          </div>

          <button className="btn" onClick={search} disabled={loading || !normalized}>
            {loading ? 'Ищу…' : 'Искать'}
          </button>
        </div>

        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {results.map((it) => (
          <PosterCard key={`${it.mediaType}:${it.tmdbId}`} item={it} />
        ))}
      </div>
    </div>
  );
}

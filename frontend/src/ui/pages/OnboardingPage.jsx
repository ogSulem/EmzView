import React, { useEffect, useMemo, useRef, useState } from 'react';

import { api, setAuthToken } from '../lib/api.js';

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function OnboardingPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Map());
  const [genres, setGenres] = useState([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState(() => new Set());

  const wrapRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setError('');
      setLoading(true);
      try {
        const [candidatesRes, movieGenresRes, tvGenresRes] = await Promise.all([
          api.get('/api/users/onboarding/candidates?limit=48'),
          api.get('/api/movies/genres?type=movie'),
          api.get('/api/movies/genres?type=tv'),
        ]);
        if (!mounted) return;
        setItems(candidatesRes.data?.results ?? []);

        const merged = new Map();
        for (const g of movieGenresRes.data?.genres ?? []) merged.set(g.id, g.name);
        for (const g of tvGenresRes.data?.genres ?? []) merged.set(g.id, g.name);
        const list = Array.from(merged.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
        setGenres(list);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.error ?? 'Failed to load onboarding candidates');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const placed = useMemo(() => {
    const w = wrapRef.current?.clientWidth ?? 980;
    const h = wrapRef.current?.clientHeight ?? 520;

    return (items ?? []).map((it) => {
      const size = randBetween(70, 120);
      const x = randBetween(0, Math.max(0, w - size));
      const y = randBetween(0, Math.max(0, h - size));

      return { ...it, _x: x, _y: y, _size: size };
    });
  }, [items]);

  function toggle(it) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `${it.mediaType}:${it.tmdbId}`;
      if (next.has(key)) next.delete(key);
      else next.set(key, { tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title });
      return next;
    });
  }

  function toggleGenre(id) {
    setSelectedGenreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const favorites = Array.from(selected.values()).map((x) => ({ tmdbId: x.tmdbId, mediaType: x.mediaType }));
      const genreIds = Array.from(selectedGenreIds.values());
      await api.put('/api/users/onboarding', { favorites, genreIds });
      window.location.href = '/';
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to save onboarding');
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const selectedGenresCount = selectedGenreIds.size;

  return (
    <div>
      <div className="hero" style={{ marginBottom: 14 }}>
        <h1 className="hero-title">Выбери любимые</h1>
        <p className="hero-desc">
          Кликни по кружкам с постерами, выбери 5–15 штук — и мы сразу настроим рекомендации.
        </p>

        {genres.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="small" style={{ marginBottom: 8 }}>
              Жанры (опционально): выбери 0–8.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {genres.map((g) => {
                const on = selectedGenreIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGenre(g.id)}
                    style={{
                      borderRadius: 999,
                      padding: '8px 10px',
                      border: on ? '1px solid rgba(255,61,113,.85)' : '1px solid rgba(255,255,255,.14)',
                      background: on ? 'rgba(255,61,113,.12)' : 'rgba(18,18,26,.35)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: '12px',
                    }}
                    title={g.name}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Выбрано жанров: {selectedGenresCount}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <button className="btn" onClick={save} disabled={saving || selectedCount < 3}>
            {saving ? 'Сохраняю…' : `Продолжить (${selectedCount})`}
          </button>
          <div className="small">Минимум 3, лучше 8–15.</div>
        </div>
        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      <div
        ref={wrapRef}
        className="hero"
        style={{
          position: 'relative',
          height: 540,
          overflow: 'hidden',
          padding: 10,
        }}
      >
        {loading ? <div className="small">Загрузка…</div> : null}

        {placed.map((it) => {
          const key = `${it.mediaType}:${it.tmdbId}`;
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              onClick={() => toggle(it)}
              style={{
                position: 'absolute',
                left: it._x,
                top: it._y,
                width: it._size,
                height: it._size,
                borderRadius: 999,
                border: isSelected ? '2px solid rgba(255,61,113,.95)' : '1px solid rgba(255,255,255,.14)',
                background: 'rgba(18,18,26,.55)',
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: isSelected ? '0 0 0 6px rgba(255,61,113,.18)' : 'none',
                transform: isSelected ? 'scale(1.05)' : 'scale(1.0)',
                transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
              }}
              title={it.title}
            >
              {it.posterUrl ? (
                <img src={it.posterUrl} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 10 }}>
                  {it.title}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="small" style={{ marginTop: 12 }}>
        Дальше я добавлю выбор жанров и тонкую настройку, но уже сейчас это даёт отличный cold-start.
      </div>
    </div>
  );
}

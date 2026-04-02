import React, { useCallback, useEffect, useRef, useState } from 'react';

import { api, clearAuth, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';

export function OnboardingPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Map());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const minSelect = 12;

  const sentinelRef = useRef(null);
  const pagingRef = useRef({ page: 1, hasMore: true, loading: false, loadingMore: false });

  const pageSize = 48;

  const skeletonItems = Array.from({ length: 18 }).map((_, i) => ({ id: i }));

  const resetSelected = useCallback(() => {
    if (saving) return;
    if (selected.size === 0) return;
    const ok = window.confirm('Сбросить выбранные фильмы/сериалы?');
    if (!ok) return;
    setSelected(new Map());
  }, [saving, selected]);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      clearAuth({ redirectToLogin: true, includeNext: true });
      return;
    }

    setAuthToken(token);

    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset') === '1';

    let mounted = true;
    (async () => {
      try {
        if (reset) {
          await api.post('/api/users/onboarding/reset');
        }
        try {
          const { data } = await api.get('/api/users/me');
          const completedAt = data?.user?.onboarding?.completedAt;
          if (mounted && completedAt && !reset) window.location.href = '/';
        } catch (err) {
          // ignore
        }
      } catch (err) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const retryInitial = useCallback(() => {
    if (loading) return;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError('');
    setLoading(true);
    api
      .get(`/api/users/onboarding/candidates?limit=${pageSize}&page=1`)
      .then((candidatesRes) => {
        setItems(candidatesRes.data?.results ?? []);
        setPage(candidatesRes.data?.page ?? 1);
        setHasMore(Boolean(candidatesRes.data?.hasMore));
      })
      .catch((err) => {
        setError(formatApiError(err, 'Не удалось загрузить кандидатов.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loading, pageSize]);

  useEffect(() => {
    pagingRef.current = { page, hasMore, loading, loadingMore };
  }, [page, hasMore, loading, loadingMore]);

  const mergeCandidates = useCallback((prev, next) => {
    const map = new Map();
    for (const it of prev ?? []) {
      const key = `${it.mediaType}:${it.tmdbId}`;
      map.set(key, it);
    }
    for (const it of next ?? []) {
      const key = `${it.mediaType}:${it.tmdbId}`;
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, []);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setError('');
      setLoading(true);
      try {
        const candidatesRes = await api.get(`/api/users/onboarding/candidates?limit=${pageSize}&page=1`);
        if (!mounted) return;
        setItems(candidatesRes.data?.results ?? []);
        setPage(candidatesRes.data?.page ?? 1);
        setHasMore(Boolean(candidatesRes.data?.hasMore));
      } catch (err) {
        if (!mounted) return;
        setError(formatApiError(err, 'Не удалось загрузить кандидатов.'));
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

  const loadMore = useCallback(async () => {
    const snap = pagingRef.current;
    if (snap.loading || snap.loadingMore || !snap.hasMore) return;
    pagingRef.current = { ...snap, loadingMore: true };
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = (pagingRef.current.page ?? 1) + 1;
      const res = await api.get(`/api/users/onboarding/candidates?limit=${pageSize}&page=${nextPage}`);
      const more = res.data?.results ?? [];
      setItems((prev) => mergeCandidates(prev, more));
      setPage(res.data?.page ?? nextPage);
      setHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      setError(formatApiError(err, 'Не удалось загрузить ещё кандидатов.'));
    } finally {
      pagingRef.current = { ...pagingRef.current, loadingMore: false };
      setLoadingMore(false);
    }
  }, [mergeCandidates, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const { hasMore: hm, loading: l, loadingMore: lm } = pagingRef.current;
        if (!hm || l || lm) return;
        loadMore();
      },
      { root: null, rootMargin: '800px 0px', threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  function toggle(it) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `${it.mediaType}:${it.tmdbId}`;
      if (next.has(key)) next.delete(key);
      else next.set(key, { tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title });
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const favorites = Array.from(selected.values()).map((x) => ({ tmdbId: x.tmdbId, mediaType: x.mediaType }));
      await api.put('/api/users/onboarding', { favorites });
      window.location.href = '/';
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) setError('Сессия истекла. Войдите снова.');
      else setError(err?.response?.data?.error ?? 'Не удалось сохранить выбор. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const showContinue = true;
  const progress = Math.min(1, selectedCount / minSelect);

  return (
    <div className="onboarding-page">
      <div className="u-mb14">
        <div className="hero-actions hero-actions--g12 onboarding-header">
          <div>
            <h1 className="hero-title u-mb8">
              Отметь любимое
            </h1>
            <p className="hero-desc">
              Выбери минимум {minSelect} фильмов/сериалов — и мы соберем персональную ленту.
            </p>
          </div>
        </div>

        <div className="small u-mt8">Выбери минимум {minSelect} — прогресс и сброс всегда доступны снизу.</div>
        {error ? (
          <div className="u-mt10">
            <div className="error">{error}</div>
            <div className="hero-actions hero-actions--mt12 hero-actions--g8">
              <button className="btn" type="button" onClick={retryInitial} disabled={loading || saving}>
                Повторить
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="onboarding-grid">
        {loading
          ? skeletonItems.map((sk) => (
              <div key={`sk-${sk.id}`} className="onboarding-item onboarding-item--skeleton" aria-hidden="true" />
            ))
          : (items ?? []).map((it) => {
          const key = `${it.mediaType}:${it.tmdbId}`;
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`onboarding-item ${isSelected ? 'onboarding-item--selected' : ''}`}
              onClick={() => toggle(it)}
              title={it.title}
              aria-pressed={isSelected}
            >
              <div className="onboarding-overlay" aria-hidden="true" />
              <div className="onboarding-badge">{it.mediaType === 'tv' ? 'Сериал' : 'Фильм'}</div>
              {isSelected ? <div className="onboarding-check">✓</div> : null}
              {isSelected ? <div className="onboarding-selectedPill">Выбрано</div> : null}
              {it.posterUrl ? (
                <img className="onboarding-poster" src={it.posterUrl} alt={it.title} loading="lazy" />
              ) : (
                <div className="onboarding-fallback">{it.title}</div>
              )}
            </button>
          );
        })}
      </div>

      <div ref={sentinelRef} className="u-h1" />
      {loadingMore ? <div className="small u-mt12">Загружаю ещё…</div> : null}

      {showContinue ? (
        <div className="onboarding-sticky">
          <div className="onboarding-sticky__meta">
            <div className="onboarding-progress">
              <div className="onboarding-progress__bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="onboarding-sticky__row">
              <div className="small">Выбрано: {selectedCount} / {minSelect}</div>
              <button
                type="button"
                className="icon-btn icon-btn--reset"
                onClick={resetSelected}
                disabled={selectedCount === 0 || saving}
                aria-label="Сбросить выбор"
                title="Сбросить выбор"
              >
                ↺
              </button>
            </div>
          </div>
          <button className="btn btn--primary" onClick={save} disabled={saving || selectedCount < minSelect}>
            {saving ? 'Сохраняю…' : selectedCount < minSelect ? `Нужно ещё ${minSelect - selectedCount}` : `Хватит, продолжить (${selectedCount})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

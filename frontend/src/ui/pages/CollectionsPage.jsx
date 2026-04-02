import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, clearAuth, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { Row } from '../components/Row.jsx';
import { PosterCard } from '../components/PosterCard.jsx';

export function CollectionsPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadIdRef = useRef(0);

  const [rowErrors, setRowErrors] = useState({});

  const [trendingMovies, setTrendingMovies] = useState([]);
  const [nowMovies, setNowMovies] = useState([]);
  const [topMovies, setTopMovies] = useState([]);

  const [trendingTv, setTrendingTv] = useState([]);
  const [nowTv, setNowTv] = useState([]);
  const [topTv, setTopTv] = useState([]);

  const [pageStep, setPageStep] = useState(() => {
    try {
      const raw = localStorage.getItem('emz_page_step');
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 8 && n <= 40) return Math.min(60, Math.max(12, n));
    } catch {
      // ignore
    }
    return 20;
  });

  useEffect(() => {
    function onSettings(e) {
      const next = e?.detail?.pageStep;
      if (!Number.isFinite(next)) return;
      if (next < 8 || next > 40) return;
      setPageStep(Math.min(60, Math.max(12, next)));
    }
    window.addEventListener('emz:settings', onSettings);
    return () => window.removeEventListener('emz:settings', onSettings);
  }, []);

  const PAGE_LIMIT_STEP = pageStep;

  const initialRowPages = useMemo(
    () => ({
      tr_movie: 1,
      now_movie: 1,
      top_movie: 1,
      tr_tv: 1,
      now_tv: 1,
      top_tv: 1,
    }),
    []
  );
  const [rowPages, setRowPages] = useState(initialRowPages);
  const [rowTotalPages, setRowTotalPages] = useState({});
  const [rowLoadingMore, setRowLoadingMore] = useState({});

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      clearAuth({ redirectToLogin: true, includeNext: true });
      return;
    }
    setAuthToken(token);
  }, []);

  const mergeUnique = useCallback((prev, next) => {
    const out = [...(prev ?? [])];
    const seen = new Set(out.map((x) => `${x.mediaType}:${x.tmdbId}`));
    for (const it of next ?? []) {
      const k = `${it.mediaType}:${it.tmdbId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, []);

  const fetchRow = useCallback(async (key, page) => {
    switch (key) {
      case 'tr_movie': {
        const { data } = await api.get(`/api/movies/lists/trending?type=movie&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setTrendingMovies((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, tr_movie: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, tr_movie: '' }));
        return;
      }
      case 'now_movie': {
        const { data } = await api.get(`/api/movies/lists/now?type=movie&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setNowMovies((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, now_movie: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, now_movie: '' }));
        return;
      }
      case 'top_movie': {
        const { data } = await api.get(`/api/movies/lists/top?type=movie&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setTopMovies((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, top_movie: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, top_movie: '' }));
        return;
      }
      case 'tr_tv': {
        const { data } = await api.get(`/api/movies/lists/trending?type=tv&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setTrendingTv((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, tr_tv: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, tr_tv: '' }));
        return;
      }
      case 'now_tv': {
        const { data } = await api.get(`/api/movies/lists/now?type=tv&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setNowTv((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, now_tv: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, now_tv: '' }));
        return;
      }
      case 'top_tv': {
        const { data } = await api.get(`/api/movies/lists/top?type=tv&limit=${PAGE_LIMIT_STEP}&page=${page}`);
        setTopTv((prev) => (page === 1 ? (data?.items ?? []) : mergeUnique(prev, data?.items ?? [])));
        setRowTotalPages((prev) => ({ ...prev, top_tv: data?.totalPages ?? null }));
        setRowErrors((prev) => ({ ...prev, top_tv: '' }));
        return;
      }
      default:
        return;
    }
  }, [PAGE_LIMIT_STEP, mergeUnique]);

  const loadMoreForRow = useCallback(
    async (key) => {
      if (loading) return;
      if (rowLoadingMore?.[key]) return;

      const currentPage = rowPages?.[key] ?? 1;
      const total = rowTotalPages?.[key];
      if (total != null && currentPage >= total) return;

      setRowLoadingMore((prev) => ({ ...prev, [key]: true }));
      try {
        const nextPage = currentPage + 1;
        await fetchRow(key, nextPage);
        setRowPages((prev) => ({ ...prev, [key]: nextPage }));
      } catch (err) {
        setRowErrors((prev) => ({ ...prev, [key]: formatApiError(err, 'Не удалось догрузить. Попробуйте ещё раз.') }));
      } finally {
        setRowLoadingMore((prev) => ({ ...prev, [key]: false }));
      }
    },
    [fetchRow, loading, rowLoadingMore, rowPages, rowTotalPages]
  );

  const retryRow = useCallback(
    async (key) => {
      if (loading) return;
      if (rowLoadingMore?.[key]) return;

      setRowLoadingMore((prev) => ({ ...prev, [key]: true }));
      try {
        await fetchRow(key, 1);
        setRowPages((prev) => ({ ...prev, [key]: 1 }));
        setRowErrors((prev) => ({ ...prev, [key]: '' }));
      } catch (err) {
        setRowErrors((prev) => ({ ...prev, [key]: formatApiError(err, 'Не удалось загрузить витрину. Можно попробовать ещё раз.') }));
      } finally {
        setRowLoadingMore((prev) => ({ ...prev, [key]: false }));
      }
    },
    [fetchRow, loading, rowLoadingMore]
  );

  const loadAll = useCallback(async () => {
    const loadId = (loadIdRef.current += 1);
    setError('');
    setLoading(true);
    try {
      setRowPages((prev) => ({ ...prev, ...initialRowPages }));
      setRowTotalPages({});
      setRowLoadingMore({});

      const settled = await Promise.allSettled([
        api.get(`/api/movies/lists/trending?type=movie&limit=${PAGE_LIMIT_STEP}&page=1`),
        api.get(`/api/movies/lists/now?type=movie&limit=${PAGE_LIMIT_STEP}&page=1`),
        api.get(`/api/movies/lists/top?type=movie&limit=${PAGE_LIMIT_STEP}&page=1`),
        api.get(`/api/movies/lists/trending?type=tv&limit=${PAGE_LIMIT_STEP}&page=1`),
        api.get(`/api/movies/lists/now?type=tv&limit=${PAGE_LIMIT_STEP}&page=1`),
        api.get(`/api/movies/lists/top?type=tv&limit=${PAGE_LIMIT_STEP}&page=1`),
      ]);

      if (loadIdRef.current !== loadId) return;

      const firstRejection = settled.find((x) => x.status === 'rejected')?.reason;
      const rejectedCount = settled.filter((x) => x.status === 'rejected').length;

      const trM = settled[0].status === 'fulfilled' ? settled[0].value : null;
      const nowM = settled[1].status === 'fulfilled' ? settled[1].value : null;
      const topM = settled[2].status === 'fulfilled' ? settled[2].value : null;
      const trT = settled[3].status === 'fulfilled' ? settled[3].value : null;
      const nowT = settled[4].status === 'fulfilled' ? settled[4].value : null;
      const topT = settled[5].status === 'fulfilled' ? settled[5].value : null;

      setTrendingMovies(trM?.data?.items ?? []);
      setNowMovies(nowM?.data?.items ?? []);
      setTopMovies(topM?.data?.items ?? []);
      setTrendingTv(trT?.data?.items ?? []);
      setNowTv(nowT?.data?.items ?? []);
      setTopTv(topT?.data?.items ?? []);

      setRowErrors({
        tr_movie: settled[0].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        now_movie: settled[1].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        top_movie: settled[2].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        tr_tv: settled[3].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        now_tv: settled[4].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        top_tv: settled[5].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
      });

      setRowTotalPages({
        tr_movie: trM?.data?.totalPages ?? null,
        now_movie: nowM?.data?.totalPages ?? null,
        top_movie: topM?.data?.totalPages ?? null,
        tr_tv: trT?.data?.totalPages ?? null,
        now_tv: nowT?.data?.totalPages ?? null,
        top_tv: topT?.data?.totalPages ?? null,
      });

      if (rejectedCount) {
        const status = firstRejection?.response?.status;
        if (status === 401) setError('Сессия истекла. Войдите снова.');
        else if (status >= 500) setError('Часть подборок временно недоступна.');
        else setError(firstRejection?.response?.data?.error ?? 'Не удалось загрузить подборки');
      }
    } catch (err) {
      if (loadIdRef.current !== loadId) return;
      setError(formatApiError(err, 'Не удалось загрузить подборки'));
    } finally {
      if (loadIdRef.current !== loadId) return;
      setLoading(false);
    }
  }, [PAGE_LIMIT_STEP, initialRowPages]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const reloadAll = useCallback(() => {
    return loadAll();
  }, [loadAll]);

  const onRated = useCallback(() => {
    // keep collections stable
  }, []);

  const renderItem = useCallback((it) => {
    return <PosterCard key={`${it.mediaType}:${it.tmdbId}`} item={it} onRated={onRated} />;
  }, [onRated]);


  return (
    <div>
      <div className="hero hero--mb14 hero--recs">
        <h1 className="hero-title">Подборки</h1>
        <p className="hero-desc">
          Тренды, новинки и топ — витрины из TMDB. Листай горизонтально: ряды будут догружаться автоматически.
        </p>
        <div className="hero-actions hero-actions--mt12 hero-actions--g12">
          <button className="btn btn--primary" onClick={reloadAll} disabled={loading}>
            {loading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>
        {loading ? <div className="small u-mt10">Загружаю подборки…</div> : null}
        {error ? <div className="error u-mt10">{error}</div> : null}
      </div>

      <Row
        title="Фильмы — Тренды недели"
        subtitle="Что обсуждают прямо сейчас"
        items={trendingMovies}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.tr_movie}
        onRetry={() => retryRow('tr_movie')}
        loadingMore={Boolean(rowLoadingMore?.tr_movie)}
        onEndReached={() => loadMoreForRow('tr_movie')}
      />
      <Row
        title="Фильмы — Новинки"
        subtitle="Сейчас в прокате"
        items={nowMovies}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.now_movie}
        onRetry={() => retryRow('now_movie')}
        loadingMore={Boolean(rowLoadingMore?.now_movie)}
        onEndReached={() => loadMoreForRow('now_movie')}
      />
      <Row
        title="Фильмы — Топ рейтинга"
        subtitle="Лучшее по оценкам"
        items={topMovies}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.top_movie}
        onRetry={() => retryRow('top_movie')}
        loadingMore={Boolean(rowLoadingMore?.top_movie)}
        onEndReached={() => loadMoreForRow('top_movie')}
      />

      <Row
        title="Сериалы — Тренды недели"
        subtitle="TV в тренде"
        items={trendingTv}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.tr_tv}
        onRetry={() => retryRow('tr_tv')}
        loadingMore={Boolean(rowLoadingMore?.tr_tv)}
        onEndReached={() => loadMoreForRow('tr_tv')}
      />
      <Row
        title="Сериалы — Новинки"
        subtitle="Сейчас в эфире"
        items={nowTv}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.now_tv}
        onRetry={() => retryRow('now_tv')}
        loadingMore={Boolean(rowLoadingMore?.now_tv)}
        onEndReached={() => loadMoreForRow('now_tv')}
      />
      <Row
        title="Сериалы — Топ рейтинга"
        subtitle="Лучшее по оценкам"
        items={topTv}
        loading={loading}
        hideIfEmpty
        renderItem={renderItem}
        error={rowErrors?.top_tv}
        onRetry={() => retryRow('top_tv')}
        loadingMore={Boolean(rowLoadingMore?.top_tv)}
        onEndReached={() => loadMoreForRow('top_tv')}
      />
    </div>
  );
}

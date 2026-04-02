import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { Row } from '../components/Row.jsx';
import { PosterCard } from '../components/PosterCard.jsx';

export function HomePage({ searchQuery, onSearchQueryChange }) {
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const loadIdRef = useRef(0);

  const authed = Boolean(getStoredAuthToken());

  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const [forYouMovies, setForYouMovies] = useState([]);
  const [forYouTv, setForYouTv] = useState([]);

  const [similarMovies, setSimilarMovies] = useState([]);
  const [similarTv, setSimilarTv] = useState([]);

  const [moodTenseMovies, setMoodTenseMovies] = useState([]);
  const [moodTenseTv, setMoodTenseTv] = useState([]);

  const [rowErrors, setRowErrors] = useState({});

  const [becauseRowsMovies, setBecauseRowsMovies] = useState([]);
  const [becauseRowsTv, setBecauseRowsTv] = useState([]);
  const [becauseLoadingMore, setBecauseLoadingMore] = useState({});
  const becauseLoadingMoreRef = useRef({});

  const [fallbackLiked, setFallbackLiked] = useState([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const [pageStep, setPageStep] = useState(() => {
    try {
      const raw = localStorage.getItem('emz_page_step');
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 8 && n <= 40) return n;
    } catch {
      // ignore
    }
    return 16;
  });

  useEffect(() => {
    function onSettings(e) {
      const next = e?.detail?.pageStep;
      if (!Number.isFinite(next)) return;
      if (next < 8 || next > 40) return;
      setPageStep(next);
    }
    window.addEventListener('emz:settings', onSettings);
    return () => window.removeEventListener('emz:settings', onSettings);
  }, []);

  const PAGE_LIMIT_STEP = pageStep;
  const POOL_LIMIT = 500;
  const initialRowLimits = useMemo(
    () => ({
      fy_movie: PAGE_LIMIT_STEP,
      fy_tv: PAGE_LIMIT_STEP,
      su_movie: PAGE_LIMIT_STEP,
      su_tv: PAGE_LIMIT_STEP,
      mood_tense_movie: PAGE_LIMIT_STEP,
      mood_tense_tv: PAGE_LIMIT_STEP,
    }),
    [PAGE_LIMIT_STEP]
  );
  const [rowLimits, setRowLimits] = useState(initialRowLimits);
  const [rowLoadingMore, setRowLoadingMore] = useState({});

  useEffect(() => {
    setRowLimits((prev) => ({ ...prev, ...initialRowLimits }));
  }, [initialRowLimits]);

  const forYouMoviesVisible = useMemo(() => (forYouMovies ?? []).slice(0, rowLimits?.fy_movie ?? PAGE_LIMIT_STEP), [forYouMovies, rowLimits, PAGE_LIMIT_STEP]);
  const forYouTvVisible = useMemo(() => (forYouTv ?? []).slice(0, rowLimits?.fy_tv ?? PAGE_LIMIT_STEP), [forYouTv, rowLimits, PAGE_LIMIT_STEP]);
  const similarMoviesVisible = useMemo(() => (similarMovies ?? []).slice(0, rowLimits?.su_movie ?? PAGE_LIMIT_STEP), [similarMovies, rowLimits, PAGE_LIMIT_STEP]);
  const similarTvVisible = useMemo(() => (similarTv ?? []).slice(0, rowLimits?.su_tv ?? PAGE_LIMIT_STEP), [similarTv, rowLimits, PAGE_LIMIT_STEP]);
  const moodTenseMoviesVisible = useMemo(() => (moodTenseMovies ?? []).slice(0, rowLimits?.mood_tense_movie ?? PAGE_LIMIT_STEP), [moodTenseMovies, rowLimits, PAGE_LIMIT_STEP]);
  const moodTenseTvVisible = useMemo(() => (moodTenseTv ?? []).slice(0, rowLimits?.mood_tense_tv ?? PAGE_LIMIT_STEP), [moodTenseTv, rowLimits, PAGE_LIMIT_STEP]);

  const normalizedSearch = useMemo(() => (searchQuery ?? '').trim(), [searchQuery]);
  const searchMode = Boolean(normalizedSearch);

  const becauseItemsCount = useMemo(() => {
    const m = (becauseRowsMovies ?? []).reduce((acc, row) => acc + (row?.items?.length ?? 0), 0);
    const tv = (becauseRowsTv ?? []).reduce((acc, row) => acc + (row?.items?.length ?? 0), 0);
    return m + tv;
  }, [becauseRowsMovies, becauseRowsTv]);

  const hasAnyRecs = useMemo(() => {
    return (
      (forYouMovies?.length ?? 0) +
        (forYouTv?.length ?? 0) +
        (similarMovies?.length ?? 0) +
        (similarTv?.length ?? 0) +
        (moodTenseMovies?.length ?? 0) +
        (moodTenseTv?.length ?? 0) +
        (becauseItemsCount ?? 0) +
        (fallbackLiked?.length ?? 0) >
      0
    );
  }, [
    forYouMovies,
    forYouTv,
    similarMovies,
    similarTv,
    moodTenseMovies,
    moodTenseTv,
    becauseItemsCount,
    fallbackLiked,
  ]);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    becauseLoadingMoreRef.current = becauseLoadingMore ?? {};
  }, [becauseLoadingMore]);

  const mergeUnique = useCallback((prev, next) => {
    const out = [...(prev ?? [])];
    const seen = new Set(out.map((x) => `${x.mediaType}:${x.tmdbId}`));
    for (const it of next ?? []) {
      if (!it?.tmdbId || !it?.mediaType) continue;
      const k = `${it.mediaType}:${it.tmdbId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, []);

  const trendingFallbackRef = useRef({ movie: [], tv: [] });
  const trendingFallbackPageRef = useRef({
    movie: { trending: 0, popular: 0, top: 0, now: 0 },
    tv: { trending: 0, popular: 0, top: 0, now: 0 },
  });
  const trendingFallbackTotalRef = useRef({
    movie: { trending: null, popular: null, top: null, now: null },
    tv: { trending: null, popular: null, top: null, now: null },
  });
  const trendingFallbackCursorRef = useRef({ movie: 0, tv: 0 });
  const trendingFallbackLoadingRef = useRef({ movie: false, tv: false });

  const FALLBACK_KINDS = useMemo(() => ['trending', 'popular', 'top', 'now'], []);

  const ensureTrendingFallback = useCallback(
    async (mediaType, minCount) => {
      const mt = mediaType === 'tv' ? 'tv' : 'movie';
      if ((trendingFallbackRef.current?.[mt]?.length ?? 0) >= minCount) return;
      if (trendingFallbackLoadingRef.current?.[mt]) return;

      trendingFallbackLoadingRef.current = { ...trendingFallbackLoadingRef.current, [mt]: true };
      try {
        let guard = 0;
        while ((trendingFallbackRef.current?.[mt]?.length ?? 0) < minCount) {
          if (guard++ > 18) break;

          const cursor = trendingFallbackCursorRef.current?.[mt] ?? 0;
          const kind = FALLBACK_KINDS[cursor % FALLBACK_KINDS.length];

          const pageByKind = trendingFallbackPageRef.current?.[mt]?.[kind] ?? 0;
          const totalByKind = trendingFallbackTotalRef.current?.[mt]?.[kind] ?? null;
          if (totalByKind != null && pageByKind >= totalByKind) {
            trendingFallbackCursorRef.current = { ...trendingFallbackCursorRef.current, [mt]: cursor + 1 };
            continue;
          }

          const nextPage = pageByKind + 1;
          const cappedPage = Math.min(500, Math.max(1, nextPage));
          const { data } = await api.get(`/api/movies/lists/${kind}?type=${mt}&limit=60&page=${cappedPage}`);
          const items = data?.items ?? [];

          trendingFallbackRef.current = {
            ...trendingFallbackRef.current,
            [mt]: mergeUnique(trendingFallbackRef.current?.[mt] ?? [], items),
          };
          trendingFallbackPageRef.current = {
            ...trendingFallbackPageRef.current,
            [mt]: { ...(trendingFallbackPageRef.current?.[mt] ?? {}), [kind]: cappedPage },
          };
          trendingFallbackTotalRef.current = {
            ...trendingFallbackTotalRef.current,
            [mt]: { ...(trendingFallbackTotalRef.current?.[mt] ?? {}), [kind]: data?.totalPages ?? null },
          };

          if ((items?.length ?? 0) === 0) {
            trendingFallbackCursorRef.current = { ...trendingFallbackCursorRef.current, [mt]: cursor + 1 };
            continue;
          }

          if (cappedPage >= 6) {
            trendingFallbackCursorRef.current = { ...trendingFallbackCursorRef.current, [mt]: cursor + 1 };
          }
        }
      } finally {
        trendingFallbackLoadingRef.current = { ...trendingFallbackLoadingRef.current, [mt]: false };
      }
    },
    [FALLBACK_KINDS, mergeUnique]
  );

  const maybeAppendTrendingFallback = useCallback(
    async (mediaType, prevLen, setter) => {
      if (!Number.isFinite(prevLen)) return;
      const target = Math.min(prevLen + PAGE_LIMIT_STEP, POOL_LIMIT);
      await ensureTrendingFallback(mediaType, target);
      const mt = mediaType === 'tv' ? 'tv' : 'movie';
      const pool = trendingFallbackRef.current?.[mt] ?? [];
      const slice = pool.slice(0, target);
      if ((slice?.length ?? 0) === 0) return;

      setter((prev) => mergeUnique(prev ?? [], slice));
    },
    [PAGE_LIMIT_STEP, POOL_LIMIT, ensureTrendingFallback, mergeUnique]
  );

  const fetchRow = useCallback(
    async (key, nextLimit) => {
      const capped = Math.min(nextLimit, POOL_LIMIT);
      switch (key) {
        case 'fy_movie': {
          setRowLimits((prev) => ({ ...prev, fy_movie: nextLimit }));
          const prevLen = forYouMovies?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/for-you?limit=${capped}&type=movie`);
          const next = data?.recommendations ?? [];
          setForYouMovies((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('movie', prevLen, setForYouMovies);
          }
          setRowErrors((prev) => ({ ...prev, fy_movie: '' }));
          return;
        }
        case 'fy_tv': {
          setRowLimits((prev) => ({ ...prev, fy_tv: nextLimit }));
          const prevLen = forYouTv?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/for-you?limit=${capped}&type=tv`);
          const next = data?.recommendations ?? [];
          setForYouTv((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('tv', prevLen, setForYouTv);
          }
          setRowErrors((prev) => ({ ...prev, fy_tv: '' }));
          return;
        }
        case 'su_movie': {
          setRowLimits((prev) => ({ ...prev, su_movie: nextLimit }));
          const prevLen = similarMovies?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/similar-users?limit=${capped}&type=movie`);
          const next = data?.recommendations ?? [];
          setSimilarMovies((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('movie', prevLen, setSimilarMovies);
          }
          setRowErrors((prev) => ({ ...prev, su_movie: '' }));
          return;
        }
        case 'su_tv': {
          setRowLimits((prev) => ({ ...prev, su_tv: nextLimit }));
          const prevLen = similarTv?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/similar-users?limit=${capped}&type=tv`);
          const next = data?.recommendations ?? [];
          setSimilarTv((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('tv', prevLen, setSimilarTv);
          }
          setRowErrors((prev) => ({ ...prev, su_tv: '' }));
          return;
        }
        case 'mood_tense_movie': {
          setRowLimits((prev) => ({ ...prev, mood_tense_movie: nextLimit }));
          const prevLen = moodTenseMovies?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/mood?mood=tense&limit=${capped}&type=movie`);
          const next = data?.recommendations ?? [];
          setMoodTenseMovies((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('movie', prevLen, setMoodTenseMovies);
          }
          setRowErrors((prev) => ({ ...prev, mood_tense_movie: '' }));
          return;
        }
        case 'mood_tense_tv': {
          setRowLimits((prev) => ({ ...prev, mood_tense_tv: nextLimit }));
          const prevLen = moodTenseTv?.length ?? 0;
          if (prevLen >= capped) return;
          const { data } = await api.get(`/api/recommendations/mood?mood=tense&limit=${capped}&type=tv`);
          const next = data?.recommendations ?? [];
          setMoodTenseTv((prev) => {
            const prevLen = prev?.length ?? 0;
            if (prevLen === 0) return next;
            if ((next?.length ?? 0) <= prevLen) return prev;
            return [...prev, ...next.slice(prevLen)];
          });
          if ((next?.length ?? 0) <= prevLen) {
            await maybeAppendTrendingFallback('tv', prevLen, setMoodTenseTv);
          }
          setRowErrors((prev) => ({ ...prev, mood_tense_tv: '' }));
          return;
        }
        default:
          return;
      }
    },
    [POOL_LIMIT, forYouMovies, forYouTv, maybeAppendTrendingFallback, moodTenseMovies, moodTenseTv, similarMovies, similarTv]
  );

  const loadMoreForRow = useCallback(
    async (key) => {
      if (searchMode) return;
      if (loading) return;
      if (rowLoadingMore?.[key]) return;

      const current = rowLimits?.[key] ?? PAGE_LIMIT_STEP;
      const nextLimit = current + PAGE_LIMIT_STEP;
      setRowLoadingMore((prev) => ({ ...prev, [key]: true }));
      try {
        await fetchRow(key, nextLimit);
      } catch (err) {
        setRowErrors((prev) => ({ ...prev, [key]: formatApiError(err, 'Не удалось догрузить. Попробуйте ещё раз.') }));
      } finally {
        setRowLoadingMore((prev) => ({ ...prev, [key]: false }));
      }
    },
    [PAGE_LIMIT_STEP, fetchRow, loading, rowLimits, rowLoadingMore, searchMode]
  );

  const retryRow = useCallback(
    async (key) => {
      if (searchMode) return;
      if (loading) return;
      if (rowLoadingMore?.[key]) return;

      setRowLoadingMore((prev) => ({ ...prev, [key]: true }));
      try {
        await fetchRow(key, PAGE_LIMIT_STEP);
        setRowErrors((prev) => ({ ...prev, [key]: '' }));
      } catch (err) {
        setRowErrors((prev) => ({ ...prev, [key]: formatApiError(err, 'Не удалось загрузить витрину. Можно попробовать ещё раз.') }));
      } finally {
        setRowLoadingMore((prev) => ({ ...prev, [key]: false }));
      }
    },
    [PAGE_LIMIT_STEP, fetchRow, loading, rowLoadingMore, searchMode]
  );

  useEffect(() => {
    let mounted = true;

    async function check() {
      const token = getStoredAuthToken();
      if (!token) {
        if (mounted) setCheckedOnboarding(true);
        return;
      }

      try {
        setAuthToken(token);
        const me = await api.get('/api/users/me');
        const completedAt = me?.data?.user?.onboarding?.completedAt;
        if (!completedAt) {
          window.location.href = '/onboarding';
          return;
        }
      } catch (err) {
        // ignore and let API calls fail with auth errors
      } finally {
        if (mounted) setCheckedOnboarding(true);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, []);

  if (checkedOnboarding && !authed) {
    return (
      <div>
        <div className="hero">
          <h1 className="hero-title">EMZ — персональные рекомендации</h1>
          <p className="hero-desc">
            Войди или зарегистрируйся, чтобы собрать вкус в онбординге и получить ленту фильмов/сериалов.
          </p>
          <div className="hero-actions hero-actions--mt14">
            <a className="btn link-reset" href="/login">Войти</a>
            <a className="btn link-reset" href="/register">Регистрация</a>
          </div>
        </div>
      </div>
    );
  }

  const load = useCallback(async () => {
    const loadId = (loadIdRef.current += 1);
    setError('');
    setLoading(true);
    setSecondaryLoading(false);
    try {
      const limit = PAGE_LIMIT_STEP;

      setRowLimits((prev) => ({ ...prev, ...initialRowLimits }));
      setRowLoadingMore({});

      const primary = await Promise.allSettled([
        api.get(`/api/recommendations/for-you?limit=${limit}&type=movie`),
        api.get(`/api/recommendations/for-you?limit=${limit}&type=tv`),
        api.get(`/api/recommendations/similar-users?limit=${limit}&type=movie`),
        api.get(`/api/recommendations/similar-users?limit=${limit}&type=tv`),
        api.get('/api/actions/recent-liked?limit=1&type=movie'),
        api.get('/api/actions/recent-liked?limit=1&type=tv'),
      ]);

      if (loadIdRef.current !== loadId) return;

      const firstRejection = primary.find((x) => x.status === 'rejected')?.reason;
      const rejectedCount = primary.filter((x) => x.status === 'rejected').length;

      const fyMovies = primary[0].status === 'fulfilled' ? primary[0].value : null;
      const fyTv = primary[1].status === 'fulfilled' ? primary[1].value : null;
      const simMovies = primary[2].status === 'fulfilled' ? primary[2].value : null;
      const simTv = primary[3].status === 'fulfilled' ? primary[3].value : null;
      const seedsMoviesRes = primary[4].status === 'fulfilled' ? primary[4].value : null;
      const seedsTvRes = primary[5].status === 'fulfilled' ? primary[5].value : null;

      setForYouMovies(fyMovies?.data?.recommendations ?? []);
      setForYouTv(fyTv?.data?.recommendations ?? []);
      setSimilarMovies(simMovies?.data?.recommendations ?? []);
      setSimilarTv(simTv?.data?.recommendations ?? []);

      setRowErrors((prev) => ({
        ...prev,
        fy_movie: primary[0].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        fy_tv: primary[1].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        su_movie: primary[2].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
        su_tv: primary[3].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : '',
      }));

      setRowLimits((prev) => ({ ...prev, ...initialRowLimits }));

      const movieSeeds = seedsMoviesRes?.data?.seeds ?? [];
      const tvSeeds = seedsTvRes?.data?.seeds ?? [];

      const likedFallback = [...movieSeeds, ...tvSeeds]
        .filter((s) => s?.tmdbId && s?.mediaType)
        .map((s) => ({
          tmdbId: s.tmdbId,
          mediaType: s.mediaType,
          title: s.title ?? null,
          overview: s.overview ?? null,
          posterUrl: s.posterUrl ?? null,
          explanation: null,
          score: null,
        }));
      setFallbackLiked(likedFallback);

      if (rejectedCount) {
        const status = firstRejection?.response?.status;
        if (status === 401) setError('Сессия истекла. Войдите снова.');
        else if (status >= 500) setError('Часть витрин временно недоступна. Лента может быть неполной.');
        else setError(firstRejection?.response?.data?.error ?? 'Не удалось загрузить часть ленты');
      }

      setLoading(false);

      Promise.resolve()
        .then(async () => {
          await Promise.allSettled([
            ensureTrendingFallback('movie', Math.min(POOL_LIMIT, Math.max(120, limit * 3))),
            ensureTrendingFallback('tv', Math.min(POOL_LIMIT, Math.max(120, limit * 3))),
          ]);
        })
        .catch(() => null);

      setSecondaryLoading(true);

      const moodSettled = await Promise.allSettled([
        api.get(`/api/recommendations/mood?mood=tense&limit=${limit}&type=movie`),
        api.get(`/api/recommendations/mood?mood=tense&limit=${limit}&type=tv`),
      ]);

      if (loadIdRef.current !== loadId) return;

      const moodTenseMoviesRes = moodSettled[0].status === 'fulfilled' ? moodSettled[0].value : null;
      const moodTenseTvRes = moodSettled[1].status === 'fulfilled' ? moodSettled[1].value : null;

      setMoodTenseMovies(moodTenseMoviesRes?.data?.recommendations ?? []);
      setMoodTenseTv(moodTenseTvRes?.data?.recommendations ?? []);

      setRowErrors((prev) => ({
        ...prev,
        mood_tense_movie: moodSettled[0].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : prev?.mood_tense_movie ?? '',
        mood_tense_tv: moodSettled[1].status === 'rejected' ? 'Не удалось загрузить витрину. Можно попробовать ещё раз.' : prev?.mood_tense_tv ?? '',
      }));

      const movieBecauseSettled = await Promise.allSettled(
        movieSeeds.map(async (s) => {
          const { data } = await api.get(`/api/recommendations/because?tmdbId=${s.tmdbId}&type=${s.mediaType}&limit=14`);
          return {
            seed: s,
            items: data.recommendations ?? [],
            page: data?.page ?? 1,
            totalPages: data?.totalPages ?? null,
            strategy: data?.strategy ?? null,
          };
        })
      );
      const tvBecauseSettled = await Promise.allSettled(
        tvSeeds.map(async (s) => {
          const { data } = await api.get(`/api/recommendations/because?tmdbId=${s.tmdbId}&type=${s.mediaType}&limit=14`);
          return {
            seed: s,
            items: data.recommendations ?? [],
            page: data?.page ?? 1,
            totalPages: data?.totalPages ?? null,
            strategy: data?.strategy ?? null,
          };
        })
      );

      if (loadIdRef.current !== loadId) return;

      setBecauseRowsMovies(movieBecauseSettled.filter((x) => x.status === 'fulfilled').map((x) => x.value));
      setBecauseRowsTv(tvBecauseSettled.filter((x) => x.status === 'fulfilled').map((x) => x.value));

      setSecondaryLoading(false);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) setError('Сессия истекла. Войдите снова.');
      else if (status >= 500) setError('Сервис рекомендаций сейчас недоступен. Попробуйте обновить страницу позже.');
      else setError(err?.response?.data?.error ?? 'Не удалось загрузить ленту');
    } finally {
      if (loadIdRef.current !== loadId) return;
      setLoading(false);
      setSecondaryLoading(false);
    }
  }, [PAGE_LIMIT_STEP, initialRowLimits]);

  useEffect(() => {
    if (!checkedOnboarding) return;
    const token = getStoredAuthToken();
    if (!token) return;
    if (searchMode) return;
    if (!autoLoaded) return;
    load();
  }, [autoLoaded, checkedOnboarding, load, pageStep, searchMode]);

  useEffect(() => {
    if (!checkedOnboarding) return;
    if (autoLoaded) return;
    const token = getStoredAuthToken();
    if (!token) return;
    if (searchMode) return;
    setAutoLoaded(true);
    load();
  }, [autoLoaded, checkedOnboarding, load, searchMode]);

  const prevSearchModeRef = useRef(searchMode);
  useEffect(() => {
    if (!checkedOnboarding || !autoLoaded) {
      prevSearchModeRef.current = searchMode;
      return;
    }

    const wasSearch = prevSearchModeRef.current;
    if (wasSearch && !searchMode) {
      const token = getStoredAuthToken();
      if (token) load();
    }
    prevSearchModeRef.current = searchMode;
  }, [autoLoaded, checkedOnboarding, load, searchMode]);

  const onRatedInFeed = useCallback(() => {
    if (searchMode) return;
    load();
  }, [load, searchMode]);

  const loadMoreBecause = useCallback(
    async ({ seedTmdbId, mediaType }) => {
      const key = `${mediaType}:${seedTmdbId}`;
      if (becauseLoadingMoreRef.current?.[key]) return;

      const rows = mediaType === 'tv' ? becauseRowsTv : becauseRowsMovies;
      const row = (rows ?? []).find((r) => r?.seed?.tmdbId === seedTmdbId);
      if (!row) return;

      const currentPage = row?.page ?? 1;
      const totalPages = row?.totalPages ?? null;
      if (totalPages != null && currentPage >= totalPages) return;

      const nextPage = currentPage + 1;

      becauseLoadingMoreRef.current = { ...(becauseLoadingMoreRef.current ?? {}), [key]: true };
      setBecauseLoadingMore((prev) => ({ ...prev, [key]: true }));
      try {
        const { data } = await api.get(
          `/api/recommendations/because?tmdbId=${seedTmdbId}&type=${mediaType}&limit=14&page=${nextPage}`
        );

        const nextItems = data?.recommendations ?? [];
        const nextTotalPages = data?.totalPages ?? totalPages;

        if (mediaType === 'tv') {
          setBecauseRowsTv((prev) =>
            (prev ?? []).map((r) => {
              if (r?.seed?.tmdbId !== seedTmdbId) return r;
              return {
                ...r,
                items: mergeUnique(r?.items ?? [], nextItems),
                page: nextPage,
                totalPages: nextTotalPages,
                strategy: r?.strategy ?? data?.strategy,
              };
            })
          );
        } else {
          setBecauseRowsMovies((prev) =>
            (prev ?? []).map((r) => {
              if (r?.seed?.tmdbId !== seedTmdbId) return r;
              return {
                ...r,
                items: mergeUnique(r?.items ?? [], nextItems),
                page: nextPage,
                totalPages: nextTotalPages,
                strategy: r?.strategy ?? data?.strategy,
              };
            })
          );
        }

        setRowErrors((prev) => ({ ...prev, [key]: '' }));
      } catch (err) {
        setRowErrors((prev) => ({ ...prev, [key]: formatApiError(err, 'Не удалось догрузить. Попробуйте ещё раз.') }));
      } finally {
        becauseLoadingMoreRef.current = { ...(becauseLoadingMoreRef.current ?? {}), [key]: false };
        setBecauseLoadingMore((prev) => ({ ...prev, [key]: false }));
      }
    },
    [becauseRowsMovies, becauseRowsTv, mergeUnique]
  );

  const renderFallbackLiked = useCallback(
    (it) => <PosterCard key={`liked-${it.mediaType}-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );

  const onRatedInSearch = useCallback((ratedItem) => {
    setSearchResults((prev) =>
      (prev ?? []).filter((x) => `${x.mediaType}:${x.tmdbId}` !== `${ratedItem.mediaType}:${ratedItem.tmdbId}`)
    );
  }, []);

  const renderForYouMovie = useCallback(
    (it) => <PosterCard key={`fy-m-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );
  const renderForYouTv = useCallback(
    (it) => <PosterCard key={`fy-t-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );
  const renderSimilarMovie = useCallback(
    (it) => <PosterCard key={`su-m-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );
  const renderSimilarTv = useCallback(
    (it) => <PosterCard key={`su-t-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );
  const renderMoodTenseMovie = useCallback(
    (it) => <PosterCard key={`moodtense-m-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );
  const renderMoodTenseTv = useCallback(
    (it) => <PosterCard key={`moodtense-t-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />,
    [onRatedInFeed]
  );

  const becauseMovieRows = useMemo(() => {
    return (becauseRowsMovies ?? []).map((row) => {
      const seedId = row?.seed?.tmdbId;
      return {
        ...row,
        renderItem: (it) => (
          <PosterCard key={`because-m-${seedId}-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />
        ),
      };
    });
  }, [becauseRowsMovies, onRatedInFeed]);

  const becauseTvRows = useMemo(() => {
    return (becauseRowsTv ?? []).map((row) => {
      const seedId = row?.seed?.tmdbId;
      return {
        ...row,
        renderItem: (it) => (
          <PosterCard key={`because-t-${seedId}-${it.tmdbId}`} item={it} onRated={onRatedInFeed} />
        ),
      };
    });
  }, [becauseRowsTv, onRatedInFeed]);

  const curatedBecauseMovieRows = useMemo(() => {
    const rows = (becauseMovieRows ?? [])
      .filter((r) => (r?.items?.length ?? 0) >= 8)
      .slice(0, 1);
    return rows;
  }, [becauseMovieRows]);

  const curatedBecauseTvRows = useMemo(() => {
    const rows = (becauseTvRows ?? [])
      .filter((r) => (r?.items?.length ?? 0) >= 8)
      .slice(0, 1);
    return rows;
  }, [becauseTvRows]);

  useEffect(() => {
    let mounted = true;
    if (!searchMode) {
      if (mounted) setSearchResults([]);
      if (mounted) setSearchLoading(false);
      if (mounted) setError('');
      return;
    }

    const token = getStoredAuthToken();
    if (!token) return;

    const t = setTimeout(async () => {
      setError('');
      setSearchLoading(true);
      try {
        const [m, tv] = await Promise.all([
          api.get(`/api/movies/search?q=${encodeURIComponent(normalizedSearch)}&type=movie`),
          api.get(`/api/movies/search?q=${encodeURIComponent(normalizedSearch)}&type=tv`),
        ]);

        const merged = [...(m.data?.results ?? []), ...(tv.data?.results ?? [])]
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
        setSearchResults(merged);
      } catch (err) {
        if (!mounted) return;
        const status = err?.response?.status;
        if (status === 401) setError('Сессия истекла. Войдите снова.');
        else if (status >= 500) setError('Поиск временно недоступен. Попробуйте чуть позже.');
        else setError(err?.response?.data?.error ?? 'Поиск не удался');
      } finally {
        if (mounted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [searchMode, normalizedSearch]);

  return (
    <div>
      {loading && !searchMode ? (
        <div className="hero hero--mb14">
          <h1 className="hero-title">Подбираем рекомендации…</h1>
          <p className="hero-desc">Это может занять несколько секунд, если ML-сервис отвечает медленно.</p>
        </div>
      ) : null}

      {searchMode ? (
        <div className="hero hero--mb14">
          <h1 className="hero-title">Поиск</h1>
          <p className="hero-desc">Введите название фильма или сериала — можно оценивать прямо из поиска.</p>
        </div>
      ) : (
        <div className="hero hero--mb14 hero--recs">
          <h1 className="hero-title">Рекомендации для вас</h1>
          <p className="hero-desc">Оценивайте — и витрины станут точнее. Мы держим ленту короткой: только то, что реально стоит посмотреть.</p>
          {searchMode ? (
            <div className="small u-mt10">
              Поиск: «{normalizedSearch}»
              {' '}
              <button className="btn btn-sm u-ml10" onClick={() => onSearchQueryChange?.('')}>
                Очистить
              </button>
            </div>
          ) : (
            <div className="small u-mt10">
              Если лента пустая — поставьте несколько лайков через поиск или онбординг.
            </div>
          )}

          {!searchMode ? (
            <div className="hero-actions hero-actions--mt12 hero-actions--g12">
              <button className="btn btn--primary" onClick={() => load()} disabled={loading || secondaryLoading}>
                {loading ? 'Обновляю…' : 'Обновить ленту'}
              </button>
            </div>
          ) : null}
          {!searchMode && loading ? <div className="small u-mt10">Загружаю ленту…</div> : null}
          {!searchMode && !loading && secondaryLoading ? <div className="small u-mt10">Догружаю дополнительные витрины…</div> : null}
          {error ? <div className="error u-mt10">{error}</div> : null}
        </div>
      )}

      {searchMode ? (
        <div>
          {searchLoading ? (
            <div className="results-grid results-grid--mt10">
              {Array.from({ length: 18 }).map((_, idx) => (
                <div key={idx} className="tile-skeleton">
                  <div className="tile-skeleton__poster skeleton" />
                  <div className="skeleton skeleton-line skeleton-line--mt8" />
                </div>
              ))}
            </div>
          ) : null}

          {!searchLoading && searchResults.length === 0 ? (
            <div className="hero hero-card">
              <div className="hero-title hero-title--sm u-mb4">Ничего не найдено</div>
              <div className="hero-desc">Попробуй другое название или уточни запрос.</div>
            </div>
          ) : null}

          {!searchLoading && searchResults.length > 0 ? (
            <div className="results-grid">
              {searchResults.map((it) => (
                <PosterCard key={`${it.mediaType}:${it.tmdbId}`} item={it} onRated={onRatedInSearch} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>

      {checkedOnboarding && !loading && !hasAnyRecs ? (
        <div className="hero hero--mb14">
          <div className="hero-title hero-title--sm">Пока пусто</div>
          <div className="hero-desc">
            Поставь несколько лайков в онбординге или через поиск — и здесь появятся персональные витрины.
          </div>
          <div className="hero-actions hero-actions--mt12">
            <button className="btn" onClick={() => (window.location.href = '/onboarding')}>Продолжить онбординг</button>
            <button className="btn" onClick={() => onSearchQueryChange?.('top')}>Открыть поиск</button>
          </div>
        </div>
      ) : null}

      {!loading && !searchMode && !hasAnyRecs && (fallbackLiked?.length ?? 0) > 0 ? (
        <Row
          title="Ваши лайки"
          subtitle="То, что вы уже отметили — можно продолжать оценивать даже без ML"
          items={fallbackLiked}
          renderItem={renderFallbackLiked}
        />
      ) : null}

      <Row
        title="Фильмы для вас"
        subtitle="То, что с высокой вероятностью зайдёт"
        items={forYouMoviesVisible}
        loading={loading}
        hideIfEmpty
        renderItem={renderForYouMovie}
        error={rowErrors?.fy_movie}
        onRetry={() => retryRow('fy_movie')}
        loadingMore={Boolean(rowLoadingMore?.fy_movie)}
        onEndReached={() => loadMoreForRow('fy_movie')}
      />
      <Row
        title="Сериалы для вас"
        subtitle="Отдельная лента под TV-вкус"
        items={forYouTvVisible}
        loading={loading}
        hideIfEmpty
        renderItem={renderForYouTv}
        error={rowErrors?.fy_tv}
        onRetry={() => retryRow('fy_tv')}
        loadingMore={Boolean(rowLoadingMore?.fy_tv)}
        onEndReached={() => loadMoreForRow('fy_tv')}
      />

      {curatedBecauseMovieRows.map((row) => (
        <Row
          key={`because-m-${row.seed.tmdbId}`}
          title={`Потому что понравилось: ${row.seed.title ?? row.seed.tmdbId}`}
          subtitle="Похоже по атмосфере и стилю"
          items={row.items}
          hideIfEmpty
          renderItem={row.renderItem}
          error={rowErrors?.[`movie:${row.seed.tmdbId}`]}
          onRetry={() => loadMoreBecause({ seedTmdbId: row.seed.tmdbId, mediaType: 'movie' })}
          loadingMore={Boolean(becauseLoadingMore?.[`movie:${row.seed.tmdbId}`])}
          onEndReached={() => loadMoreBecause({ seedTmdbId: row.seed.tmdbId, mediaType: 'movie' })}
        />
      ))}

      {curatedBecauseTvRows.map((row) => (
        <Row
          key={`because-t-${row.seed.tmdbId}`}
          title={`Потому что понравилось: ${row.seed.title ?? row.seed.tmdbId}`}
          subtitle="Похоже по атмосфере и стилю"
          items={row.items}
          hideIfEmpty
          renderItem={row.renderItem}
          error={rowErrors?.[`tv:${row.seed.tmdbId}`]}
          onRetry={() => loadMoreBecause({ seedTmdbId: row.seed.tmdbId, mediaType: 'tv' })}
          loadingMore={Boolean(becauseLoadingMore?.[`tv:${row.seed.tmdbId}`])}
          onEndReached={() => loadMoreBecause({ seedTmdbId: row.seed.tmdbId, mediaType: 'tv' })}
        />
      ))}

      <Row
        title="Похожий вкус — фильмы"
        subtitle="Часто попадает, когда хочется чего-то нового"
        items={similarMoviesVisible}
        loading={loading}
        hideIfEmpty
        renderItem={renderSimilarMovie}
        error={rowErrors?.su_movie}
        onRetry={() => retryRow('su_movie')}
        loadingMore={Boolean(rowLoadingMore?.su_movie)}
        onEndReached={() => loadMoreForRow('su_movie')}
      />
      <Row
        title="Похожий вкус — сериалы"
        subtitle="Похожие вкусы → похожие находки"
        items={similarTvVisible}
        loading={loading}
        hideIfEmpty
        renderItem={renderSimilarTv}
        error={rowErrors?.su_tv}
        onRetry={() => retryRow('su_tv')}
        loadingMore={Boolean(rowLoadingMore?.su_tv)}
        onEndReached={() => loadMoreForRow('su_tv')}
      />

      <Row
        title="Напряжение — фильмы"
        subtitle="Когда хочется драмы/триллера"
        items={moodTenseMoviesVisible}
        loading={secondaryLoading}
        hideIfEmpty
        renderItem={renderMoodTenseMovie}
        error={rowErrors?.mood_tense_movie}
        onRetry={() => retryRow('mood_tense_movie')}
        loadingMore={Boolean(rowLoadingMore?.mood_tense_movie)}
        onEndReached={() => loadMoreForRow('mood_tense_movie')}
      />
      <Row
        title="Напряжение — сериалы"
        subtitle="Когда хочется накала и интриги"
        items={moodTenseTvVisible}
        loading={secondaryLoading}
        hideIfEmpty
        renderItem={renderMoodTenseTv}
        error={rowErrors?.mood_tense_tv}
        onRetry={() => retryRow('mood_tense_tv')}
        loadingMore={Boolean(rowLoadingMore?.mood_tense_tv)}
        onEndReached={() => loadMoreForRow('mood_tense_tv')}
      />
        </>
      )}
    </div>
  );
}

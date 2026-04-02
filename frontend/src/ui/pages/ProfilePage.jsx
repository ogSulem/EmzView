import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, clearAuth, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { PosterCard } from '../components/PosterCard.jsx';
import { Row } from '../components/Row.jsx';

export function ProfilePage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [historyCursor, setHistoryCursor] = useState(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const autoLoadSentinelRef = React.useRef(null);

  const historyValueParam = useMemo(() => {
    if (filter === 'likes') return '1';
    if (filter === 'dislikes') return '-1';
    return null;
  }, [filter]);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      clearAuth({ redirectToLogin: true, includeNext: true });
      return;
    }
    setAuthToken(token);

    async function fetchData() {
      try {
        const [meRes, statsRes] = await Promise.all([
          api.get('/api/users/me'),
          api.get('/api/users/stats'),
        ]);
        setUser(meRes.data.user);
        setStats(statsRes.data.stats);
      } catch (err) {
        setError(formatApiError(err, 'Ошибка загрузки профиля'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const hasHistory = (history?.length ?? 0) > 0;

  const lovedLately = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const h of history ?? []) {
      if (h.value !== 1) continue;
      const key = `${h.mediaType}:${h.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
      if (out.length >= 18) break;
    }
    return out;
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (filter === 'likes') return (history ?? []).filter((x) => x.value === 1);
    if (filter === 'dislikes') return (history ?? []).filter((x) => x.value === -1);
    return history ?? [];
  }, [filter, history]);

  const genreNameRu = useCallback((name) => {
    const n = (name ?? '').trim().toLowerCase();
    const map = {
      action: 'Боевик',
      adventure: 'Приключения',
      animation: 'Анимация',
      comedy: 'Комедия',
      crime: 'Криминал',
      documentary: 'Документальный',
      drama: 'Драма',
      family: 'Семейный',
      fantasy: 'Фэнтези',
      history: 'Исторический',
      horror: 'Ужасы',
      music: 'Музыка',
      mystery: 'Детектив',
      romance: 'Романтика',
      'science fiction': 'Научная фантастика',
      'sci-fi': 'Научная фантастика',
      thriller: 'Триллер',
      war: 'Военный',
      western: 'Вестерн',
      'tv movie': 'ТВ-фильм',
      kids: 'Детский',
      'news': 'Новости',
      'reality': 'Реалити',
      'talk': 'Ток-шоу',
      'soap': 'Мыльная опера',
      'war & politics': 'Война и политика',
    };
    return map[n] ?? name;
  }, []);

  const loadHistoryPage = useCallback(
    async ({ cursor, replace }) => {
      const params = new URLSearchParams();
      params.set('limit', '48');
      if (historyValueParam) params.set('value', historyValueParam);
      if (cursor) params.set('cursor', cursor);

      const res = await api.get(`/api/actions/history?${params.toString()}`);
      const page = res.data?.history ?? [];
      const nextCursor = res.data?.nextCursor ?? null;

      setHistory((prev) => (replace ? page : [...(prev ?? []), ...page]));
      setHistoryCursor(nextCursor);
      setHasMoreHistory(Boolean(nextCursor) && page.length > 0);
    },
    [historyValueParam]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoadingMore(false);
        setHistoryCursor(null);
        setHasMoreHistory(false);
        if (!cancelled) {
          await loadHistoryPage({ cursor: null, replace: true });
        }
      } catch (err) {
        setError(formatApiError(err, 'Ошибка загрузки истории'));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [filter, loadHistoryPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    if (!hasMoreHistory) return;
    if (!historyCursor) return;

    try {
      setLoadingMore(true);
      await loadHistoryPage({ cursor: historyCursor, replace: false });
    } catch (err) {
      setError(formatApiError(err, 'Ошибка загрузки истории'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMoreHistory, historyCursor, loadHistoryPage, loadingMore]);

  useEffect(() => {
    const el = autoLoadSentinelRef.current;
    if (!el) return;
    if (!hasMoreHistory) return;
    if (loadingMore) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries?.[0];
        if (!entry?.isIntersecting) return;
        handleLoadMore();
      },
      { root: null, rootMargin: '600px 0px 600px 0px', threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [handleLoadMore, hasMoreHistory, loadingMore, filteredHistory?.length]);

  const renderLovedLatelyItem = useCallback(
    (it) => <PosterCard key={`${it.mediaType}:${it.tmdbId}`} item={it} />,
    []
  );

  if (loading) {
    return (
      <div>
        <div className="hero profile-hero">
          <div className="profile-hero__left">
            <div className="skeleton skeleton--h26 skeleton--w280" />
            <div className="skeleton skeleton--h14 skeleton--w320 u-mt10" />
            <div className="hero-actions hero-actions--mt12 hero-actions--g12">
              <div className="btn btn-sm skeleton skeleton--w140 skeleton--btnSm" />
              <div className="btn btn-sm skeleton skeleton--w160 skeleton--btnSm" />
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card stat-card--skeleton skeleton" />
            <div className="stat-card stat-card--skeleton skeleton" />
          </div>
        </div>

        <div className="hero u-mb30">
          <div className="skeleton skeleton--h18 skeleton--w240" />
          <div className="chips u-mt12">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="chip skeleton skeleton--w92 skeleton--btnSm" />
            ))}
          </div>
        </div>

        <div className="hero history-hero">
          <div className="history-header">
            <div className="skeleton skeleton--h20 skeleton--w220" />
            <div className="hero-actions hero-actions--g8">
              <div className="btn btn-sm skeleton skeleton--w70 skeleton--btnSm" />
              <div className="btn btn-sm skeleton skeleton--w80 skeleton--btnSm" />
              <div className="btn btn-sm skeleton skeleton--w90 skeleton--btnSm" />
            </div>
          </div>

          <div className="history-grid">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={idx} className="card card-skeleton">
                <div className="card-poster skeleton" />
                <div className="card-title skeleton skeleton-line skeleton-line--mt8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error) return <div className="hero"><div className="error">{error}</div></div>;

  return (
    <div className="u-pb40">
      <div className="hero profile-hero">
        <div className="profile-hero__left">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {(user?.name ?? 'U').trim().slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="profile-nameRow">
                <h1 className="hero-title u-mb8">{user?.name || 'Пользователь'}</h1>
                <Link to="/settings" className="btn btn-sm link-reset" aria-label="Настройки" title="Настройки">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>
              <p className="hero-desc u-mb0">{user?.email}</p>
            </div>
          </div>

          <div className="profile-hero__actions">
            <button className="btn btn-sm" onClick={() => (window.location.href = '/onboarding?reset=1')}>Изменить вкусы</button>
          </div>
        </div>

        {stats ? (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card__value stat-card__value--accent">{stats.likesCount}</div>
              <div className="small">Лайков</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{stats.dislikesCount}</div>
              <div className="small">Дизлайков</div>
            </div>
          </div>
        ) : null}
      </div>

      {stats?.topGenres?.length > 0 && (
        <div className="hero u-mb30">
          <h2 className="hero-title hero-title--sm u-mb15">Любимые жанры</h2>
          <div className="chips">
            {stats.topGenres.map((g) => (
              <div key={g.id} className="chip chip--accent">
                {genreNameRu(g.name)} <span className="u-op60 u-ml4">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lovedLately.length > 0 ? (
        <Row
          title="Любимое недавно"
          subtitle="То, что вы лайкнули последним"
          items={lovedLately}
          renderItem={renderLovedLatelyItem}
        />
      ) : null}

      <div className="hero history-hero">
        <div className="history-header">
          <h2 className="hero-title hero-title--sm u-m0">История оценок</h2>
          <div className="segmented" role="tablist" aria-label="Фильтр истории">
            <button
              className={`segmented__btn ${filter === 'all' ? 'segmented__btn--active' : ''}`}
              onClick={() => setFilter('all')}
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
            >
              Все
            </button>
            <button
              className={`segmented__btn ${filter === 'likes' ? 'segmented__btn--active' : ''}`}
              onClick={() => setFilter('likes')}
              type="button"
              role="tab"
              aria-selected={filter === 'likes'}
            >
              Лайки
            </button>
            <button
              className={`segmented__btn ${filter === 'dislikes' ? 'segmented__btn--active' : ''}`}
              onClick={() => setFilter('dislikes')}
              type="button"
              role="tab"
              aria-selected={filter === 'dislikes'}
            >
              Дизлайки
            </button>
          </div>
        </div>

        {!hasHistory ? (
          <div>
            <div className="small">Вы еще не оценивали фильмы или сериалы.</div>
            <div className="profile-hero__actions">
              <button className="btn btn-sm" onClick={() => (window.location.href = '/recommendations')}>На главную</button>
              <button className="btn btn-sm" onClick={() => (window.location.href = '/onboarding?reset=1')}>Изменить вкусы</button>
            </div>
          </div>
        ) : (
          <>
            <div className="history-grid">
              {filteredHistory.map((item) => (
                <div key={`${item.mediaType}-${item.tmdbId}`} className="u-relative">
                  <PosterCard item={item} />
                  <div className={`corner-badge ${item.value === 1 ? 'corner-badge--like' : 'corner-badge--dislike'}`}>
                    {item.value === 1 ? '✓' : '✕'}
                  </div>
                </div>
              ))}
            </div>

            {hasMoreHistory ? (
              <div className="hero-actions hero-actions--mt12">
                <button className="btn" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                </button>
              </div>
            ) : null}

            <div ref={autoLoadSentinelRef} style={{ height: 1 }} />
          </>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

import { api, setAuthToken } from '../lib/api.js';
import { Row } from '../components/Row.jsx';
import { PosterCard } from '../components/PosterCard.jsx';

export function HomePage() {
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);

  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const [forYouMovies, setForYouMovies] = useState([]);
  const [forYouTv, setForYouTv] = useState([]);

  const [similarMovies, setSimilarMovies] = useState([]);
  const [similarTv, setSimilarTv] = useState([]);

  const [moodFunMovies, setMoodFunMovies] = useState([]);
  const [moodFunTv, setMoodFunTv] = useState([]);

  const [moodSadMovies, setMoodSadMovies] = useState([]);
  const [moodSadTv, setMoodSadTv] = useState([]);

  const [moodTenseMovies, setMoodTenseMovies] = useState([]);
  const [moodTenseTv, setMoodTenseTv] = useState([]);

  const [becauseRowsMovies, setBecauseRowsMovies] = useState([]);
  const [becauseRowsTv, setBecauseRowsTv] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const token = localStorage.getItem('token');
      if (!token) {
        if (mounted) setCheckedOnboarding(true);
        return;
      }

      try {
        const { data } = await api.get('/api/users/me');
        const completedAt = data?.user?.onboarding?.completedAt;
        if (!completedAt) {
          window.location.href = '/onboarding';
          return;
        }
      } catch {
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

  useEffect(() => {
    if (!checkedOnboarding) return;
    if (autoLoaded) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setAutoLoaded(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedOnboarding]);

  async function load() {
    setError('');
    setLoading(true);
    try {
      const limit = 16;

      const [fyMovies, fyTv, simMovies, simTv, moodFunMoviesRes, moodFunTvRes, moodSadMoviesRes, moodSadTvRes, moodTenseMoviesRes, moodTenseTvRes, seedsMoviesRes, seedsTvRes] = await Promise.all([
        api.get(`/api/recommendations/for-you?limit=${limit}&type=movie`),
        api.get(`/api/recommendations/for-you?limit=${limit}&type=tv`),
        api.get(`/api/recommendations/similar-users?limit=${limit}&type=movie`),
        api.get(`/api/recommendations/similar-users?limit=${limit}&type=tv`),
        api.get(`/api/recommendations/mood?mood=fun&limit=${limit}&type=movie`),
        api.get(`/api/recommendations/mood?mood=fun&limit=${limit}&type=tv`),
        api.get(`/api/recommendations/mood?mood=sad&limit=${limit}&type=movie`),
        api.get(`/api/recommendations/mood?mood=sad&limit=${limit}&type=tv`),
        api.get(`/api/recommendations/mood?mood=tense&limit=${limit}&type=movie`),
        api.get(`/api/recommendations/mood?mood=tense&limit=${limit}&type=tv`),
        api.get('/api/actions/top-liked?limit=2&type=movie'),
        api.get('/api/actions/top-liked?limit=2&type=tv'),
      ]);

      setForYouMovies(fyMovies.data.recommendations ?? []);
      setForYouTv(fyTv.data.recommendations ?? []);
      setSimilarMovies(simMovies.data.recommendations ?? []);
      setSimilarTv(simTv.data.recommendations ?? []);
      setMoodFunMovies(moodFunMoviesRes.data.recommendations ?? []);
      setMoodFunTv(moodFunTvRes.data.recommendations ?? []);

      setMoodSadMovies(moodSadMoviesRes.data.recommendations ?? []);
      setMoodSadTv(moodSadTvRes.data.recommendations ?? []);
      setMoodTenseMovies(moodTenseMoviesRes.data.recommendations ?? []);
      setMoodTenseTv(moodTenseTvRes.data.recommendations ?? []);

      const movieSeeds = seedsMoviesRes.data.seeds ?? [];
      const tvSeeds = seedsTvRes.data.seeds ?? [];

      const movieBecause = await Promise.all(
        movieSeeds.map(async (s) => {
          const { data } = await api.get(`/api/recommendations/because?tmdbId=${s.tmdbId}&type=${s.mediaType}&limit=14`);
          return { seed: s, items: data.recommendations ?? [] };
        })
      );
      const tvBecause = await Promise.all(
        tvSeeds.map(async (s) => {
          const { data } = await api.get(`/api/recommendations/because?tmdbId=${s.tmdbId}&type=${s.mediaType}&limit=14`);
          return { seed: s, items: data.recommendations ?? [] };
        })
      );

      setBecauseRowsMovies(movieBecause);
      setBecauseRowsTv(tvBecause);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="grid2">
        <div className="hero">
          <h1 className="hero-title">Персональные рекомендации</h1>
          <p className="hero-desc">
            Гибридная рекомендательная система: content-based + collaborative filtering.
            Ставь лайки/дизлайки, и лента будет обновляться в реальном времени.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? 'Загрузка…' : 'Обновить витрину'}
            </button>
            <a className="btn" href="/login" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Войти
            </a>
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            Чтобы появились рекомендации, поставь лайк хотя бы нескольким фильмам/сериалам.
          </div>
          {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
        </div>

        <div className="hero">
          <div style={{ fontWeight: 800 }}>Быстрый старт</div>
          <div className="small" style={{ marginTop: 8 }}>
            1) Войти/зарегистрироваться
            <br />
            2) Найти фильмы/сериалы (поиск)
            <br />
            3) Лайк/дизлайк
            <br />
            4) Получить “Для вас” + “Похожие пользователи”
          </div>
          <div className="small" style={{ marginTop: 12 }}>
            (Поиск и онбординг я добавлю следующим шагом.)
          </div>
        </div>
      </div>

      <Row
        title="Фильмы — Для вас"
        subtitle="Гибрид: cold-start → content, активный пользователь → collaborative"
        items={forYouMovies}
        renderItem={(it) => <PosterCard key={`fy-m-${it.tmdbId}`} item={it} />}
      />
      <Row
        title="Сериалы — Для вас"
        subtitle="Отдельная лента TV"
        items={forYouTv}
        renderItem={(it) => <PosterCard key={`fy-t-${it.tmdbId}`} item={it} />}
      />

      <Row
        title="Фильмы — Похожие пользователи"
        subtitle="User-user CF: что лайкают люди с похожим вкусом"
        items={similarMovies}
        renderItem={(it) => <PosterCard key={`su-m-${it.tmdbId}`} item={it} />}
      />
      <Row
        title="Сериалы — Похожие пользователи"
        subtitle="User-user CF"
        items={similarTv}
        renderItem={(it) => <PosterCard key={`su-t-${it.tmdbId}`} item={it} />}
      />

      <Row
        title="Фильмы — Под настроение (весёлое)"
        subtitle="Content-based по ключевым словам mood"
        items={moodFunMovies}
        renderItem={(it) => <PosterCard key={`moodfun-m-${it.tmdbId}`} item={it} />}
      />
      <Row
        title="Сериалы — Под настроение (весёлое)"
        subtitle="Content-based"
        items={moodFunTv}
        renderItem={(it) => <PosterCard key={`moodfun-t-${it.tmdbId}`} item={it} />}
      />

      {becauseRowsMovies.map((row) => (
        <Row
          key={`because-m-${row.seed.tmdbId}`}
          title={`Фильмы — Потому что вам понравилось ${row.seed.title ?? row.seed.tmdbId}`}
          subtitle="Похожие по описанию/жанрам/актёрам"
          items={row.items}
          renderItem={(it) => <PosterCard key={`because-m-${row.seed.tmdbId}-${it.tmdbId}`} item={it} />}
        />
      ))}

      {becauseRowsTv.map((row) => (
        <Row
          key={`because-t-${row.seed.tmdbId}`}
          title={`Сериалы — Потому что вам понравилось ${row.seed.title ?? row.seed.tmdbId}`}
          subtitle="Похожие по описанию/жанрам/актёрам"
          items={row.items}
          renderItem={(it) => <PosterCard key={`because-t-${row.seed.tmdbId}-${it.tmdbId}`} item={it} />}
        />
      ))}

      <Row
        title="Фильмы — Под настроение (грустное)"
        subtitle="Content-based"
        items={moodSadMovies}
        renderItem={(it) => <PosterCard key={`moodsad-m-${it.tmdbId}`} item={it} />}
      />
      <Row
        title="Сериалы — Под настроение (грустное)"
        subtitle="Content-based"
        items={moodSadTv}
        renderItem={(it) => <PosterCard key={`moodsad-t-${it.tmdbId}`} item={it} />}
      />

      <Row
        title="Фильмы — Под настроение (напряжённое)"
        subtitle="Content-based"
        items={moodTenseMovies}
        renderItem={(it) => <PosterCard key={`moodtense-m-${it.tmdbId}`} item={it} />}
      />
      <Row
        title="Сериалы — Под настроение (напряжённое)"
        subtitle="Content-based"
        items={moodTenseTv}
        renderItem={(it) => <PosterCard key={`moodtense-t-${it.tmdbId}`} item={it} />}
      />
    </div>
  );
}

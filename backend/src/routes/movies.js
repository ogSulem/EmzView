import { Router } from 'express';
import { z } from 'zod';

import { tmdbClient, posterUrl } from '../lib/tmdb.js';
import { Movie } from '../models/Movie.js';
import { requireAuth } from '../middleware/auth.js';

export const moviesRouter = Router();

const genresCache = new Map();
const listsCache = new Map();

async function ensureMovie({ tmdbId, mediaType }) {
  const existing = await Movie.findOne({ tmdbId, mediaType });
  if (existing) return existing;

  const tmdb = tmdbClient();
  const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;

  const { data } = await tmdb.get(endpoint, {
    params: {
      append_to_response: 'credits,keywords',
    },
  });

  const title = mediaType === 'tv' ? data.name : data.title;
  const genres = (data.genres ?? []).map((g) => ({ id: g.id, name: g.name }));
  const cast = (data.credits?.cast ?? []).slice(0, 15).map((c) => c.name).filter(Boolean);

  const keywords =
    mediaType === 'tv'
      ? (data.keywords?.results ?? []).map((k) => k.name)
      : (data.keywords?.keywords ?? []).map((k) => k.name);

  return Movie.create({
    tmdbId,
    mediaType,
    title,
    overview: data.overview ?? '',
    posterPath: data.poster_path ?? null,
    genres,
    cast,
    keywords: (keywords ?? []).filter(Boolean).slice(0, 30),
    releaseDate: mediaType === 'tv' ? data.first_air_date ?? null : data.release_date ?? null,
    popularity: data.popularity ?? 0,
  });
}

moviesRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const query = z.string().min(1).parse(req.query.q);
    const mediaType = z.enum(['movie', 'tv']).default('movie').parse(req.query.type ?? 'movie');

    const tmdb = tmdbClient();
    const endpoint = mediaType === 'tv' ? '/search/tv' : '/search/movie';

    const { data } = await tmdb.get(endpoint, {
      params: {
        query,
        include_adult: false,
      },
    });

    const results = (data.results ?? []).slice(0, 20).map((r) => ({
      tmdbId: r.id,
      mediaType,
      title: mediaType === 'tv' ? r.name : r.title,
      overview: r.overview ?? '',
      posterPath: r.poster_path ?? null,
      posterUrl: posterUrl(r.poster_path),
      releaseDate: mediaType === 'tv' ? r.first_air_date ?? null : r.release_date ?? null,
      popularity: r.popularity ?? 0,
    }));

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

moviesRouter.get('/lists/:kind', requireAuth, async (req, res, next) => {
  try {
    const mediaType = z.enum(['movie', 'tv']).default('movie').parse(req.query.type ?? 'movie');
    const kind = z.enum(['trending', 'popular', 'top', 'now']).parse(req.params.kind);
    const limit = z.coerce.number().int().min(1).max(60).default(20).parse(req.query.limit ?? 20);
    const page = z.coerce.number().int().min(1).max(500).default(1).parse(req.query.page ?? 1);

    const cacheKey = `lists:${kind}:${mediaType}:${page}:${limit}`;
    const cached = listsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.value);
    }

    const tmdb = tmdbClient();

    let endpoint = '';
    if (kind === 'trending') endpoint = `/trending/${mediaType}/week`;
    if (kind === 'popular') endpoint = mediaType === 'tv' ? '/tv/popular' : '/movie/popular';
    if (kind === 'top') endpoint = mediaType === 'tv' ? '/tv/top_rated' : '/movie/top_rated';
    if (kind === 'now') endpoint = mediaType === 'tv' ? '/tv/on_the_air' : '/movie/now_playing';

    const { data } = await tmdb.get(endpoint, { params: { page } });

    const items = (data?.results ?? []).slice(0, limit).map((r) => ({
      tmdbId: r.id,
      mediaType,
      title: mediaType === 'tv' ? r.name : r.title,
      overview: r.overview ?? '',
      posterPath: r.poster_path ?? null,
      posterUrl: posterUrl(r.poster_path),
      releaseDate: mediaType === 'tv' ? r.first_air_date ?? null : r.release_date ?? null,
      popularity: r.popularity ?? 0,
      score: r.vote_average ?? null,
    }));

    const totalPages = Number.isFinite(data?.total_pages) ? data.total_pages : null;
    const payload = { items, page, totalPages, kind, mediaType };
    listsCache.set(cacheKey, { value: payload, expiresAt: Date.now() + 5 * 60 * 1000 });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

moviesRouter.get('/genres', requireAuth, async (req, res, next) => {
  try {
    const mediaType = z.enum(['movie', 'tv']).default('movie').parse(req.query.type ?? 'movie');
    const cacheKey = `genres:${mediaType}`;
    const cached = genresCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ genres: cached.value });
    }

    const tmdb = tmdbClient();
    const endpoint = mediaType === 'tv' ? '/genre/tv/list' : '/genre/movie/list';
    const { data } = await tmdb.get(endpoint);
    const genres = (data.genres ?? []).map((g) => ({ id: g.id, name: g.name }));

    genresCache.set(cacheKey, { value: genres, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return res.json({ genres });
  } catch (err) {
    return next(err);
  }
});

const upsertSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'tv']),
});

moviesRouter.post('/ensure', requireAuth, async (req, res, next) => {
  try {
    const { tmdbId, mediaType } = upsertSchema.parse(req.body);

    const movie = await ensureMovie({ tmdbId, mediaType });
    return res.json({ movie: toMovieDto(movie) });
  } catch (err) {
    return next(err);
  }
});

moviesRouter.get('/:mediaType/:tmdbId', requireAuth, async (req, res, next) => {
  try {
    const mediaType = z.enum(['movie', 'tv']).parse(req.params.mediaType);
    const tmdbId = z.coerce.number().int().positive().parse(req.params.tmdbId);

    const movie = await ensureMovie({ tmdbId, mediaType });
    return res.json({ movie: toMovieDto(movie) });
  } catch (err) {
    return next(err);
  }
});

const syncSchema = z.object({
  pages: z.number().int().min(1).max(20).default(3),
  types: z.array(z.enum(['movie', 'tv'])).default(['movie', 'tv']),
  maxItems: z.number().int().min(1).max(2000).default(400),
});

moviesRouter.post('/sync/trending', requireAuth, async (req, res, next) => {
  try {
    const body = syncSchema.parse(req.body ?? {});
    const tmdb = tmdbClient();

    const ids = [];
    for (const t of body.types) {
      for (let page = 1; page <= body.pages; page += 1) {
        const { data } = await tmdb.get(`/trending/${t}/week`, { params: { page } });
        for (const r of data?.results ?? []) {
          ids.push({ tmdbId: r.id, mediaType: t });
          if (ids.length >= body.maxItems) break;
        }
        if (ids.length >= body.maxItems) break;
      }
    }

    const inserted = await syncEnsureMany(ids);
    return res.json({ ok: true, total: ids.length, inserted });
  } catch (err) {
    return next(err);
  }
});

moviesRouter.post('/sync/popular', requireAuth, async (req, res, next) => {
  try {
    const body = syncSchema.parse(req.body ?? {});
    const tmdb = tmdbClient();

    const ids = [];
    for (const t of body.types) {
      const endpoint = t === 'tv' ? '/tv/popular' : '/movie/popular';
      for (let page = 1; page <= body.pages; page += 1) {
        const { data } = await tmdb.get(endpoint, { params: { page } });
        for (const r of data?.results ?? []) {
          ids.push({ tmdbId: r.id, mediaType: t });
          if (ids.length >= body.maxItems) break;
        }
        if (ids.length >= body.maxItems) break;
      }
    }

    const inserted = await syncEnsureMany(ids);
    return res.json({ ok: true, total: ids.length, inserted });
  } catch (err) {
    return next(err);
  }
});

async function syncEnsureMany(items) {
  const concurrency = Math.min(Number(process.env.SYNC_CONCURRENCY ?? 6), 12);
  let idx = 0;
  let inserted = 0;

  async function worker() {
    while (idx < items.length) {
      const current = items[idx];
      idx += 1;
      try {
        const before = await Movie.findOne({ tmdbId: current.tmdbId, mediaType: current.mediaType }).lean();
        if (!before) {
          await ensureMovie(current);
          inserted += 1;
        }
      } catch {
        // ignore individual failures to keep sync resilient
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return inserted;
}

function toMovieDto(movie) {
  return {
    tmdbId: movie.tmdbId,
    mediaType: movie.mediaType,
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.posterPath,
    posterUrl: posterUrl(movie.posterPath),
    genres: movie.genres,
    cast: movie.cast,
    keywords: movie.keywords,
    releaseDate: movie.releaseDate,
    popularity: movie.popularity,
  };
}

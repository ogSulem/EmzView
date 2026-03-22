import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { Rating } from '../models/Rating.js';
import { Movie } from '../models/Movie.js';
import { mlClient } from '../lib/mlClient.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { posterUrl } from '../lib/tmdb.js';
import { llmRewriteExplanation } from '../lib/llm.js';

export const recommendationsRouter = Router();

recommendationsRouter.get('/for-you', requireAuth, async (req, res, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit ?? '20');
    const mediaType = z.enum(['movie', 'tv']).optional().parse(req.query.type);

    const userId = req.user.userId;
    const cacheKey = `for-you:${userId}:${mediaType ?? 'all'}:${limit}`;

    const ttlSec = Number(process.env.RECOMMENDATIONS_CACHE_TTL_SEC ?? 120);
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ratings = await Rating.find({ userId }).lean();

    const profile = {
      user_id: userId,
      interactions: ratings.map((r) => ({
        tmdb_id: r.tmdbId,
        media_type: r.mediaType,
        value: r.value,
      })),
    };

    const ml = mlClient();
    const { data } = await ml.post('/recommend/for-you', {
      profile,
      limit,
    });

    const recs = await hydrateRecommendations(data.recommendations ?? [], mediaType);

    const payload = { recommendations: recs, strategy: data.strategy };
    cacheSet(cacheKey, payload, ttlSec * 1000);

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

recommendationsRouter.get('/similar-users', requireAuth, async (req, res, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit ?? '20');
    const mediaType = z.enum(['movie', 'tv']).optional().parse(req.query.type);

    const userId = req.user.userId;
    const cacheKey = `similar-users:${userId}:${mediaType ?? 'all'}:${limit}`;

    const ttlSec = Number(process.env.RECOMMENDATIONS_CACHE_TTL_SEC ?? 120);
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const ratings = await Rating.find({ userId }).lean();
    const profile = {
      user_id: userId,
      interactions: ratings.map((r) => ({
        tmdb_id: r.tmdbId,
        media_type: r.mediaType,
        value: r.value,
      })),
    };

    const ml = mlClient();
    const { data } = await ml.post('/recommend/similar-users', {
      profile,
      limit,
    });

    const recs = await hydrateRecommendations(data.recommendations ?? [], mediaType);
    const payload = { recommendations: recs, strategy: data.strategy, neighborCount: data.neighbor_count ?? 0 };
    cacheSet(cacheKey, payload, ttlSec * 1000);

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

recommendationsRouter.get('/because', requireAuth, async (req, res, next) => {
  try {
    const seedTmdbId = z.coerce.number().int().positive().parse(req.query.tmdbId);
    const mediaType = z.enum(['movie', 'tv']).default('movie').parse(req.query.type ?? 'movie');
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit ?? '20');

    const ml = mlClient();
    const { data } = await ml.post('/recommend/because', {
      seed: { tmdb_id: seedTmdbId, media_type: mediaType },
      limit,
    });

    const recs = await hydrateRecommendations(data.recommendations ?? [], mediaType);
    return res.json({ recommendations: recs, strategy: data.strategy });
  } catch (err) {
    return next(err);
  }
});

recommendationsRouter.get('/mood', requireAuth, async (req, res, next) => {
  try {
    const mood = z.enum(['fun', 'sad', 'tense']).parse(req.query.mood);
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit ?? '20');
    const mediaType = z.enum(['movie', 'tv']).optional().parse(req.query.type);

    const ml = mlClient();
    const { data } = await ml.post('/recommend/mood', {
      mood,
      limit,
    });

    const recs = await hydrateRecommendations(data.recommendations ?? [], mediaType);
    return res.json({ recommendations: recs, strategy: data.strategy });
  } catch (err) {
    return next(err);
  }
});

async function hydrateRecommendations(recommendations, mediaTypeFilter) {
  const ids = recommendations.map((r) => r.tmdb_id);
  const movies = await Movie.find({ tmdbId: { $in: ids } }).lean();
  const byId = new Map(movies.map((m) => [m.tmdbId, m]));

  const becauseIds = recommendations
    .map((r) => {
      const m = typeof r.explanation === 'string' ? r.explanation.match(/\b(\d{2,})\b/) : null;
      return m ? Number(m[1]) : null;
    })
    .filter((x) => Number.isFinite(x));

  const becauseMovies = becauseIds.length
    ? await Movie.find({ tmdbId: { $in: becauseIds } }).lean()
    : [];
  const becauseById = new Map(becauseMovies.map((m) => [m.tmdbId, m]));

  const hydrated = recommendations
    .map((r) => {
      const m = byId.get(r.tmdb_id);
      if (!m) return null;
      if (mediaTypeFilter && m.mediaType !== mediaTypeFilter) return null;
      return {
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        title: m.title,
        overview: m.overview,
        posterUrl: posterUrl(m.posterPath),
        score: r.score,
        explanation: rewriteExplanation(r.explanation, becauseById),
      };
    })
    .filter(Boolean);

  await rewriteExplanationsInPlace(hydrated);
  return hydrated;
}

async function rewriteExplanationsInPlace(items) {
  const concurrency = Math.min(Number(process.env.LLM_CONCURRENCY ?? 4), 8);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;

      const it = items[i];
      if (!it?.explanation) continue;
      it.explanation = await llmRewriteExplanation(it.explanation);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

function rewriteExplanation(explanation, becauseById) {
  if (typeof explanation !== 'string' || !explanation) return explanation ?? null;

  const match = explanation.match(/\b(\d{2,})\b/);
  if (!match) return explanation;

  const id = Number(match[1]);
  const seed = becauseById.get(id);
  if (!seed?.title) return explanation;

  return explanation.replace(match[1], seed.title);
}

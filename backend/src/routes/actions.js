import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { Rating } from '../models/Rating.js';
import { Movie } from '../models/Movie.js';
import { tmdbClient } from '../lib/tmdb.js';

export const actionsRouter = Router();

const rateSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'tv']),
  value: z.enum(['like', 'dislike']).transform((v) => (v === 'like' ? 1 : -1)),
  source: z.enum(['web', 'telegram']).default('web'),
});

actionsRouter.post('/rate', requireAuth, async (req, res, next) => {
  try {
    const { tmdbId, mediaType, value, source } = rateSchema.parse(req.body);

    const movie = await Movie.findOne({ tmdbId, mediaType });
    if (!movie) {
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

      await Movie.create({
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

    const userId = req.user.userId;

    const rating = await Rating.findOneAndUpdate(
      { userId, tmdbId, mediaType },
      { $set: { value, source } },
      { upsert: true, new: true }
    );

    res.json({ rating });
  } catch (err) {
    next(err);
  }
});

actionsRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit ?? '50');

    const ratings = await Rating.find({ userId }).sort({ updatedAt: -1 }).limit(limit).lean();

    res.json({ ratings });
  } catch (err) {
    next(err);
  }
});

actionsRouter.get('/top-liked', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = z.coerce.number().int().min(1).max(10).default(3).parse(req.query.limit ?? '3');
    const mediaType = z.enum(['movie', 'tv']).optional().parse(req.query.type);

    const query = { userId, value: 1 };
    if (mediaType) query.mediaType = mediaType;

    const likes = await Rating.find(query).sort({ updatedAt: -1 }).limit(200).lean();

    const uniq = [];
    const seen = new Set();
    for (const l of likes) {
      const key = `${l.mediaType}:${l.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push({ tmdbId: l.tmdbId, mediaType: l.mediaType });
      if (uniq.length >= limit) break;
    }

    const movies = uniq.length
      ? await Movie.find({ tmdbId: { $in: uniq.map((x) => x.tmdbId) } }).lean()
      : [];
    const byId = new Map(movies.map((m) => [m.tmdbId, m]));

    const seeds = uniq.map((x) => ({
      ...x,
      title: byId.get(x.tmdbId)?.title ?? null,
    }));

    res.json({ seeds });
  } catch (err) {
    next(err);
  }
});

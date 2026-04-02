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
  value: z
    .union([
      z.enum(['like', 'dislike']).transform((v) => (v === 'like' ? 1 : -1)),
      z.number().int().refine((n) => n === 1 || n === -1, { message: 'value must be 1 or -1' }),
    ])
    .transform((v) => (typeof v === 'number' ? v : v)),
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
    const value = z
      .union([z.literal('1'), z.literal('-1')])
      .optional()
      .transform((v) => (v == null ? undefined : Number(v)))
      .parse(req.query.value);

    const cursorRaw = z.string().optional().parse(req.query.cursor);
    let cursor = null;
    if (cursorRaw) {
      try {
        cursor = JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8'));
      } catch {
        cursor = null;
      }
    }

    const query = { userId };
    if (value === 1 || value === -1) query.value = value;

    if (cursor?.t && cursor?.id) {
      query.$or = [
        { updatedAt: { $lt: new Date(cursor.t) } },
        { updatedAt: new Date(cursor.t), _id: { $lt: cursor.id } },
      ];
    }

    const ratings = await Rating.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const keys = ratings.map((r) => `${r.mediaType}:${r.tmdbId}`);
    const uniqPairs = Array.from(new Set(keys)).map((k) => {
      const [mediaType, tmdbId] = k.split(':');
      return { mediaType, tmdbId: Number(tmdbId) };
    });

    const movies = uniqPairs.length
      ? await Movie.find({ $or: uniqPairs.map((p) => ({ tmdbId: p.tmdbId, mediaType: p.mediaType })) }).lean()
      : [];
    const byKey = new Map(movies.map((m) => [`${m.mediaType}:${m.tmdbId}`, m]));

    const history = ratings
      .map((r) => {
        const m = byKey.get(`${r.mediaType}:${r.tmdbId}`);
        if (!m) return null;
        return {
          tmdbId: m.tmdbId,
          mediaType: m.mediaType,
          title: m.title,
          overview: m.overview,
          posterUrl: m.posterPath ? `https://image.tmdb.org/t/p/w500${m.posterPath}` : null,
          value: r.value,
          updatedAt: r.updatedAt,
        };
      })
      .filter(Boolean);

    const last = ratings[ratings.length - 1];
    const nextCursor = last
      ? Buffer.from(JSON.stringify({ t: last.updatedAt, id: String(last._id) }), 'utf8').toString('base64')
      : null;

    res.json({ history, nextCursor });
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
      ? await Movie.find({ $or: uniq.map((x) => ({ tmdbId: x.tmdbId, mediaType: x.mediaType })) }).lean()
      : [];
    const byKey = new Map(movies.map((m) => [`${m.mediaType}:${m.tmdbId}`, m]));

    const seeds = uniq.map((x) => {
      const m = byKey.get(`${x.mediaType}:${x.tmdbId}`);
      return {
        ...x,
        title: m?.title ?? null,
        overview: m?.overview ?? null,
        posterUrl: m?.posterPath ? `https://image.tmdb.org/t/p/w500${m.posterPath}` : null,
      };
    });

    res.json({ seeds });
  } catch (err) {
    next(err);
  }
});

actionsRouter.get('/recent-liked', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = z.coerce.number().int().min(1).max(20).default(3).parse(req.query.limit ?? '3');
    const mediaType = z.enum(['movie', 'tv']).optional().parse(req.query.type);

    const query = { userId, value: 1 };
    if (mediaType) query.mediaType = mediaType;

    const likes = await Rating.find(query).sort({ updatedAt: -1 }).limit(250).lean();

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
      ? await Movie.find({ $or: uniq.map((x) => ({ tmdbId: x.tmdbId, mediaType: x.mediaType })) }).lean()
      : [];
    const byKey = new Map(movies.map((m) => [`${m.mediaType}:${m.tmdbId}`, m]));

    const seeds = uniq.map((x) => {
      const m = byKey.get(`${x.mediaType}:${x.tmdbId}`);
      return {
        ...x,
        title: m?.title ?? null,
        overview: m?.overview ?? null,
        posterUrl: m?.posterPath ? `https://image.tmdb.org/t/p/w500${m.posterPath}` : null,
      };
    });

    res.json({ seeds });
  } catch (err) {
    next(err);
  }
});

actionsRouter.get('/my-rating', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tmdbId = z.coerce.number().int().positive().parse(req.query.tmdbId);
    const mediaType = z.enum(['movie', 'tv']).parse(req.query.type);

    const r = await Rating.findOne({ userId, tmdbId, mediaType }).lean();
    return res.json({ rating: r ? { value: r.value, updatedAt: r.updatedAt } : null });
  } catch (err) {
    return next(err);
  }
});

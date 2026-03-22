import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Rating } from '../models/Rating.js';
import { Movie } from '../models/Movie.js';
import { tmdbClient, posterUrl } from '../lib/tmdb.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        onboarding: user.onboarding,
      },
    });
  } catch (err) {
    return next(err);
  }
});

usersRouter.get('/onboarding/candidates', requireAuth, async (req, res, next) => {
  try {
    const limit = z.coerce.number().int().min(10).max(80).default(40).parse(req.query.limit ?? '40');

    const tmdb = tmdbClient();

    const [moviesRes, tvRes] = await Promise.all([
      tmdb.get('/trending/movie/week'),
      tmdb.get('/trending/tv/week'),
    ]);

    const movies = (moviesRes.data?.results ?? []).slice(0, Math.ceil(limit / 2)).map((r) => ({
      tmdbId: r.id,
      mediaType: 'movie',
      title: r.title,
      overview: r.overview ?? '',
      posterPath: r.poster_path ?? null,
      posterUrl: posterUrl(r.poster_path, 'w342'),
      popularity: r.popularity ?? 0,
    }));

    const tv = (tvRes.data?.results ?? []).slice(0, Math.floor(limit / 2)).map((r) => ({
      tmdbId: r.id,
      mediaType: 'tv',
      title: r.name,
      overview: r.overview ?? '',
      posterPath: r.poster_path ?? null,
      posterUrl: posterUrl(r.poster_path, 'w342'),
      popularity: r.popularity ?? 0,
    }));

    return res.json({ results: [...movies, ...tv] });
  } catch (err) {
    return next(err);
  }
});

const onboardingSchema = z.object({
  favorites: z
    .array(
      z.object({
        tmdbId: z.number().int().positive(),
        mediaType: z.enum(['movie', 'tv']),
      })
    )
    .default([]),
  genreIds: z.array(z.number().int()).default([]),
});

usersRouter.put('/onboarding', requireAuth, async (req, res, next) => {
  try {
    const { favorites, genreIds } = onboardingSchema.parse(req.body);
    const userId = req.user.userId;

    const favMovies = favorites.filter((f) => f.mediaType === 'movie').map((f) => f.tmdbId);
    const favTv = favorites.filter((f) => f.mediaType === 'tv').map((f) => f.tmdbId);

    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'onboarding.favoriteMovieTmdbIds': favMovies,
          'onboarding.favoriteTvTmdbIds': favTv,
          'onboarding.favoriteGenreIds': genreIds,
          'onboarding.completedAt': new Date(),
        },
      },
      { new: true }
    );

    // Bootstrap: ensure movies exist in local DB + create positive ratings for cold-start.
    const tmdb = tmdbClient();
    for (const f of favorites.slice(0, 30)) {
      const existing = await Movie.findOne({ tmdbId: f.tmdbId, mediaType: f.mediaType });
      if (!existing) {
        const endpoint = f.mediaType === 'tv' ? `/tv/${f.tmdbId}` : `/movie/${f.tmdbId}`;
        const { data } = await tmdb.get(endpoint, { params: { append_to_response: 'credits,keywords' } });

        const title = f.mediaType === 'tv' ? data.name : data.title;
        const genres = (data.genres ?? []).map((g) => ({ id: g.id, name: g.name }));
        const cast = (data.credits?.cast ?? []).slice(0, 15).map((c) => c.name).filter(Boolean);
        const keywords =
          f.mediaType === 'tv'
            ? (data.keywords?.results ?? []).map((k) => k.name)
            : (data.keywords?.keywords ?? []).map((k) => k.name);

        await Movie.create({
          tmdbId: f.tmdbId,
          mediaType: f.mediaType,
          title,
          overview: data.overview ?? '',
          posterPath: data.poster_path ?? null,
          genres,
          cast,
          keywords: (keywords ?? []).filter(Boolean).slice(0, 30),
          releaseDate: f.mediaType === 'tv' ? data.first_air_date ?? null : data.release_date ?? null,
          popularity: data.popularity ?? 0,
        });
      }

      await Rating.findOneAndUpdate(
        { userId, tmdbId: f.tmdbId, mediaType: f.mediaType },
        { $set: { value: 1, source: 'web' } },
        { upsert: true, new: true }
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

usersRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const [likesCount, dislikesCount] = await Promise.all([
      Rating.countDocuments({ userId, value: 1 }),
      Rating.countDocuments({ userId, value: -1 }),
    ]);

    const likedIds = await Rating.find({ userId, value: 1 }).limit(500).lean();
    const tmdbIds = likedIds.map((r) => r.tmdbId);
    const movies = tmdbIds.length ? await Movie.find({ tmdbId: { $in: tmdbIds } }).lean() : [];

    const genreCounts = new Map();
    for (const m of movies) {
      for (const g of m.genres ?? []) {
        if (!g?.id) continue;
        genreCounts.set(g.id, { id: g.id, name: g.name ?? '', count: (genreCounts.get(g.id)?.count ?? 0) + 1 });
      }
    }

    const topGenres = Array.from(genreCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      stats: {
        likesCount,
        dislikesCount,
        topGenres,
      },
    });
  } catch (err) {
    return next(err);
  }
});

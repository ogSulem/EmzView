import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { User } from '../models/User.js';
import { Rating } from '../models/Rating.js';
import { Movie } from '../models/Movie.js';
import { tmdbClient } from '../lib/tmdb.js';

export const devRouter = Router();

const seedSchema = z.object({
  secret: z.string().min(1),
  users: z.number().int().min(1).max(200).default(48),
  likesPerUser: z.number().int().min(3).max(80).default(18),
  dislikesPerUser: z.number().int().min(0).max(40).default(4),
  reset: z.boolean().default(false),
});

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

function uniq(arr) {
  return Array.from(new Set(arr));
}

function sample(arr, n) {
  if (!arr?.length || n <= 0) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

devRouter.post('/seed', async (req, res, next) => {
  try {
    const body = seedSchema.parse(req.body ?? {});

    const expected = process.env.DEV_SEED_SECRET;
    if (!expected || body.secret !== expected) {
      return res.status(401).json({ error: 'Invalid seed secret' });
    }

    const prefix = process.env.DEV_SEED_EMAIL_PREFIX ?? 'seed_';

    if (body.reset) {
      const seededUsers = await User.find({ email: { $regex: `^${prefix}` } }).lean();
      const seededUserIds = seededUsers.map((u) => u._id);
      if (seededUserIds.length) {
        await Rating.deleteMany({ userId: { $in: seededUserIds } });
        await User.deleteMany({ _id: { $in: seededUserIds } });
      }
    }

    const tasteProfiles = [
      { name: 'Action', movieGenre: 28, tvGenre: 10759 },
      { name: 'Drama', movieGenre: 18, tvGenre: 18 },
      { name: 'Comedy', movieGenre: 35, tvGenre: 35 },
      { name: 'Horror', movieGenre: 27, tvGenre: null },
      { name: 'SciFi', movieGenre: 878, tvGenre: 10765 },
      { name: 'Romance', movieGenre: 10749, tvGenre: null },
      { name: 'Thriller', movieGenre: 53, tvGenre: null },
      { name: 'Animation', movieGenre: 16, tvGenre: 16 },
    ];

    const tmdb = tmdbClient();

    async function fetchIds() {
      const pages = [1, 2, 3];

      const movieCandidates = [];
      const tvCandidates = [];

      for (const p of pages) {
        const [popM, topM, popT, topT] = await Promise.all([
          tmdb.get('/movie/popular', { params: { page: p } }),
          tmdb.get('/movie/top_rated', { params: { page: p } }),
          tmdb.get('/tv/popular', { params: { page: p } }),
          tmdb.get('/tv/top_rated', { params: { page: p } }),
        ]);

        for (const r of popM.data?.results ?? []) movieCandidates.push(r.id);
        for (const r of topM.data?.results ?? []) movieCandidates.push(r.id);
        for (const r of popT.data?.results ?? []) tvCandidates.push(r.id);
        for (const r of topT.data?.results ?? []) tvCandidates.push(r.id);
      }

      const movieByGenre = new Map();
      const tvByGenre = new Map();

      for (const tp of tasteProfiles) {
        if (tp.movieGenre) {
          const ids = [];
          for (const p of pages) {
            const { data } = await tmdb.get('/discover/movie', {
              params: {
                page: p,
                include_adult: false,
                sort_by: 'popularity.desc',
                with_genres: tp.movieGenre,
              },
            });
            for (const r of data?.results ?? []) ids.push(r.id);
          }
          movieByGenre.set(tp.movieGenre, uniq(ids));
        }

        if (tp.tvGenre) {
          const ids = [];
          for (const p of pages) {
            const { data } = await tmdb.get('/discover/tv', {
              params: {
                page: p,
                include_adult: false,
                sort_by: 'popularity.desc',
                with_genres: tp.tvGenre,
              },
            });
            for (const r of data?.results ?? []) ids.push(r.id);
          }
          tvByGenre.set(tp.tvGenre, uniq(ids));
        }
      }

      return {
        movieCandidates: uniq(movieCandidates),
        tvCandidates: uniq(tvCandidates),
        movieByGenre,
        tvByGenre,
      };
    }

    const pool = await fetchIds();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    const seededUsers = [];
    for (let i = 0; i < body.users; i += 1) {
      const tp = tasteProfiles[i % tasteProfiles.length];
      const email = `${prefix}${tp.name.toLowerCase()}_${i}@example.com`;
      const name = `${tp.name} User ${i + 1}`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, passwordHash, name });
      }
      seededUsers.push({ user, tp });
    }

    let insertedMovies = 0;
    let insertedRatings = 0;

    for (const { user, tp } of seededUsers) {
      const likedMovieIds = sample(pool.movieByGenre.get(tp.movieGenre) ?? pool.movieCandidates, body.likesPerUser);
      const likedTvIds = sample(pool.tvByGenre.get(tp.tvGenre) ?? pool.tvCandidates, Math.floor(body.likesPerUser / 2));

      const dislikeMovieIds = sample(
        pool.movieCandidates.filter((x) => !likedMovieIds.includes(x)),
        body.dislikesPerUser
      );

      const favorites = [
        ...likedMovieIds.map((id) => ({ tmdbId: id, mediaType: 'movie', value: 1 })),
        ...likedTvIds.map((id) => ({ tmdbId: id, mediaType: 'tv', value: 1 })),
        ...dislikeMovieIds.map((id) => ({ tmdbId: id, mediaType: 'movie', value: -1 })),
      ];

      for (const f of favorites) {
        const before = await Movie.findOne({ tmdbId: f.tmdbId, mediaType: f.mediaType }).lean();
        if (!before) {
          await ensureMovie({ tmdbId: f.tmdbId, mediaType: f.mediaType });
          insertedMovies += 1;
        }

        await Rating.findOneAndUpdate(
          { userId: user._id, tmdbId: f.tmdbId, mediaType: f.mediaType },
          { $set: { value: f.value, source: 'web' } },
          { upsert: true, new: true }
        );
        insertedRatings += 1;
      }

      await User.findByIdAndUpdate(user._id, {
        $set: {
          'onboarding.favoriteMovieTmdbIds': likedMovieIds.slice(0, 30),
          'onboarding.favoriteTvTmdbIds': likedTvIds.slice(0, 30),
          'onboarding.favoriteGenreIds': uniq([tp.movieGenre, tp.tvGenre].filter(Boolean)),
          'onboarding.completedAt': new Date(),
        },
      });
    }

    return res.json({
      ok: true,
      users: seededUsers.length,
      insertedMovies,
      upsertedRatings: insertedRatings,
      defaultLoginPassword: 'Password123!',
      emailPrefix: prefix,
    });
  } catch (err) {
    return next(err);
  }
});

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, formatApiError } from '../lib/api.js';
import { toastError, toastSuccess } from '../lib/toast.js';

const ratingCache = new Map();
const inflightRating = new Map();

export const PosterCard = React.memo(function PosterCard({ item, onRated }) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [rating, setRating] = useState(() => {
    const k = `${item?.mediaType}:${item?.tmdbId}`;
    return ratingCache.has(k) ? ratingCache.get(k) : null;
  });
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const tmdbId = item?.tmdbId;
    const mediaType = item?.mediaType;
    if (!tmdbId || !mediaType) return;

    const k = `${mediaType}:${tmdbId}`;
    if (ratingCache.has(k)) {
      setRating(ratingCache.get(k));
      return;
    }

    if (inflightRating.has(k)) {
      inflightRating.get(k).then((v) => setRating(v));
      return;
    }

    const p = api
      .get(`/api/actions/my-rating?tmdbId=${tmdbId}&type=${mediaType}`)
      .then((res) => {
        const v = res?.data?.rating?.value;
        const normalized = v === 1 || v === -1 ? v : null;
        ratingCache.set(k, normalized);
        return normalized;
      })
      .catch(() => {
        ratingCache.set(k, null);
        return null;
      })
      .finally(() => {
        inflightRating.delete(k);
      });

    inflightRating.set(k, p);
    p.then((v) => setRating(v));
  }, [item?.mediaType, item?.tmdbId]);

  useEffect(() => {
    const tmdbId = item?.tmdbId;
    const mediaType = item?.mediaType;
    if (!tmdbId || !mediaType) return;
    const k = `${mediaType}:${tmdbId}`;

    function onGlobalRating(e) {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.key !== k) return;
      const next = detail.value;
      const normalized = next === 1 || next === -1 ? next : null;
      ratingCache.set(k, normalized);
      setRating(normalized);
    }

    window.addEventListener('emz:rating', onGlobalRating);
    return () => window.removeEventListener('emz:rating', onGlobalRating);
  }, [item?.mediaType, item?.tmdbId]);

  async function rate(e, value) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const nextValue = value === 'like' ? 1 : -1;
    if (rating === nextValue) {
      setFlash(value);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setFlash(null), 650);
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/actions/rate', {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        value: nextValue,
        source: 'web',
      });

      const k = `${item.mediaType}:${item.tmdbId}`;
      ratingCache.set(k, nextValue);
      setRating(nextValue);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('emz:rating', { detail: { key: k, value: nextValue } }));
      }
      setFlash(value);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setFlash(null), 900);
      toastSuccess(value === 'like' ? 'Лайк сохранён' : 'Дизлайк сохранён', { duration: 1800 });
      onRated?.(item, value);
    } catch (err) {
      toastError(formatApiError(err, 'Не удалось сохранить оценку. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  const detailUrl = `/${item.mediaType || 'movie'}/${item.tmdbId}`;

  return (
    <div className="card">
      <Link to={detailUrl} className="link-reset">
        <div className="card-poster" data-flash={flash ?? ''}>
          <div className="card-badges">
            <span className="card-badge">{item.mediaType === 'tv' ? 'TV' : 'FILM'}</span>
            {item.explanation ? <span className="card-badge card-badge--accent">Для вас</span> : null}
            {rating === 1 ? <span className="card-badge card-badge--like">Лайк</span> : null}
            {rating === -1 ? <span className="card-badge card-badge--dislike">Дизлайк</span> : null}
          </div>
          {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" /> : null}
          <div className="card-overlay">
            <div className="card-overlay-title">{item.title}</div>
            {item.explanation ? (
              <div className="card-overlay-desc">
                {item.explanation}
              </div>
            ) : null}
            <div className="card-actions">
              <button
                className={`icon-btn ${flash === 'like' || rating === 1 ? 'icon-btn--likeActive' : ''}`}
                onClick={(e) => rate(e, 'like')}
                disabled={busy}
                aria-label="Лайк"
              >
                👍
              </button>
              <button
                className={`icon-btn ${flash === 'dislike' || rating === -1 ? 'icon-btn--dislikeActive' : ''}`}
                onClick={(e) => rate(e, 'dislike')}
                disabled={busy}
                aria-label="Дизлайк"
              >
                👎
              </button>
            </div>

            {flash ? (
              <div className="saved-badge">
                <span className={`saved-badge__check ${flash === 'like' ? 'saved-badge__check--like' : 'saved-badge__check--dislike'}`}>✓</span>
                Сохранено
              </div>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="card-title">{item.title}</div>
      {item.explanation ? <div className="card-meta">{item.explanation}</div> : null}
    </div>
  );
});

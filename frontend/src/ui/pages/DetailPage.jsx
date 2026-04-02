import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { toastError, toastSuccess } from '../lib/toast.js';

export function DetailPage() {
  const { type, id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setAuthToken(token);

    async function fetchDetails() {
      try {
        setLoading(true);
        setLoadError('');
        setActionError('');

        const [detailsRes, myRatingRes] = await Promise.all([
          api.get(`/api/movies/${type}/${id}`),
          api.get(`/api/actions/my-rating?tmdbId=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`),
        ]);

        setItem(detailsRes.data.movie);
        setRating(myRatingRes.data?.rating?.value ?? 0);
      } catch (err) {
        setLoadError(formatApiError(err, 'Не удалось загрузить детали'));
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id, type]);

  async function rate(val) {
    try {
      setActionError('');
      await api.post('/api/actions/rate', { tmdbId: Number(id), mediaType: type, value: val });
      setRating(val);
      toastSuccess(val === 1 ? 'Лайк сохранён' : 'Дизлайк сохранён', { duration: 1800 });
    } catch (err) {
      const msg = formatApiError(err, 'Не удалось сохранить оценку. Попробуйте ещё раз.');
      setActionError(msg);
      toastError(msg);
    }
  }

  if (loading) {
    return (
      <div className="hero detail-hero">
        <div className="detail-poster detail-poster--skeleton skeleton" />
        <div className="detail-body">
          <div className="skeleton skeleton--h28 skeleton--w420" />
          <div className="detail-meta u-mt12">
            <div className="pill skeleton skeleton--w92 skeleton--pill" />
            <div className="pill skeleton skeleton--w112 skeleton--pill" />
            <div className="pill skeleton skeleton--w74 skeleton--pill" />
          </div>
          <div className="skeleton skeleton--h14 skeleton--w680 u-mt18" />
          <div className="skeleton skeleton--h14 skeleton--w640 u-mt10" />
          <div className="skeleton skeleton--h14 skeleton--w600 u-mt10" />
          <div className="hero-actions u-mt18 hero-actions--g12">
            <div className="btn skeleton skeleton--w160 skeleton--btn" />
            <div className="btn skeleton skeleton--w120 skeleton--btn" />
          </div>
        </div>
      </div>
    );
  }
  if (loadError || !item) return <div className="hero"><div className="error">{loadError || 'Объект не найден'}</div></div>;

  return (
    <div className="hero detail-hero">
      <div className="detail-poster">
        <img
          src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : '/placeholder.png'}
          alt={item.title}
          loading="lazy"
        />
      </div>
      <div className="detail-body">
        <h1 className="hero-title">{item.title}</h1>
        <div className="detail-meta">
          {(item.genres ?? []).slice(0, 6).map((g) => (
            <span key={g.id} className="pill">
              {g.name}
            </span>
          ))}
          {item.releaseDate ? <span className="pill pill--accent">{item.releaseDate.split('-')[0]}</span> : null}
        </div>

        <p className="hero-desc detail-overview">
          {item.overview}
        </p>

        <div className="detail-actions">
          <button
            className={`btn btn--like ${rating === 1 ? 'btn--likeActive' : ''}`}
            onClick={() => rate(1)}
          >
            👍 {rating === 1 ? 'Оценено' : 'Нравится'}
          </button>
          <button
            className={`btn btn--dislike ${rating === -1 ? 'btn--dislikeActive' : ''}`}
            onClick={() => rate(-1)}
          >
            👎 Не нравится
          </button>
          <Link to="/recommendations" className="small link-reset u-mlAuto">
            Вернуться на главную
          </Link>
        </div>

        {actionError ? <div className="error u-mt12">{actionError}</div> : null}

        {item.cast?.length > 0 && (
          <div className="u-mt40">
            <h3 className="cast-title">В ролях</h3>
            <div className="cast-list">
              {item.cast.slice(0, 10).map(name => (
                <span key={name} className="small u-op80">{name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

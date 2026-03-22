import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, setAuthToken } from '../lib/api.js';

export function DetailPage() {
  const { type, id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);

    async function fetchDetails() {
      try {
        setLoading(true);
        // We use the same 'ensure' logic or a similar endpoint to get full details
        const { data } = await api.get(`/api/movies/search?query=${id}`); 
        // Note: In a real app, we'd have GET /api/movies/:type/:id
        // For now, let's assume we can fetch by TMDB ID via a specialized endpoint or search
        const res = await api.get(`/api/movies/ensure`, { params: { tmdbId: id, mediaType: type } });
        setItem(res.data.movie);
      } catch (err) {
        setError('Не удалось загрузить детали');
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id, type]);

  async function rate(val) {
    try {
      await api.post('/api/actions/rate', { tmdbId: Number(id), mediaType: type, value: val });
      setRating(val);
    } catch (err) {
      alert('Ошибка при сохранении оценки');
    }
  }

  if (loading) return <div className="hero"><div className="small">Загрузка...</div></div>;
  if (error || !item) return <div className="hero"><div className="error">{error || 'Объект не найден'}</div></div>;

  return (
    <div className="hero" style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
      <img 
        src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : '/placeholder.png'} 
        alt={item.title}
        style={{ width: 300, borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
      />
      <div style={{ flex: 1 }}>
        <h1 className="hero-title">{item.title}</h1>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {item.genres?.map(g => (
            <span key={g.id} className="small" style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              {g.name}
            </span>
          ))}
          <span className="small" style={{ color: 'var(--primary)' }}>{item.releaseDate?.split('-')[0]}</span>
        </div>
        
        <p className="hero-desc" style={{ fontSize: 16, lineHeight: '1.6', marginBottom: 30 }}>
          {item.overview}
        </p>

        <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
          <button 
            className="btn" 
            onClick={() => rate(1)}
            style={{ background: rating === 1 ? '#22c55e' : '' }}
          >
            👍 {rating === 1 ? 'Оценено' : 'Нравится'}
          </button>
          <button 
            className="btn" 
            style={{ background: rating === -1 ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
            onClick={() => rate(-1)}
          >
            👎
          </button>
          <Link to="/" className="small" style={{ marginLeft: 'auto' }}>Вернуться на главную</Link>
        </div>

        {item.cast?.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3 style={{ fontSize: 18, marginBottom: 15 }}>В ролях</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {item.cast.slice(0, 10).map(name => (
                <span key={name} className="small" style={{ opacity: 0.8 }}>{name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

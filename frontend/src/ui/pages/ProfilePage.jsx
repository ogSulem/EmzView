import React, { useEffect, useState } from 'react';
import { api, setAuthToken } from '../lib/api.js';
import { PosterCard } from '../components/PosterCard.jsx';

export function ProfilePage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);

    async function fetchData() {
      try {
        const [meRes, statsRes, historyRes] = await Promise.all([
          api.get('/api/users/me'),
          api.get('/api/users/stats'),
          api.get('/api/actions/history?limit=50'),
        ]);
        setUser(meRes.data.user);
        setStats(statsRes.data.stats);
        setHistory(historyRes.data.history);
      } catch (err) {
        setError(err?.response?.data?.error ?? 'Ошибка загрузки профиля');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="hero"><div className="small">Загрузка профиля...</div></div>;
  if (error) return <div className="hero"><div className="error">{error}</div></div>;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="hero" style={{ marginBottom: 30 }}>
        <h1 className="hero-title">{user?.name || 'Пользователь'}</h1>
        <p className="hero-desc">{user?.email}</p>
        
        {stats && (
          <div style={{ display: 'flex', gap: 30, marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--primary)' }}>{stats.likesCount}</div>
              <div className="small">Лайков</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text)' }}>{stats.dislikesCount}</div>
              <div className="small">Дизлайков</div>
            </div>
          </div>
        )}
      </div>

      {stats?.topGenres?.length > 0 && (
        <div className="hero" style={{ marginBottom: 30, background: 'rgba(255,255,255,0.03)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 15 }}>Ваши любимые жанры</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {stats.topGenres.map(g => (
              <div key={g.id} style={{ 
                padding: '6px 12px', 
                borderRadius: 20, 
                background: 'rgba(255,61,113,0.1)', 
                border: '1px solid rgba(255,61,113,0.3)',
                fontSize: 13
              }}>
                {g.name} <span style={{ opacity: 0.6, marginLeft: 4 }}>{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hero">
        <h2 style={{ fontSize: 20, marginBottom: 20 }}>История оценок</h2>
        {history.length === 0 ? (
          <div className="small">Вы еще не оценивали фильмы или сериалы.</div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
            gap: 20 
          }}>
            {history.map(item => (
              <div key={`${item.mediaType}-${item.tmdbId}`} style={{ position: 'relative' }}>
                <PosterCard movie={item} />
                <div style={{ 
                  position: 'absolute', 
                  top: 10, 
                  right: 10, 
                  zIndex: 10,
                  background: item.value === 1 ? 'rgba(0,200,0,0.8)' : 'rgba(200,0,0,0.8)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}>
                  {item.value === 1 ? '✓' : '✕'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

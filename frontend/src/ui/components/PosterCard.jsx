import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';

export function PosterCard({ item, onRated }) {
  const [busy, setBusy] = useState(false);

  async function rate(e, value) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/api/actions/rate', {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        value: value === 'like' ? 1 : -1,
        source: 'web',
      });
      onRated?.(item, value);
    } finally {
      setBusy(false);
    }
  }

  const detailUrl = `/${item.mediaType || 'movie'}/${item.tmdbId}`;

  return (
    <div className="card">
      <Link to={detailUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card-poster">
          {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" /> : null}
          <div className="card-overlay">
            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>{item.title}</div>
            {item.explanation ? (
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,.85)' }}>
                {item.explanation}
              </div>
            ) : null}
            <div className="card-actions">
              <button className="icon-btn" onClick={(e) => rate(e, 'like')} disabled={busy}>
                👍
              </button>
              <button className="icon-btn" onClick={(e) => rate(e, 'dislike')} disabled={busy}>
                👎
              </button>
            </div>
          </div>
        </div>
      </Link>
      <div className="card-title">{item.title}</div>
      {item.explanation ? <div className="card-meta">{item.explanation}</div> : null}
    </div>
  );
}

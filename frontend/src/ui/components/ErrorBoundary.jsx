import React from 'react';

import { clearAuth } from '../lib/api.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    try {
      this.props.onError?.(error, info);
    } catch {
      // ignore
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? 'Что-то пошло не так';
    const description = this.props.description ?? 'Попробуй обновить страницу. Если ошибка повторяется — перезайди.';

    return (
      <div className="hero hero--mb14">
        <div className="hero-title">{title}</div>
        <div className="hero-desc u-mt8">{description}</div>
        {this.state.error ? (
          <pre className="errorBoundary__details u-mt12">{String(this.state.error?.message ?? this.state.error)}</pre>
        ) : null}
        <div className="hero-actions hero-actions--mt12">
          <button className="btn" onClick={() => window.location.reload()}>
            Обновить
          </button>
          <button
            className="btn"
            onClick={() => {
              clearAuth({ redirectToLogin: true });
            }}
          >
            Перезайти
          </button>
        </div>
      </div>
    );
  }
}

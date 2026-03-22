import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';

import { LoginPage } from './pages/LoginPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { OnboardingPage } from './pages/OnboardingPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { DetailPage } from './pages/DetailPage.jsx';

export default function App() {
  return (
    <div>
      <header className="topbar">
        <div className="container">
          <div className="topbar-inner">
            <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
              EMZ
            </Link>
            <nav className="nav">
              <Link to="/" style={{ textDecoration: 'none', color: 'var(--muted)' }}>
                Главная
              </Link>
              <Link to="/search" style={{ textDecoration: 'none', color: 'var(--muted)' }}>
                Поиск
              </Link>
              <Link to="/profile" style={{ textDecoration: 'none', color: 'var(--muted)' }}>
                Профиль
              </Link>
              <button
                className="btn btn-sm"
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
              >
                Выйти
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 18, paddingBottom: 36 }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/:type/:id" element={<DetailPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

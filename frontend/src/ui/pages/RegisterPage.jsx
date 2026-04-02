import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { api, formatApiError, persistAuthToken } from '../lib/api.js';
import { toastError, toastSuccess } from '../lib/toast.js';

export function RegisterPage() {
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const nextFromUrl = React.useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = String(sp.get('next') ?? '').trim();
    if (!raw) return '';
    if (!raw.startsWith('/')) return '';
    if (raw.startsWith('//')) return '';
    if (raw.startsWith('/login') || raw.startsWith('/register')) return '';
    return raw;
  }, [location.search]);

  function authError(err, fallback) {
    const status = err?.response?.status;
    if (status === 409) return 'Аккаунт с таким email уже существует.';
    return formatApiError(err, fallback);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError('');

    const cleanName = String(name ?? '').trim();
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanName) {
      setError('Введите имя.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Проверьте email.');
      return;
    }
    if ((password ?? '').length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают.');
      return;
    }

    setSaving(true);

    try {
      const { data } = await api.post('/api/auth/register', { name: cleanName, email: cleanEmail, password });
      persistAuthToken(data.token);
      toastSuccess('Аккаунт создан');
      try {
        const me = await api.get('/api/users/me');
        const completedAt = me?.data?.user?.onboarding?.completedAt;
        if (nextFromUrl) window.location.href = nextFromUrl;
        else window.location.href = completedAt ? '/recommendations' : '/onboarding';
      } catch (err) {
        window.location.href = nextFromUrl || '/onboarding';
      }
    } catch (err) {
      const msg = authError(err, 'Не удалось зарегистрироваться. Попробуйте ещё раз.');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(
    String(name ?? '').trim() &&
      String(email ?? '').trim().includes('@') &&
      (password ?? '').length >= 8 &&
      password === password2
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card hero">
        <h1 className="hero-title u-mb6">Создать аккаунт</h1>
        <p className="hero-desc">Пара кликов — и ты в персональных рекомендациях.</p>

        {error ? <div className="error u-mt10">{error}</div> : null}

        <form onSubmit={onSubmit} className="auth-form u-mt14">
          <label className="auth-label">
            <div className="small">Имя</div>
            <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к тебе обращаться" />
          </label>

          <label className="auth-label">
            <div className="small">Email</div>
            <input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
          </label>

          <label className="auth-label">
            <div className="small">Пароль</div>
            <input className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" type="password" autoComplete="new-password" />
          </label>

          <label className="auth-label">
            <div className="small">Повторите пароль</div>
            <input className="auth-input" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Ещё раз" type="password" autoComplete="new-password" />
          </label>

          <button className="btn btn--primary u-mt8" type="submit" disabled={saving || !canSubmit}>
            {saving ? 'Создаю…' : 'Создать аккаунт'}
          </button>

          <div className="small u-mt10">
            Уже есть аккаунт? <Link to="/login" className="auth-link">Войти</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

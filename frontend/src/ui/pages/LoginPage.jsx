import React, { useState } from 'react';

import { api, setAuthToken } from '../lib/api.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') ?? '');
  const [error, setError] = useState('');

  async function onLogin(e) {
    e.preventDefault();
    setError('');

    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      setAuthToken(data.token);
      setToken(data.token);
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Login failed');
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setError('');

    try {
      const { data } = await api.post('/api/auth/register', { email, password, name: 'User' });
      localStorage.setItem('token', data.token);
      setAuthToken(data.token);
      setToken(data.token);
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Register failed');
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Login</h2>
      {token ? <div style={{ color: '#7CFC9A' }}>Token saved.</div> : null}
      {error ? <div style={{ color: '#ff6b6b' }}>{error}</div> : null}

      <form style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onLogin} type="button">
            Login
          </button>
          <button onClick={onRegister} type="button">
            Register
          </button>
        </div>
      </form>
    </div>
  );
}

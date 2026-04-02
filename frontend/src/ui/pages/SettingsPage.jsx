import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { api, formatApiError, getStoredAuthToken, setAuthToken } from '../lib/api.js';
import { toastError, toastSuccess } from '../lib/toast.js';

export function SettingsPage() {
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState('');
  const [meSaving, setMeSaving] = useState(false);
  const [meSavedAt, setMeSavedAt] = useState(0);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetOk, setResetOk] = useState(false);
  const [resetTokenDev, setResetTokenDev] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetNewPassword2, setResetNewPassword2] = useState('');

  useEffect(() => {
    setPwOk(false);
  }, [currentPassword, newPassword, newPassword2]);

  useEffect(() => {
    setResetOk(false);
  }, [email, resetTokenInput, resetNewPassword, resetNewPassword2]);

  const [pageStep, setPageStep] = useState(() => {
    try {
      const raw = localStorage.getItem('emz_page_step');
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 8 && n <= 40) return n;
    } catch {
      // ignore
    }
    return 16;
  });

  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return document?.documentElement?.getAttribute('data-theme') ?? 'dark';
  });

  useEffect(() => {
    function onThemeSet(e) {
      const next = e?.detail;
      if (next !== 'light' && next !== 'dark') return;
      setCurrentTheme(next);
    }
    window.addEventListener('emz:theme', onThemeSet);
    return () => window.removeEventListener('emz:theme', onThemeSet);
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setMeError('');
      setMeLoading(true);
      try {
        const { data } = await api.get('/api/users/me');
        if (!mounted) return;
        const u = data?.user;
        setName(u?.name ?? '');
        setEmail(u?.email ?? '');
      } catch (err) {
        if (!mounted) return;
        setMeError(formatApiError(err, 'Не удалось загрузить профиль'));
      } finally {
        if (!mounted) return;
        setMeLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback((next) => {
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ignore
    }
    setCurrentTheme(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('emz:theme', { detail: next }));
    }
  }, []);

  const setStep = useCallback((n) => {
    setPageStep(n);
    try {
      localStorage.setItem('emz_page_step', String(n));
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('emz:settings', { detail: { pageStep: n } }));
    }
  }, []);

  const canSaveProfile = useMemo(() => {
    const n = String(name ?? '').trim();
    const e = String(email ?? '').trim();
    if (!n) return false;
    if (!e) return false;
    if (!e.includes('@')) return false;
    return true;
  }, [email, name]);

  const canChangePassword = useMemo(() => {
    const cur = String(currentPassword ?? '');
    const np = String(newPassword ?? '');
    const np2 = String(newPassword2 ?? '');
    if (!cur) return false;
    if (np.length < 8) return false;
    if (np !== np2) return false;
    return true;
  }, [currentPassword, newPassword, newPassword2]);

  const canResetPassword = useMemo(() => {
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    const tok = String(resetTokenInput ?? '').trim();
    const np = String(resetNewPassword ?? '');
    const np2 = String(resetNewPassword2 ?? '');
    if (!cleanEmail || !cleanEmail.includes('@')) return false;
    if (tok.length < 10) return false;
    if (np.length < 8) return false;
    if (np !== np2) return false;
    return true;
  }, [email, resetNewPassword, resetNewPassword2, resetTokenInput]);

  const saveProfile = useCallback(async () => {
    if (!canSaveProfile) return;
    if (meSaving) return;
    setMeSaving(true);
    setMeError('');
    try {
      const { data } = await api.put('/api/users/me', {
        name: String(name).trim(),
        email: String(email).trim(),
      });
      const u = data?.user;
      if (typeof window !== 'undefined' && u?.name && u?.email) {
        window.dispatchEvent(new CustomEvent('emz:user', { detail: { name: u.name, email: u.email } }));
      }
      setMeSavedAt(Date.now());
      toastSuccess('Профиль сохранён');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        const msg = 'Этот email уже занят. Попробуйте другой.';
        setMeError(msg);
        toastError(msg);
      } else {
        const msg = formatApiError(err, 'Не удалось сохранить профиль');
        setMeError(msg);
        toastError(msg);
      }
    } finally {
      setMeSaving(false);
    }
  }, [canSaveProfile, email, meSaving, name]);

  const changePassword = useCallback(async () => {
    if (pwBusy) return;
    setPwOk(false);
    setPwError('');

    const cur = String(currentPassword ?? '');
    if (!cur) {
      setPwError('Введите текущий пароль.');
      return;
    }

    const np = String(newPassword ?? '');
    const np2 = String(newPassword2 ?? '');
    if (np.length < 8) {
      setPwError('Новый пароль должен быть не короче 8 символов.');
      return;
    }
    if (np !== np2) {
      setPwError('Пароли не совпадают.');
      return;
    }
    setPwBusy(true);
    try {
      await api.post('/api/users/change-password', {
        currentPassword: cur,
        newPassword: np,
      });
      setPwOk(true);
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      toastSuccess('Пароль изменён');
    } catch (err) {
      if (err?.response?.status === 401) {
        const msg = 'Текущий пароль неверный.';
        setPwError(msg);
        toastError(msg);
      } else {
        const msg = formatApiError(err, 'Не удалось изменить пароль');
        setPwError(msg);
        toastError(msg);
      }
    } finally {
      setPwBusy(false);
    }
  }, [currentPassword, newPassword, newPassword2, pwBusy]);

  const requestPasswordReset = useCallback(async () => {
    if (resetBusy) return;
    setResetOk(false);
    setResetError('');
    setResetTokenDev('');

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetError('Проверьте email.');
      return;
    }

    setResetBusy(true);
    try {
      const { data } = await api.post('/api/auth/request-password-reset', {
        email: cleanEmail,
      });
      setResetOk(true);
      toastSuccess('Если аккаунт существует — код создан.');
      if (data?.token) {
        setResetTokenDev(String(data.token));
        setResetTokenInput(String(data.token));
      }
    } catch (err) {
      const msg = formatApiError(err, 'Не удалось запросить восстановление');
      setResetError(msg);
      toastError(msg);
    } finally {
      setResetBusy(false);
    }
  }, [email, resetBusy]);

  const resetPassword = useCallback(async () => {
    if (resetBusy) return;
    setResetOk(false);
    setResetError('');

    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetError('Проверьте email.');
      return;
    }

    const np = String(resetNewPassword ?? '');
    const np2 = String(resetNewPassword2 ?? '');
    if (np.length < 8) {
      setResetError('Новый пароль должен быть не короче 8 символов.');
      return;
    }
    if (np !== np2) {
      setResetError('Пароли не совпадают.');
      return;
    }
    const tok = String(resetTokenInput ?? '').trim();
    if (tok.length < 10) {
      setResetError('Введите код восстановления.');
      return;
    }
    setResetBusy(true);
    try {
      await api.post('/api/auth/reset-password', {
        email: cleanEmail,
        token: tok,
        newPassword: np,
      });
      setResetOk(true);
      setResetNewPassword('');
      setResetNewPassword2('');
      toastSuccess('Пароль обновлён');
    } catch (err) {
      const status = err?.response?.status;
      const msg = String(err?.response?.data?.error ?? '').toLowerCase();
      if (status === 400 && msg.includes('token')) {
        const m = 'Код недействителен или истёк. Запросите новый.';
        setResetError(m);
        toastError(m);
      } else {
        const m = formatApiError(err, 'Не удалось восстановить пароль');
        setResetError(m);
        toastError(m);
      }
    } finally {
      setResetBusy(false);
    }
  }, [email, resetBusy, resetNewPassword, resetNewPassword2, resetTokenInput]);

  return (
    <div className="u-pb40">
      <div className="hero hero--mb14">
        <h1 className="hero-title">Настройки</h1>
        <p className="hero-desc">Аккаунт, безопасность и интерфейс.</p>
      </div>

      <div className="hero u-mb30">
        <h2 className="hero-title hero-title--sm u-mb15">Аккаунт</h2>
        {meLoading ? <div className="small">Загружаю профиль…</div> : null}
        {meError ? <div className="error u-mt10">{meError}</div> : null}

        {!meLoading ? (
          <>
            <div className="small u-mb8">Имя</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />

            <div className="small u-mt12 u-mb8">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

            <div className="hero-actions hero-actions--mt12">
              <button className="btn btn--primary" type="button" onClick={saveProfile} disabled={!canSaveProfile || meSaving}>
                {meSaving ? 'Сохраняю…' : 'Сохранить'}
              </button>
              {meSavedAt ? <div className="small">Сохранено</div> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="hero u-mb30">
        <h2 className="hero-title hero-title--sm u-mb15">Безопасность</h2>

        <div className="small u-mb8">Смена пароля</div>
        {pwError ? <div className="error u-mb10">{pwError}</div> : null}
        {pwOk ? <div className="small u-mb10">Пароль изменён</div> : null}
        <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Текущий пароль" />
        <div className="u-mt10" />
        <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Новый пароль (мин. 8 символов)" />
        <div className="u-mt10" />
        <input className="input" type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} placeholder="Повторите новый пароль" />
        <div className="hero-actions hero-actions--mt12">
          <button className="btn btn--primary" type="button" onClick={changePassword} disabled={pwBusy || !canChangePassword}>
            {pwBusy ? 'Меняю…' : 'Изменить пароль'}
          </button>
        </div>

        <div className="u-mt14" />
        <div className="small u-mb8">Восстановление пароля</div>
        {resetError ? <div className="error u-mb10">{resetError}</div> : null}
        {resetOk ? <div className="small u-mb10">Если аккаунт существует — код создан.</div> : null}
        <div className="hero-actions hero-actions--mt12">
          <button className="btn" type="button" onClick={requestPasswordReset} disabled={resetBusy || !String(email ?? '').trim().includes('@')}>
            {resetBusy ? 'Отправляю…' : 'Получить код'}
          </button>
        </div>
        {import.meta.env.DEV && resetTokenDev ? <div className="small u-mt10">DEV-код: {resetTokenDev}</div> : null}
        <div className="u-mt10" />
        <input className="input" value={resetTokenInput} onChange={(e) => setResetTokenInput(e.target.value)} placeholder="Код восстановления" />
        <div className="u-mt10" />
        <input className="input" type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="Новый пароль" />
        <div className="u-mt10" />
        <input className="input" type="password" value={resetNewPassword2} onChange={(e) => setResetNewPassword2(e.target.value)} placeholder="Повторите новый пароль" />
        <div className="hero-actions hero-actions--mt12">
          <button className="btn btn--primary" type="button" onClick={resetPassword} disabled={resetBusy || !canResetPassword}>
            {resetBusy ? 'Сохраняю…' : 'Сбросить пароль'}
          </button>
        </div>
      </div>

      <div className="hero u-mb30">
        <h2 className="hero-title hero-title--sm u-mb15">Интенсивность подгрузки</h2>
        <div className="segmented" role="tablist" aria-label="Интенсивность витрин">
          <button
            className={`segmented__btn ${pageStep === 12 ? 'segmented__btn--active' : ''}`}
            onClick={() => setStep(12)}
            type="button"
            role="tab"
            aria-selected={pageStep === 12}
          >
            Экономно
          </button>
          <button
            className={`segmented__btn ${pageStep === 16 ? 'segmented__btn--active' : ''}`}
            onClick={() => setStep(16)}
            type="button"
            role="tab"
            aria-selected={pageStep === 16}
          >
            Баланс
          </button>
          <button
            className={`segmented__btn ${pageStep === 24 ? 'segmented__btn--active' : ''}`}
            onClick={() => setStep(24)}
            type="button"
            role="tab"
            aria-selected={pageStep === 24}
          >
            Больше
          </button>
        </div>
      </div>

      <div className="hero u-mb30">
        <h2 className="hero-title hero-title--sm u-mb15">Тема</h2>
        <div className="segmented" role="tablist" aria-label="Тема">
          <button
            className={`segmented__btn ${currentTheme === 'light' ? 'segmented__btn--active' : ''}`}
            onClick={() => setTheme('light')}
            type="button"
            role="tab"
            aria-selected={currentTheme === 'light'}
          >
            Светлая
          </button>
          <button
            className={`segmented__btn ${currentTheme === 'dark' ? 'segmented__btn--active' : ''}`}
            onClick={() => setTheme('dark')}
            type="button"
            role="tab"
            aria-selected={currentTheme === 'dark'}
          >
            Тёмная
          </button>
        </div>
      </div>
    </div>
  );
}

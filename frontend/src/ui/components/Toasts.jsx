import React from 'react';

export function Toasts() {
  const [items, setItems] = React.useState([]);

  const remove = React.useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    function onToast(e) {
      const t = e?.detail;
      if (!t?.id) return;
      setItems((prev) => {
        const next = [t, ...(prev ?? [])];
        return next.slice(0, 4);
      });

      const ms = Number(t.duration ?? 3500);
      if (Number.isFinite(ms) && ms > 0) {
        window.setTimeout(() => remove(t.id), ms);
      }
    }

    window.addEventListener('emz:toast', onToast);
    return () => window.removeEventListener('emz:toast', onToast);
  }, [remove]);

  if (!items.length) return null;

  return (
    <div className="toasts" role="region" aria-label="Уведомления">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type || 'info'}`}
          role="status"
          aria-live="polite"
        >
          <div className="toast__body">
            {t.title ? <div className="toast__title">{t.title}</div> : null}
            {t.message ? <div className="toast__message">{t.message}</div> : null}
          </div>
          <button className="toast__close" onClick={() => remove(t.id)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

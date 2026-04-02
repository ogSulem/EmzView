export function toast({ type = 'info', title = '', message = '', duration = 3500 } = {}) {
  if (typeof window === 'undefined') return;
  const detail = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    title,
    message,
    duration,
    at: Date.now(),
  };
  window.dispatchEvent(new CustomEvent('emz:toast', { detail }));
}

export function toastSuccess(message, opts = {}) {
  return toast({ type: 'success', message, ...opts });
}

export function toastError(message, opts = {}) {
  return toast({ type: 'error', message, ...opts });
}

export function toastInfo(message, opts = {}) {
  return toast({ type: 'info', message, ...opts });
}

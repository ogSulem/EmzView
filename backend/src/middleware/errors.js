export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not Found' });
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err.statusCode ?? 500;
  const message = err.expose ? err.message : 'Internal Server Error';

  res.status(status).json({ error: message });
}

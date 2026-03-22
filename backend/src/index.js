import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import logger from './lib/logger.js';
import rateLimit from 'express-rate-limit';

import { connectMongo } from './lib/mongo.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { moviesRouter } from './routes/movies.js';
import { actionsRouter } from './routes/actions.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { usersRouter } from './routes/users.js';

dotenv.config();

const app = express();

app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(morgan('dev', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/users', usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 8080);

await connectMongo(process.env.MONGODB_URI);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${port}`);
});

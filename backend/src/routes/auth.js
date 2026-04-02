import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { User } from '../models/User.js';

export const authRouter = Router();

const authLoginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const authRegisterLimiter = rateLimit({
  windowMs: 30 * 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const authResetRequestLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const authResetPerformLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post('/register', authRegisterLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: normalizedEmail, passwordHash, name });

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    );

    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/request-password-reset', authResetRequestLimiter, async (req, res, next) => {
  try {
    const { email } = requestResetSchema.parse(req.body ?? {});
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const isDev = process.env.NODE_ENV !== 'production';
    return res.json({ ok: true, token: isDev ? token : undefined });
  } catch (err) {
    return next(err);
  }
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200),
});

authRouter.post('/reset-password', authResetPerformLimiter, async (req, res, next) => {
  try {
    const { email, token, newPassword } = resetPasswordSchema.parse(req.body ?? {});
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: 'Invalid token' });

    if (!user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    if (tokenHash !== user.passwordResetTokenHash) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

const telegramSchema = z.object({
  telegramUserId: z.number().int().positive(),
  secret: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

authRouter.post('/telegram', async (req, res, next) => {
  try {
    const { telegramUserId, secret, email, name } = telegramSchema.parse(req.body);

    const expected = process.env.BOT_SHARED_SECRET;
    if (!expected || secret !== expected) {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    let user = await User.findOne({ telegramUserId });

    if (!user) {
      if (!email) {
        return res.status(400).json({ error: 'email is required for first-time Telegram link' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        existing.telegramUserId = telegramUserId;
        await existing.save();
        user = existing;
      } else {
        const passwordHash = await bcrypt.hash(jwt.sign({ t: telegramUserId }, process.env.JWT_SECRET), 10);
        user = await User.create({
          email: normalizedEmail,
          passwordHash,
          name: name ?? 'Telegram User',
          telegramUserId,
        });
      }
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    );

    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', authLoginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    );

    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { User } from '../models/User.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });

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

      const existing = await User.findOne({ email });
      if (existing) {
        existing.telegramUserId = telegramUserId;
        await existing.save();
        user = existing;
      } else {
        const passwordHash = await bcrypt.hash(jwt.sign({ t: telegramUserId }, process.env.JWT_SECRET), 10);
        user = await User.create({
          email,
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

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
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

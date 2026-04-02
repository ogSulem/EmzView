import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    telegramUserId: { type: Number, default: null, index: true },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
    onboarding: {
      favoriteMovieTmdbIds: { type: [Number], default: [] },
      favoriteTvTmdbIds: { type: [Number], default: [] },
      favoriteGenreIds: { type: [Number], default: [] },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tmdbId: { type: Number, required: true, index: true },
    mediaType: { type: String, enum: ['movie', 'tv'], required: true },
    value: { type: Number, enum: [-1, 1], required: true },
    source: { type: String, enum: ['web', 'telegram'], required: true },
  },
  { timestamps: true }
);

ratingSchema.index({ userId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });

export const Rating = mongoose.model('Rating', ratingSchema);

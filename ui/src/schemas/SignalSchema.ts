import mongoose from 'mongoose';

export interface ISignal {
  creatorId: string;
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string; // "LONG" or "SHORT"
  leverageMultiplier: number; // e.g., 1.5 for 1.5x leverage
  limitPricePercentage?: number; // percentage offset from current price
  triggerPricePercentage?: number; // percentage offset from current price
  oraclePriceOffsetPercentage?: number; // percentage offset
  takeProfitPercentage?: number; // percentage gain
  stopLossPercentage?: number; // percentage loss
  postOnly: boolean;
  expiryTime: Date; // When the signal expires
  expiryDuration: number; // Duration in minutes
  expiryUnit: string; // "minutes" or "hours"
  createdAt: Date;
  isActive: boolean; // Whether the signal is still valid
}

const SignalSchema = new mongoose.Schema<ISignal>(
  {
    creatorId: {
      type: String,
      required: true,
      index: true,
    },
    experienceId: {
      type: String,
      required: true,
      index: true,
    },
    marketIndex: {
      type: Number,
      required: true,
    },
    marketSymbol: {
      type: String,
      required: true,
    },
    orderType: {
      type: String,
      required: true,
      enum: ['market', 'limit', 'takeProfit', 'stopLoss', 'oracleLimit'],
    },
    direction: {
      type: String,
      required: true,
      enum: ['LONG', 'SHORT'],
    },
    leverageMultiplier: {
      type: Number,
      required: true,
      min: 0.1,
      max: 20,
    },
    limitPricePercentage: {
      type: Number,
      required: false,
    },
    triggerPricePercentage: {
      type: Number,
      required: false,
    },
    oraclePriceOffsetPercentage: {
      type: Number,
      required: false,
    },
    takeProfitPercentage: {
      type: Number,
      required: false,
      min: 0,
    },
    stopLossPercentage: {
      type: Number,
      required: false,
      min: 0,
    },
    postOnly: {
      type: Boolean,
      required: true,
      default: false,
    },
    expiryTime: {
      type: Date,
      required: true,
      index: true,
    },
    expiryDuration: {
      type: Number,
      required: true,
      min: 1,
    },
    expiryUnit: {
      type: String,
      required: true,
      enum: ['minutes', 'hours'],
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
SignalSchema.index({ experienceId: 1, isActive: 1, expiryTime: -1 });
SignalSchema.index({ creatorId: 1, createdAt: -1 });
SignalSchema.index({ experienceId: 1, createdAt: -1 });

// Index to help with expiry cleanup queries
SignalSchema.index({ isActive: 1, expiryTime: 1 });

export default mongoose.models.Signal || mongoose.model<ISignal>('Signal', SignalSchema);

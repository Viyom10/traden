import mongoose from 'mongoose';

export interface ITradeSignal {
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string; // "LONG" or "SHORT"
  leverageMultiplier: number; // e.g., 2 for 2x, 3 for 3x
  limitPrice?: string;
  triggerPrice?: string;
  oraclePriceOffset?: string;
  takeProfitPercentage?: number; // e.g., 10 for 10% profit
  stopLossPercentage?: number; // e.g., 5 for 5% loss
  reduceOnly: boolean;
  postOnly: boolean;
  expiryDuration: number; // e.g., 15
  expiryUnit: string; // "min", "hour", "day"
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

const TradeSignalSchema = new mongoose.Schema<ITradeSignal>(
  {
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
      max: 10,
    },
    limitPrice: {
      type: String,
      required: false,
    },
    triggerPrice: {
      type: String,
      required: false,
    },
    oraclePriceOffset: {
      type: String,
      required: false,
    },
    takeProfitPercentage: {
      type: Number,
      required: false,
      min: 0,
      max: 1000, // Max 1000% (10x)
    },
    stopLossPercentage: {
      type: Number,
      required: false,
      min: 0,
      max: 100, // Max 100% loss
    },
    reduceOnly: {
      type: Boolean,
      required: true,
      default: false,
    },
    postOnly: {
      type: Boolean,
      required: true,
      default: false,
    },
    expiryDuration: {
      type: Number,
      required: true,
      min: 1,
    },
    expiryUnit: {
      type: String,
      required: true,
      enum: ['min', 'hour', 'day'],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
TradeSignalSchema.index({ experienceId: 1, isActive: 1, expiresAt: -1 });
TradeSignalSchema.index({ isActive: 1, expiresAt: 1 }); // For cleanup queries

export default mongoose.models.TradeSignal || mongoose.model<ITradeSignal>('TradeSignal', TradeSignalSchema);

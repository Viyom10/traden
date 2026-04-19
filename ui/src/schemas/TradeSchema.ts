/**
 * @module schemas/TradeSchema
 *
 * MongoDB schema for the OFF-CHAIN mirror of trade submissions.
 *
 * Like {@link FeeSchema}, this is purely a denormalized view for the UI;
 * the canonical record is the on-chain transaction identified by
 * `txSignature`. The `useSwift` flag is recorded so the audit trail
 * distinguishes orders that did vs. did not flow through the atomic-fee
 * interceptor (Swift orders bypass `driftClient.sendTransaction`).
 */
import mongoose from 'mongoose';

/** Off-chain mirror of a single trade submission. */
export interface ITrade {
  userId: string;
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string; // "LONG" or "SHORT"
  sizeType: string; // "base" or "quote"
  size: string;
  limitPrice?: string;
  triggerPrice?: string;
  oraclePriceOffset?: string;
  takeProfitPrice?: string;
  stopLossPrice?: string;
  reduceOnly: boolean;
  postOnly: boolean;
  useSwift: boolean;
  subAccountId: number;
  timestamp: Date;
  txSignature?: string;
}

const TradeSchema = new mongoose.Schema<ITrade>(
  {
    userId: {
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
    sizeType: {
      type: String,
      required: true,
      enum: ['base', 'quote'],
    },
    size: {
      type: String,
      required: true,
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
    takeProfitPrice: {
      type: String,
      required: false,
    },
    stopLossPrice: {
      type: String,
      required: false,
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
    useSwift: {
      type: Boolean,
      required: true,
      default: false,
    },
    subAccountId: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    txSignature: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
TradeSchema.index({ userId: 1, timestamp: -1 });
TradeSchema.index({ experienceId: 1, timestamp: -1 });
TradeSchema.index({ userId: 1, experienceId: 1, timestamp: -1 });

export default mongoose.models.Trade || mongoose.model<ITrade>('Trade', TradeSchema);

import mongoose from 'mongoose';

export interface IFee {
  userId: string;
  experienceId: string;
  feeAmount: string; // Fee in SOL as a string for precision
  feeInLamports: string; // Fee in lamports as a string
  orderSize: string;
  assetType: 'base' | 'quote';
  txSignature?: string;
  timestamp: Date;
}

const FeeSchema = new mongoose.Schema<IFee>(
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
    feeAmount: {
      type: String,
      required: true,
    },
    feeInLamports: {
      type: String,
      required: true,
    },
    orderSize: {
      type: String,
      required: true,
    },
    assetType: {
      type: String,
      required: true,
      enum: ['base', 'quote'],
    },
    txSignature: {
      type: String,
      required: false,
    },
    timestamp: {
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
FeeSchema.index({ userId: 1, timestamp: -1 });
FeeSchema.index({ experienceId: 1, timestamp: -1 });
FeeSchema.index({ userId: 1, experienceId: 1, timestamp: -1 });

export default mongoose.models.Fee || mongoose.model<IFee>('Fee', FeeSchema);

import mongoose from 'mongoose';

export interface IFeeClaim {
  _id?: mongoose.Types.ObjectId | string;
  experienceId: string;
  publicKey: string;
  claimedAmount: string; // Amount in SOL as a string for precision
  claimedAmountInLamports: string; // Amount in lamports as a string
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claimedAt: Date;
  processedAt?: Date;
  txSignature?: string;
}

const FeeClaimSchema = new mongoose.Schema<IFeeClaim>(
  {
    experienceId: {
      type: String,
      required: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    claimedAmount: {
      type: String,
      required: true,
    },
    claimedAmountInLamports: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    claimedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      required: false,
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
FeeClaimSchema.index({ experienceId: 1, claimedAt: -1 });
FeeClaimSchema.index({ experienceId: 1, status: 1 });

export default mongoose.models.FeeClaim || mongoose.model<IFeeClaim>('FeeClaim', FeeClaimSchema);

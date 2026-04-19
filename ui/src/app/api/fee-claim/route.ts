import { NextRequest, NextResponse } from 'next/server';
import dbConnect, { isMongoConfigured } from '@/lib/db';
import FeeClaim from '@/schemas/FeeClaimSchema';
import Fee from '@/schemas/FeeSchema';

export async function POST(request: NextRequest) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json(
        { success: true, mongoConfigured: false, message: 'MONGODB_URI not set — claim not persisted' },
        { status: 200 }
      );
    }
    await dbConnect();

    const body = await request.json();
    
    const { experienceId, publicKey, claimedAmount, claimedAmountInLamports } = body;

    if (!experienceId || !publicKey || !claimedAmount || !claimedAmountInLamports) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate public key format (basic check)
    if (publicKey.length < 32 || publicKey.length > 44) {
      return NextResponse.json(
        { error: 'Invalid public key format' },
        { status: 400 }
      );
    }

    // Create new fee claim record
    const feeClaim = new FeeClaim({
      experienceId,
      publicKey,
      claimedAmount,
      claimedAmountInLamports,
      status: 'pending',
      claimedAt: new Date(),
    });

    await feeClaim.save();

    return NextResponse.json(
      { 
        success: true, 
        claimId: feeClaim._id,
        message: 'Fee claim request submitted successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating fee claim:', error);
    return NextResponse.json(
      { error: 'Failed to create fee claim', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const experienceId = searchParams.get('experienceId');

    if (!isMongoConfigured()) {
      return NextResponse.json(
        {
          success: true,
          mongoConfigured: false,
          claims: [],
          totalClaimedInLamports: '0',
          totalClaimedInSol: 0,
          totalFeesInLamports: '0',
          totalFeesInSol: 0,
          claimableFeesInLamports: '0',
          claimableFeesInSol: 0,
        },
        { status: 200 }
      );
    }
    await dbConnect();

    if (!experienceId) {
      return NextResponse.json(
        { error: 'experienceId is required' },
        { status: 400 }
      );
    }

    // Fetch all fee claims for this experience
    const claims = await FeeClaim.find({ experienceId })
      .sort({ claimedAt: -1 })
      .lean();

    // Calculate total claimed fees
    const totalClaimedInLamports = claims.reduce((sum, claim) => {
      return sum + BigInt(claim.claimedAmountInLamports);
    }, BigInt(0));

    const totalClaimedInSol = Number(totalClaimedInLamports) / 1_000_000_000;

    // Fetch total fees earned for this experience
    const fees = await Fee.find({ experienceId }).lean();
    const totalFeesInLamports = fees.reduce((sum, fee) => {
      return sum + BigInt(fee.feeInLamports);
    }, BigInt(0));

    // Creator gets 50% of total fees
    const creatorFeesInLamports = totalFeesInLamports / BigInt(2);
    const creatorFeesInSol = Number(creatorFeesInLamports) / 1_000_000_000;

    // Calculate claimable fees
    const claimableFeesInLamports = creatorFeesInLamports - totalClaimedInLamports;
    const claimableFeesInSol = Number(claimableFeesInLamports) / 1_000_000_000;

    return NextResponse.json(
      {
        success: true,
        claims,
        totalClaimedInLamports: totalClaimedInLamports.toString(),
        totalClaimedInSol,
        totalFeesInLamports: creatorFeesInLamports.toString(),
        totalFeesInSol: creatorFeesInSol,
        claimableFeesInLamports: claimableFeesInLamports.toString(),
        claimableFeesInSol,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching fee claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee claims', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json(
        { success: true, mongoConfigured: false, message: 'MONGODB_URI not set — claim not deleted' },
        { status: 200 }
      );
    }
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const claimId = searchParams.get('claimId');

    if (!claimId) {
      return NextResponse.json(
        { error: 'claimId is required' },
        { status: 400 }
      );
    }

    // Find the claim
    const claim = await FeeClaim.findById(claimId);

    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Only allow deletion if status is pending
    if (claim.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending claims' },
        { status: 400 }
      );
    }

    // Delete the claim
    await FeeClaim.findByIdAndDelete(claimId);

    return NextResponse.json(
      {
        success: true,
        message: 'Claim cancelled successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling fee claim:', error);
    return NextResponse.json(
      { error: 'Failed to cancel fee claim', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

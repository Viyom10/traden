import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import FeeClaim from '@/schemas/FeeClaimSchema';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Build query
    const query: { status?: string } = {};
    if (status) {
      query.status = status;
    }

    // Fetch claims with pagination
    const claims = await FeeClaim.find(query)
      .sort({ claimedAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await FeeClaim.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(
      {
        success: true,
        claims,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching all fee claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee claims', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { claimId, txSignature, status } = body;

    if (!claimId) {
      return NextResponse.json(
        { error: 'claimId is required' },
        { status: 400 }
      );
    }

    if (!status || !['processing', 'completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (processing, completed, or failed)' },
        { status: 400 }
      );
    }

    // Find and update the claim
    const updateData: {
      status: string;
      processedAt?: Date;
      txSignature?: string;
    } = {
      status,
    };

    if (status === 'completed' || status === 'failed') {
      updateData.processedAt = new Date();
    }

    if (txSignature) {
      updateData.txSignature = txSignature;
    }

    const updatedClaim = await FeeClaim.findByIdAndUpdate(
      claimId,
      updateData,
      { new: true }
    );

    if (!updatedClaim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        claim: updatedClaim,
        message: 'Claim updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating fee claim:', error);
    return NextResponse.json(
      { error: 'Failed to update fee claim', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import dbConnect, { isMongoConfigured } from '@/lib/db';
import Fee from '@/schemas/FeeSchema';

export async function POST(request: NextRequest) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json(
        { success: true, mongoConfigured: false, message: 'MONGODB_URI not set — fee not persisted off-chain' },
        { status: 200 }
      );
    }
    await dbConnect();

    const body = await request.json();
    
    // Validate required fields
    const {
      userId,
      experienceId,
      feeAmount,
      feeInLamports,
      orderSize,
      assetType,
    } = body;

    if (!userId || !experienceId || !feeAmount || !feeInLamports || !orderSize || !assetType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new fee record
    const fee = new Fee({
      userId,
      experienceId,
      feeAmount,
      feeInLamports,
      orderSize,
      assetType,
      txSignature: body.txSignature,
      timestamp: new Date(),
    });

    await fee.save();

    return NextResponse.json(
      { 
        success: true, 
        feeId: fee._id,
        message: 'Fee recorded successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording fee:', error);
    return NextResponse.json(
      { error: 'Failed to record fee', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    if (!isMongoConfigured()) {
      return NextResponse.json(
        {
          success: true,
          mongoConfigured: false,
          fees: [],
          totalCount: 0,
          totalFeesInLamports: '0',
          totalFeesInSol: 0,
          limit,
          skip,
        },
        { status: 200 }
      );
    }
    await dbConnect();

    const userId = searchParams.get('userId');
    const experienceId = searchParams.get('experienceId');

    // Build query
    const query: { userId?: string; experienceId?: string } = {};
    if (userId) query.userId = userId;
    if (experienceId) query.experienceId = experienceId;

    // Fetch fees
    const fees = await Fee.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await Fee.countDocuments(query);

    // Calculate total fees collected
    const totalFeesInLamports = fees.reduce((sum, fee) => {
      return sum + BigInt(fee.feeInLamports);
    }, BigInt(0));

    const totalFeesInSol = Number(totalFeesInLamports) / 1_000_000_000;

    return NextResponse.json(
      {
        success: true,
        fees,
        totalCount,
        totalFeesInLamports: totalFeesInLamports.toString(),
        totalFeesInSol,
        limit,
        skip,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fees', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

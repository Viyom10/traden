import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TradeSignal from '@/schemas/TradeSignalSchema';

// Helper function to calculate expiry date
function calculateExpiryDate(duration: number, unit: string): Date {
  const now = new Date();
  
  switch (unit) {
    case 'min':
      return new Date(now.getTime() + duration * 60 * 1000);
    case 'hour':
      return new Date(now.getTime() + duration * 60 * 60 * 1000);
    case 'day':
      return new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Invalid expiry unit: ${unit}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    
    // Validate required fields
    const {
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      leverageMultiplier,
      expiryDuration,
      expiryUnit,
    } = body;

    if (!experienceId || marketIndex === undefined || !marketSymbol || 
        !orderType || !direction || leverageMultiplier === undefined || 
        !expiryDuration || !expiryUnit) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate expiryDuration is positive
    if (expiryDuration <= 0) {
      return NextResponse.json(
        { error: 'Expiry duration must be positive' },
        { status: 400 }
      );
    }

    // Calculate expiry date
    const expiresAt = calculateExpiryDate(expiryDuration, expiryUnit);

    // Create new trade signal
    const signal = new TradeSignal({
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      leverageMultiplier,
      limitPrice: body.limitPrice,
      triggerPrice: body.triggerPrice,
      oraclePriceOffset: body.oraclePriceOffset,
      takeProfitPercentage: body.takeProfitPercentage,
      stopLossPercentage: body.stopLossPercentage,
      reduceOnly: body.reduceOnly || false,
      postOnly: body.postOnly || false,
      expiryDuration,
      expiryUnit,
      expiresAt,
      isActive: true,
      createdAt: new Date(),
    });

    await signal.save();

    return NextResponse.json(
      { 
        success: true, 
        signalId: signal._id,
        expiresAt: signal.expiresAt,
        message: 'Trade signal created successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating trade signal:', error);
    return NextResponse.json(
      { error: 'Failed to create trade signal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const experienceId = searchParams.get('experienceId');
    const includeExpired = searchParams.get('includeExpired') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    // Build query
    const query: {
      experienceId?: string;
      isActive?: boolean;
      expiresAt?: { $gt: Date };
    } = {};

    if (experienceId) query.experienceId = experienceId;
    
    // Only return active signals by default
    query.isActive = true;

    // Filter out expired signals unless explicitly requested
    if (!includeExpired) {
      query.expiresAt = { $gt: new Date() };
    }

    // Fetch signals
    const signals = await TradeSignal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await TradeSignal.countDocuments(query);

    return NextResponse.json(
      {
        success: true,
        signals,
        totalCount,
        limit,
        skip,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching trade signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade signals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const signalId = searchParams.get('signalId');

    if (!signalId) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    // Deactivate the signal instead of deleting
    const result = await TradeSignal.findByIdAndUpdate(
      signalId,
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Trade signal cancelled successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling trade signal:', error);
    return NextResponse.json(
      { error: 'Failed to cancel trade signal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

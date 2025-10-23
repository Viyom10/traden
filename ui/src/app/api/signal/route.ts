import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Signal from '@/schemas/SignalSchema';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    
    // Validate required fields
    const {
      creatorId,
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      leverageMultiplier,
      expiryDuration,
      expiryUnit,
    } = body;

    if (!creatorId || !experienceId || marketIndex === undefined || !marketSymbol || 
        !orderType || !direction || !leverageMultiplier || !expiryDuration || !expiryUnit) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate leverage multiplier
    if (leverageMultiplier < 0.1 || leverageMultiplier > 2.5) {
      return NextResponse.json(
        { error: 'Leverage multiplier must be between 0.1 and 2.5' },
        { status: 400 }
      );
    }

    // Calculate expiry time
    const now = new Date();
    const expiryTime = new Date(now);
    if (expiryUnit === 'minutes') {
      expiryTime.setMinutes(now.getMinutes() + expiryDuration);
    } else if (expiryUnit === 'hours') {
      expiryTime.setHours(now.getHours() + expiryDuration);
    } else {
      return NextResponse.json(
        { error: 'Invalid expiry unit. Must be "minutes" or "hours"' },
        { status: 400 }
      );
    }

    // Create new signal record
    const signal = new Signal({
      creatorId,
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      leverageMultiplier,
      limitPricePercentage: body.limitPricePercentage,
      triggerPricePercentage: body.triggerPricePercentage,
      oraclePriceOffsetPercentage: body.oraclePriceOffsetPercentage,
      takeProfitPercentage: body.takeProfitPercentage,
      stopLossPercentage: body.stopLossPercentage,
      postOnly: body.postOnly || false,
      expiryTime,
      expiryDuration,
      expiryUnit,
      createdAt: new Date(),
      isActive: true,
    });

    await signal.save();

    return NextResponse.json(
      { 
        success: true, 
        signalId: signal._id,
        expiryTime: signal.expiryTime,
        message: 'Signal created successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating signal:', error);
    return NextResponse.json(
      { error: 'Failed to create signal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const experienceId = searchParams.get('experienceId');
    const creatorId = searchParams.get('creatorId');
    const includeExpired = searchParams.get('includeExpired') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    // Build query
    const query: {
      experienceId?: string;
      creatorId?: string;
      isActive?: boolean;
      expiryTime?: { $gt: Date };
    } = {};
    
    if (experienceId) query.experienceId = experienceId;
    if (creatorId) query.creatorId = creatorId;
    
    // Only show active signals that haven't expired unless includeExpired is true
    if (!includeExpired) {
      query.isActive = true;
      query.expiryTime = { $gt: new Date() };
    }

    // Fetch signals
    const signals = await Signal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await Signal.countDocuments(query);

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
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { signalId, isActive } = body;

    if (!signalId) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    const signal = await Signal.findByIdAndUpdate(
      signalId,
      { isActive },
      { new: true }
    );

    if (!signal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        signal,
        message: 'Signal updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating signal:', error);
    return NextResponse.json(
      { error: 'Failed to update signal', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const signal = await Signal.findByIdAndDelete(signalId);

    if (!signal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Signal deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting signal:', error);
    return NextResponse.json(
      { error: 'Failed to delete signal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

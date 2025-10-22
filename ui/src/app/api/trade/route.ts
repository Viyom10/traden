import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Trade from '@/schemas/TradeSchema';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    
    // Validate required fields
    const {
      userId,
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      sizeType,
      size,
      subAccountId,
    } = body;

    if (!userId || !experienceId || marketIndex === undefined || !marketSymbol || 
        !orderType || !direction || !sizeType || !size || subAccountId === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new trade record
    const trade = new Trade({
      userId,
      experienceId,
      marketIndex,
      marketSymbol,
      orderType,
      direction,
      sizeType,
      size,
      limitPrice: body.limitPrice,
      triggerPrice: body.triggerPrice,
      oraclePriceOffset: body.oraclePriceOffset,
      takeProfitPrice: body.takeProfitPrice,
      stopLossPrice: body.stopLossPrice,
      reduceOnly: body.reduceOnly || false,
      postOnly: body.postOnly || false,
      useSwift: body.useSwift || false,
      subAccountId,
      txSignature: body.txSignature,
      timestamp: new Date(),
    });

    await trade.save();

    return NextResponse.json(
      { 
        success: true, 
        tradeId: trade._id,
        message: 'Trade recorded successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording trade:', error);
    return NextResponse.json(
      { error: 'Failed to record trade', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const experienceId = searchParams.get('experienceId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    // Build query
    const query: { userId?: string; experienceId?: string } = {};
    if (userId) query.userId = userId;
    if (experienceId) query.experienceId = experienceId;

    // Fetch trades
    const trades = await Trade.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await Trade.countDocuments(query);

    return NextResponse.json(
      {
        success: true,
        trades,
        totalCount,
        limit,
        skip,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

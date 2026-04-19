import { NextResponse } from 'next/server';
import dbConnect, { isMongoConfigured } from '@/lib/db';
import Fee from '@/schemas/FeeSchema';

const emptyStats = () => ({
  totalInLamports: '0',
  totalInSol: 0,
  platformShareInLamports: '0',
  platformShareInSol: 0,
  transactionCount: 0,
});

export async function GET() {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json(
        {
          success: true,
          mongoConfigured: false,
          total: emptyStats(),
          today: emptyStats(),
          week: emptyStats(),
          month: emptyStats(),
        },
        { status: 200 }
      );
    }
    await dbConnect();

    const now = new Date();
    
    // Calculate date ranges
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all fees
    const allFees = await Fee.find({}).lean();
    
    // Fetch fees for today
    const todayFees = await Fee.find({
      timestamp: { $gte: startOfToday }
    }).lean();
    
    // Fetch fees for this week
    const weekFees = await Fee.find({
      timestamp: { $gte: startOfWeek }
    }).lean();
    
    // Fetch fees for this month
    const monthFees = await Fee.find({
      timestamp: { $gte: startOfMonth }
    }).lean();

    // Calculate totals
    const calculateTotal = (fees: typeof allFees) => {
      const totalInLamports = fees.reduce((sum, fee) => {
        return sum + BigInt(fee.feeInLamports);
      }, BigInt(0));
      
      // Platform gets 50% of total fees
      const platformShareInLamports = totalInLamports / BigInt(2);
      const platformShareInSol = Number(platformShareInLamports) / 1_000_000_000;
      
      return {
        totalInLamports: totalInLamports.toString(),
        totalInSol: Number(totalInLamports) / 1_000_000_000,
        platformShareInLamports: platformShareInLamports.toString(),
        platformShareInSol,
        transactionCount: fees.length,
      };
    };

    const totalStats = calculateTotal(allFees);
    const todayStats = calculateTotal(todayFees);
    const weekStats = calculateTotal(weekFees);
    const monthStats = calculateTotal(monthFees);

    return NextResponse.json(
      {
        success: true,
        total: totalStats,
        today: todayStats,
        week: weekStats,
        month: monthStats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

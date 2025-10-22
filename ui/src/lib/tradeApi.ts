/**
 * Trade API utilities for fetching trade history
 */

export interface TradeRecord {
  _id: string;
  userId: string;
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string;
  sizeType: string;
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
  timestamp: string;
  txSignature?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FetchTradesResponse {
  success: boolean;
  trades: TradeRecord[];
  totalCount: number;
  limit: number;
  skip: number;
}

export interface FetchTradesParams {
  userId?: string;
  experienceId?: string;
  limit?: number;
  skip?: number;
}

/**
 * Fetch trades from the API
 */
export async function fetchTrades(params: FetchTradesParams = {}): Promise<FetchTradesResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.userId) searchParams.append('userId', params.userId);
  if (params.experienceId) searchParams.append('experienceId', params.experienceId);
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.skip) searchParams.append('skip', params.skip.toString());

  const response = await fetch(`/api/trade?${searchParams.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trades: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch trades for a specific user
 */
export async function fetchUserTrades(userId: string, limit = 100): Promise<TradeRecord[]> {
  const response = await fetchTrades({ userId, limit });
  return response.trades;
}

/**
 * Fetch trades for a specific experience
 */
export async function fetchExperienceTrades(experienceId: string, limit = 100): Promise<TradeRecord[]> {
  const response = await fetchTrades({ experienceId, limit });
  return response.trades;
}

/**
 * Fetch trades for a specific user and experience
 */
export async function fetchUserExperienceTrades(
  userId: string,
  experienceId: string,
  limit = 100
): Promise<TradeRecord[]> {
  const response = await fetchTrades({ userId, experienceId, limit });
  return response.trades;
}

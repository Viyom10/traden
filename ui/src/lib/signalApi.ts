/**
 * Trade Signal API utilities for creating and fetching trade signals
 */

export interface TradeSignalRecord {
  _id: string;
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string;
  leverageMultiplier: number;
  limitPrice?: string;
  triggerPrice?: string;
  oraclePriceOffset?: string;
  takeProfitPercentage?: number;
  stopLossPercentage?: number;
  reduceOnly: boolean;
  postOnly: boolean;
  expiryDuration: number;
  expiryUnit: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignalParams {
  experienceId: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string;
  leverageMultiplier: number;
  limitPrice?: string;
  triggerPrice?: string;
  oraclePriceOffset?: string;
  takeProfitPercentage?: number;
  stopLossPercentage?: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
  expiryDuration: number;
  expiryUnit: string;
}

export interface FetchSignalsResponse {
  success: boolean;
  signals: TradeSignalRecord[];
  totalCount: number;
  limit: number;
  skip: number;
}

export interface FetchSignalsParams {
  experienceId?: string;
  includeExpired?: boolean;
  limit?: number;
  skip?: number;
}

export interface CreateSignalResponse {
  success: boolean;
  signalId: string;
  expiresAt: string;
  message: string;
}

export interface CancelSignalResponse {
  success: boolean;
  message: string;
}

/**
 * Create a new trade signal
 */
export async function createSignal(params: CreateSignalParams): Promise<CreateSignalResponse> {
  const response = await fetch('/api/signal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create trade signal');
  }

  return response.json();
}

/**
 * Fetch trade signals
 */
export async function fetchSignals(params: FetchSignalsParams = {}): Promise<FetchSignalsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.experienceId) searchParams.append('experienceId', params.experienceId);
  if (params.includeExpired) searchParams.append('includeExpired', 'true');
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.skip) searchParams.append('skip', params.skip.toString());

  const response = await fetch(`/api/signal?${searchParams.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch trade signals');
  }

  return response.json();
}

/**
 * Fetch signals for a specific experience
 */
export async function fetchExperienceSignals(experienceId: string, includeExpired = false): Promise<TradeSignalRecord[]> {
  const response = await fetchSignals({ experienceId, includeExpired });
  return response.signals;
}

/**
 * Cancel a trade signal
 */
export async function cancelSignal(signalId: string): Promise<CancelSignalResponse> {
  const response = await fetch(`/api/signal?signalId=${signalId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel trade signal');
  }

  return response.json();
}

/**
 * Check if a signal is expired
 */
export function isSignalExpired(signal: TradeSignalRecord): boolean {
  return new Date(signal.expiresAt) < new Date();
}

/**
 * Get time remaining for a signal
 */
export function getTimeRemaining(expiresAt: string): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Date.parse(expiresAt) - Date.now();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return {
    total,
    days,
    hours,
    minutes,
    seconds,
  };
}

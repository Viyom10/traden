"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDriftStore } from "@/stores/DriftStore";
import { MarketId } from "@drift-labs/common";
import { MarketType } from "@drift-labs/sdk";

interface RawOrderbookLevel {
  price: string;
  size: string;
  sources?: Record<string, { size: string }>;
}

export interface DlobOrderbookData {
  bids: RawOrderbookLevel[];
  asks: RawOrderbookLevel[];
  slot?: number;
  marketName?: string;
  marketType?: string;
  marketIndex?: number;
  oracle?: string;
}

interface MarketIdWithProperties {
  index: number;
  type: MarketType;
  key: string;
}

const getWebSocketUrl = (env: string) => {
  return env === 'mainnet-beta' 
    ? 'wss://dlob.drift.trade/ws'
    : 'wss://master.dlob.drift.trade/ws';
};

export const useOrderbookWebSocket = (selectedMarketId: MarketId | null) => {
  const drift = useDriftStore((s) => s.drift);
  const environment = useDriftStore((s) => s.environment);
  const [orderbookData, setOrderbookData] = useState<DlobOrderbookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const getMarketName = useCallback((marketId: MarketId) => {
    if (!drift?.driftClient) return null;
    
    try {
      const marketIdWithProps = marketId as unknown as MarketIdWithProperties;
      const marketIndex = marketIdWithProps.index ?? 0;
      const marketType = marketIdWithProps.type ?? MarketType.PERP;
      
      if (marketType === MarketType.PERP) {
        const perpMarket = drift.driftClient.getPerpMarketAccount(marketIndex);
        if (!perpMarket) return null;
        
        const marketName = Buffer.from(perpMarket.name).toString('utf-8').trim().replace(/\0/g, '');
        return marketName;
      } else {
        const spotMarket = drift.driftClient.getSpotMarketAccount(marketIndex);
        if (!spotMarket) return null;
        
        const marketName = Buffer.from(spotMarket.name).toString('utf-8').trim().replace(/\0/g, '');
        return marketName;
      }
    } catch (error) {
      console.error('Error getting market name:', error);
      return null;
    }
  }, [drift?.driftClient]);

  useEffect(() => {
    if (!drift?.driftClient || !selectedMarketId) return;

    const marketName = getMarketName(selectedMarketId);
    if (!marketName) {
      console.error('Could not determine market name');
      return;
    }

    setIsLoading(true);
    setOrderbookData(null);

    const wsUrl = getWebSocketUrl(environment);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const marketIdWithProps = selectedMarketId as unknown as MarketIdWithProperties;
    const marketType = marketIdWithProps.type ?? MarketType.PERP;
    const marketTypeStr = marketType === MarketType.PERP ? 'perp' : 'spot';

    ws.onopen = () => {
      console.log('WebSocket connected to', wsUrl);
      
      const subscribeMessage = {
        type: 'subscribe',
        marketType: marketTypeStr,
        channel: 'orderbook',
        market: marketName,
      };
      
      console.log('Subscribing to orderbook:', subscribeMessage);
      ws.send(JSON.stringify(subscribeMessage));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.channel === 'heartbeat') {
          return;
        }
        
        if (message.channel && message.data) {
          const parsedData = typeof message.data === 'string' 
            ? JSON.parse(message.data) 
            : message.data;
          
          setOrderbookData(parsedData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsLoading(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      
      if (ws.readyState === WebSocket.OPEN) {
        const unsubscribeMessage = {
          type: 'unsubscribe',
          marketType: marketTypeStr,
          channel: 'orderbook',
          market: marketName,
        };
        ws.send(JSON.stringify(unsubscribeMessage));
      }
      
      ws.close();
      wsRef.current = null;
    };
  }, [drift?.driftClient, selectedMarketId, environment, getMarketName]);

  return { orderbookData, isLoading };
};

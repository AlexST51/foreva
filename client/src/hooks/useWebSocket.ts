import { useRef, useCallback, useEffect } from 'react';
import { ClientWsMessage, ServerWsMessage } from '../types';
import { getWsUrl } from '../utils/api';

type MessageHandler = (msg: ServerWsMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    // Send a ping every 25 seconds to keep the connection alive
    // (Render/Cloudflare typically timeout idle connections at 60-100s)
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }, [stopPing]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      startPing();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerWsMessage;
        // Ignore pong responses
        if ((msg as any).type === 'pong') return;
        for (const handler of handlersRef.current) {
          handler(msg);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      stopPing();
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [startPing, stopPing]);

  const disconnect = useCallback(() => {
    stopPing();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopPing]);

  const send = useCallback((msg: ClientWsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }, []);

  const addMessageHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, send, addMessageHandler, wsRef };
}

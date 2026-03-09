import { useRef, useCallback } from 'react';
import type { SignalingMessage } from '@/types';

interface UseSignalingOptions {
  onMessage: (msg: SignalingMessage) => void;
  onLog: (source: 'ws', direction: 'send' | 'recv', message: string) => void;
}

export function useSignaling({ onMessage, onLog }: UseSignalingOptions) {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((serverUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        onLog('ws', 'recv', 'connected to signaling server');
        resolve();
      };

      ws.onerror = () => {
        onLog('ws', 'recv', 'connection error');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onmessage = (event) => {
        let msg: SignalingMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          onLog('ws', 'recv', 'invalid JSON received');
          return;
        }
        onLog('ws', 'recv', `${msg.type}${msg.role ? ` (role: ${msg.role})` : ''}`);
        onMessage(msg);
      };

      ws.onclose = () => {
        onLog('ws', 'recv', 'disconnected');
      };
    });
  }, [onMessage, onLog]);

  const send = useCallback((msg: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      onLog('ws', 'send', `${msg.type}`);
    }
  }, [onLog]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connect, send, disconnect };
}

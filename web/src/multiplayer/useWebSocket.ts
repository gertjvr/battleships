import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: 'state' | 'action' | 'error' | 'pong';
  payload?: any;
  meta?: any;
  id?: string;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  player: 1 | 2 | null;
  sessionToken: string | null;
  error: string | null;
  isSpectator: boolean;
}

interface WebSocketHook {
  connectionState: ConnectionState;
  sendMessage: (message: any) => void;
  sendAction: (action: any) => void;
  lastMessage: WebSocketMessage | null;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8787';

export function useWebSocket(room: string, isSpectator: boolean = false): WebSocketHook {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    player: null,
    sessionToken: isSpectator ? null : localStorage.getItem(`kids-battleships:session:${room}`),
    error: null,
    isSpectator
  });
  
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const pendingActions = useRef(new Map<string, any>());

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState(prev => ({ ...prev, status: 'connecting', error: null }));
    
    const websocket = new WebSocket(`${WS_URL}/ws?room=${room}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      setConnectionState(prev => ({ ...prev, status: 'connected', error: null }));
      
      // Send join or spectate message
      if (isSpectator) {
        websocket.send(JSON.stringify({
          type: 'spectate',
          payload: { room }
        }));
      } else {
        const sessionToken = localStorage.getItem(`kids-battleships:session:${room}`);
        websocket.send(JSON.stringify({
          type: 'join',
          payload: { room, sessionToken }
        }));
      }
    };
    
    websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('🔧 Client received message:', message);
        setLastMessage(message);
        
        // Handle specific message types
        switch (message.type) {
          case 'state':
            console.log('🔧 Client handling state message:', message.meta);
            // Save session token on first connection (only for players, not spectators)
            if (!isSpectator && message.meta?.sessionToken && message.meta.sessionToken !== connectionState.sessionToken) {
              localStorage.setItem(`kids-battleships:session:${room}`, message.meta.sessionToken);
              setConnectionState(prev => ({
                ...prev,
                sessionToken: message.meta.sessionToken,
                player: message.meta.player
              }));
              console.log('🔧 Client updated connection state - player:', message.meta.player);
            }
            // For spectators, just update connection state
            if (isSpectator && message.meta?.spectator) {
              setConnectionState(prev => ({
                ...prev,
                player: null // Spectators don't have a player number
              }));
              console.log('🔧 Spectator connected successfully');
            }
            break;
            
          case 'action':
            // Handle action acknowledgments
            if (message.id && message.meta?.ack) {
              pendingActions.current.delete(message.id);
            }
            break;
            
          case 'error':
            setConnectionState(prev => ({
              ...prev,
              error: message.payload?.message || 'Unknown error'
            }));
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'disconnected', 
        error: 'Connection failed' 
      }));
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionState(prev => ({ ...prev, status: 'disconnected' }));
      
      // Auto-reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... Attempt ${reconnectAttempts.current}`);
          connect();
        }, delay);
      }
    };
    
    ws.current = websocket;
  }, [room]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  const sendAction = useCallback((action: any) => {
    const id = crypto.randomUUID();
    const message = {
      type: 'action',
      id,
      payload: action
    };
    
    // Store pending action for acknowledgment tracking
    pendingActions.current.set(id, action);
    sendMessage(message);
    
    // Remove from pending after timeout (action failed)
    setTimeout(() => {
      pendingActions.current.delete(id);
    }, 10000);
  }, [sendMessage]);

  // Connect on mount and room change
  useEffect(() => {
    if (room) {
      connect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect, room, isSpectator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return {
    connectionState,
    sendMessage,
    sendAction,
    lastMessage
  };
}
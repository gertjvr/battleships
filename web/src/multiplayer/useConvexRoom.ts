import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  player: 1 | 2 | null;
  sessionToken: string | null;
  error: string | null;
  isSpectator: boolean;
}

interface ConvexHook {
  connectionState: ConnectionState;
  sendAction: (action: any) => void;
  gameState: any | null;
}

export function useConvexRoom(room: string, isSpectator = false): ConvexHook {
  const initialToken = isSpectator ? null : (room ? localStorage.getItem(`kids-battleships:session:${room}`) : null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: room ? 'connecting' : 'disconnected',
    player: null,
    sessionToken: initialToken,
    error: null,
    isSpectator
  });

  // Always pass a valid args object to satisfy Convex validators
  // When no room is selected, query with an empty roomCode which returns null
  const roomDoc = useQuery(api.rooms.getRoom, { roomCode: room || '' });
  const joinRoom = useMutation(api.rooms.joinRoom);
  const applyAction = useMutation(api.rooms.applyAction);

  useEffect(() => {
    if (!room || isSpectator) {
      setConnectionState(prev => ({ ...prev, status: room ? 'connected' : 'disconnected' }));
      return;
    }
    let cancelled = false;
    // Ensure a stable session token across possible React StrictMode double-invocation
    // Generate one up front if missing so repeated calls use the same token.
    const storageKey = `kids-battleships:session:${room}`;
    const existing = connectionState.sessionToken || localStorage.getItem(storageKey);
    const tokenToUse = existing || crypto.randomUUID();
    if (!existing) {
      // Optimistically record the token so any concurrent attempt reuses it
      localStorage.setItem(storageKey, tokenToUse);
      setConnectionState(prev => ({ ...prev, sessionToken: tokenToUse }));
    }

    joinRoom({ roomCode: room, sessionToken: tokenToUse })
      .then(res => {
        if (cancelled) return;
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          player: res.player,
          sessionToken: res.sessionToken
        }));
        // Server may normalize/replace the token; persist the authoritative value
        localStorage.setItem(storageKey, res.sessionToken);
      })
      .catch(err => {
        if (cancelled) return;
        setConnectionState(prev => ({ ...prev, status: 'disconnected', error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [room, isSpectator]);

  const sendAction = useCallback(
    (payload: any) => {
      if (!room || !connectionState.sessionToken) return;
      const id = crypto.randomUUID();
      applyAction({ roomCode: room, sessionToken: connectionState.sessionToken, payload, id });
    },
    [applyAction, room, connectionState.sessionToken]
  );

  return { connectionState, sendAction, gameState: roomDoc ? roomDoc.state : null };
}

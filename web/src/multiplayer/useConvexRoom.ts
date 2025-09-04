import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

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

  const roomDoc = useQuery(room ? api.rooms.getRoom : undefined, room ? { roomCode: room } : 'skip');
  const joinRoom = useMutation(api.rooms.joinRoom);
  const applyAction = useMutation(api.rooms.applyAction);

  useEffect(() => {
    if (!room || isSpectator) {
      setConnectionState(prev => ({ ...prev, status: room ? 'connected' : 'disconnected' }));
      return;
    }
    let cancelled = false;
    joinRoom({ roomCode: room, sessionToken: connectionState.sessionToken || undefined })
      .then(res => {
        if (cancelled) return;
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          player: res.player,
          sessionToken: res.sessionToken
        }));
        localStorage.setItem(`kids-battleships:session:${room}`, res.sessionToken);
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

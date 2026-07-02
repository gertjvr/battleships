import React, { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import SpectatorView from '../views/SpectatorView';
import ConnectionStatus from '../components/ConnectionStatus';
import GameHeader from '../components/GameHeader';
import { Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { enableAudio, isAudioEnabled } from '../sound';
import { formatRoomCode, normalizeRoomCode } from '../utils/roomCode';

interface GameState {
  phase: 'BOTH_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';
  p1: { fleet: any[]; shots: Set<string> };
  p2: { fleet: any[]; shots: Set<string> };
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  p1Ready: boolean;
  p2Ready: boolean;
  orientation: string;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface SpectatorGameManagerProps {
  onBack: () => void;
  initialRoomCode?: string | null;
}

export default function SpectatorGameManager({ onBack, initialRoomCode = null }: SpectatorGameManagerProps) {
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode ? normalizeRoomCode(initialRoomCode) : '');
  const [inputRoomCode, setInputRoomCode] = useState<string>(initialRoomCode ? formatRoomCode(initialRoomCode) : '');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [roomEntryError, setRoomEntryError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());

  const { connectionState, lastMessage } = useWebSocket(roomCode, true);

  // Handle incoming WebSocket messages
  React.useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'state') {
      setRoomEntryError(null);
      const state = lastMessage.payload;
      if (state) {
        const deserializedState: GameState = {
          ...state,
          p1: {
            fleet: state.p1.fleet.map((ship: any) => ({
              ...ship,
              hits: new Set(ship.hits)
            })),
            shots: new Set(state.p1.shots)
          },
          p2: {
            fleet: state.p2.fleet.map((ship: any) => ({
              ...ship,
              hits: new Set(ship.hits)
            })),
            shots: new Set(state.p2.shots)
          }
        };
        setGameState(deserializedState);
        
        if (lastMessage.meta?.spectatorCount !== undefined) {
          setSpectatorCount(lastMessage.meta.spectatorCount);
        }
      }
    } else if (lastMessage.type === 'error') {
      if (lastMessage.payload?.code === 'ROOM_FULL' || lastMessage.payload?.code === 'ROOM_NOT_FOUND') {
        setRoomEntryError(lastMessage.payload.message || 'Could not watch that room.');
        setGameState(null);
        setSpectatorCount(0);
        setRoomCode('');
        window.location.hash = '/online?role=spectator';
      } else {
        alert(lastMessage.payload?.message || 'Connection error');
      }
    }
  }, [lastMessage]);

  const handleJoinSpectator = useCallback(() => {
    const normalized = normalizeRoomCode(inputRoomCode);
    if (normalized.length === 6) {
      setRoomEntryError(null);
      setRoomCode(normalized);
      const params = new URLSearchParams();
      params.set('room', normalized);
      params.set('role', 'spectator');
      window.location.hash = `/online?${params.toString()}`;
    }
  }, [inputRoomCode]);

  // Show room code input if not connected to a room
  if (!roomCode) {
    return (
      <div className="mx-auto w-full max-w-md p-4 sm:p-6">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Spectate Game</CardTitle>
            <CardDescription>Enter a room code to watch an ongoing game.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={onBack} className="w-full justify-start sm:w-auto">
              <Home />
              Menu
            </Button>
            {roomEntryError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
              >
                {roomEntryError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="spectator-room-code">Room code</Label>
              <Input
                id="spectator-room-code"
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(formatRoomCode(e.target.value))}
                placeholder="ABC-123"
                maxLength={7}
                pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
                autoComplete="off"
                className="h-11 font-mono text-base uppercase tracking-widest"
              />
            </div>
            <Button
              onClick={handleJoinSpectator}
              disabled={normalizeRoomCode(inputRoomCode).length !== 6}
              className="w-full"
            >
              Start Spectating
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spectatorTitle = `Spectating Game - ${formatRoomCode(roomCode)}`;

  // Show loading/connecting state
  if (!gameState || connectionState.status !== 'connected') {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
        <GameHeader
          title={spectatorTitle}
          onBack={onBack}
        />
        <ConnectionStatus
          status={connectionState.status}
          player={null}
          roomCode={roomCode}
          error={connectionState.error}
          playerNames={gameState?.names}
          isSpectator={true}
          spectatorCount={spectatorCount}
        />
        
        {connectionState.status === 'connected' && (
          <Card className="rounded-lg">
            <CardContent className="p-6 text-center">
              <p className="text-base font-medium">Loading game</p>
              <p className="mt-2 text-sm text-muted-foreground">Room {formatRoomCode(roomCode)}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <GameHeader
        title={spectatorTitle}
        onBack={onBack}
        audioReady={audioReady}
        onEnableAudio={async () => {
          const ok = await enableAudio();
          setAudioReady(ok || isAudioEnabled());
        }}
      />

      <ConnectionStatus
        status={connectionState.status}
        player={null}
        roomCode={roomCode}
        error={connectionState.error}
        playerNames={gameState?.names}
        isSpectator={true}
        spectatorCount={spectatorCount}
      />

      {/* Spectator view */}
      <SpectatorView
        p1Name={gameState.names[1]}
        p2Name={gameState.names[2]}
        p1Fleet={gameState.p1.fleet}
        p2Fleet={gameState.p2.fleet}
        p1Shots={gameState.p1.shots}
        p2Shots={gameState.p2.shots}
        currentTurn={gameState.phase === 'P1_TURN' ? 1 : 2}
        phase={gameState.phase}
        spectatorCount={spectatorCount}
        chat={gameState.log.map((entry, index) => {
          let text = '';
          if (entry.message) {
            text = entry.message;
          } else if (entry.text) {
            text = entry.text;
          } else if (entry.target) {
            const coord = `${String.fromCharCode(65 + entry.target.c)}${entry.target.r + 1}`;
            const result = entry.hit ? 'Hit 💥' : 'Miss 💧';
            const sunk = entry.sunk ? ' (Sunk ship!)' : '';
            text = `${coord} - ${result}${sunk}`;
          } else {
            text = 'Unknown action';
          }
          
          return {
            who: entry.player === 1 ? 'me' : entry.player === 2 ? 'them' : 'system',
            text,
            key: `${entry.type}-${index}`
          };
        })}
      />
    </div>
  );
}

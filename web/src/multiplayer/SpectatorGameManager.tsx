import React, { useState, useCallback } from 'react';
import { useConvexRoom } from './useConvexRoom';
import SpectatorView from '../views/SpectatorView';
import ConnectionStatus from '../components/ConnectionStatus';
import HelpPopover from '../components/HelpPopover';
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
  p1Orientation: string;
  p2Orientation: string;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface SpectatorGameManagerProps {
  onBack: () => void;
  initialRoomCode?: string;
}

export default function SpectatorGameManager({ onBack, initialRoomCode }: SpectatorGameManagerProps) {
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '');
  const [inputRoomCode, setInputRoomCode] = useState<string>(initialRoomCode ? formatRoomCode(initialRoomCode) : '');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());

  const { connectionState, gameState: serverState } = useConvexRoom(roomCode, true);

  React.useEffect(() => {
    if (!serverState) return;
    const state = serverState;
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
  }, [serverState]);

  const handleJoinSpectator = useCallback(() => {
    const code = normalizeRoomCode(inputRoomCode);
    if (code.length === 6) {
      setRoomCode(code);
    }
  }, [inputRoomCode]);

  // Show room code input if not connected to a room
  if (!roomCode) {
    return (
      <div className="spectator-game max-w-md mx-auto mt-8">
        <h2 className="text-2xl font-bold text-center mb-4">Kids Battleships - Spectator Mode</h2>
        <div className="mb-6">
          <button 
            className="btn mb-4"
            onClick={onBack}
          >
            ← Back to Main Menu
          </button>
          
          <h1 className="text-2xl font-bold mb-2">Spectate Game</h1>
          <p className="text-slate-600 text-sm mb-6">
            Enter a room code to watch an ongoing game. You'll see both players' moves in real-time.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Room Code</label>
            <input
              type="text"
              value={inputRoomCode}
              onChange={(e) => {
                const norm = normalizeRoomCode(e.target.value);
                setInputRoomCode(formatRoomCode(norm));
              }}
              placeholder="Enter room code"
              maxLength={7}
              pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button 
            onClick={handleJoinSpectator}
            disabled={normalizeRoomCode(inputRoomCode).length !== 6}
            className="btn w-full"
          >
            Start Spectating
          </button>
        </div>
      </div>
    );
  }

  // Show loading/connecting state
  if (!gameState || connectionState.status !== 'connected') {
    return (
      <div className="spectator-game">
        <h2 className="text-2xl font-bold text-center mb-4">Kids Battleships - Spectator Mode</h2>
        <div className="flex items-center justify-between mb-4">
          <ConnectionStatus
            status={connectionState.status}
            player={null}
            roomCode={roomCode}
            error={connectionState.error}
            playerNames={gameState?.names}
            isSpectator={true}
            spectatorCount={spectatorCount}
          />
          <div className="flex gap-2">
            <button 
              className="btn" 
              onClick={onBack}
              title="Return to main menu"
            >
              Back to Main Menu
            </button>
          </div>
        </div>
        
        {connectionState.status === 'connected' && (
          <div className="text-center py-8">
            <p className="text-lg">Loading game...</p>
            <p className="text-sm text-slate-600 mt-2">Room: {formatRoomCode(roomCode)}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="spectator-game">
      <h2 className="text-2xl font-bold text-center mb-4">Kids Battleships - Spectator Mode</h2>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button 
            className="btn" 
            onClick={onBack}
            title="Return to main menu"
          >
            Back to Main Menu
          </button>
          <span className="text-sm text-slate-600">Room: {formatRoomCode(roomCode)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {!audioReady && (
            <button
              className="btn"
              onClick={async () => { 
                const ok = await enableAudio(); 
                setAudioReady(ok || isAudioEnabled()); 
              }}
              title="Enable sounds"
            >
              Enable Sound
            </button>
          )}
          <HelpPopover />
        </div>
      </div>

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
        chat={gameState.log
          .filter((entry) => entry.type !== 'place')
          .map((entry, index) => {
          let text = '';
          if (entry.type === 'playerReady') {
            text = 'Ready ✅';
          } else if (entry.message) {
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
      
      {/* Connection status */}
      <div className="fixed top-4 right-4">
        <ConnectionStatus
          status={connectionState.status}
          player={null}
          roomCode={roomCode}
          error={connectionState.error}
          playerNames={gameState?.names}
          isSpectator={true}
          spectatorCount={spectatorCount}
        />
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import RoomSetup from '../components/RoomSetup';
import ConnectionStatus from '../components/ConnectionStatus';
import PlacementView from '../views/PlacementView';
import PlayView from '../views/PlayView';
import SwapOverlay from '../components/SwapOverlay';
import Confetti from '../components/Confetti';
import SpectatorGameManager from './SpectatorGameManager';
import GameHeader from '../components/GameHeader';
import RoomCodePanel from '../components/RoomCodePanel';
import { Card, CardContent } from '../components/ui/card';
import type { Coord, Orientation, Player, ShipSize } from '@app/engine';
import { canPlace, coordsFor } from '@app/engine';
import { enableAudio, isAudioEnabled, playWin } from '../sound';
import { formatRoomCode, normalizeRoomCode } from '../utils/roomCode';

type Phase = 'BOTH_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';

interface GameState {
  phase: Phase;
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  p1Ready: boolean;
  p2Ready: boolean;
  orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface OnlineGameManagerProps {
  onBack: () => void;
  initialPlayerName: string;
  initialRoomCode?: string | null;
  initialRole?: 'player' | 'spectator' | null;
  initialPlayerHint?: 1 | 2 | null;
}

export default function OnlineGameManager({ onBack, initialPlayerName, initialRoomCode = null, initialRole = 'player', initialPlayerHint = null }: OnlineGameManagerProps) {
  if (initialRole === 'spectator') {
    return <SpectatorGameManager onBack={onBack} initialRoomCode={initialRoomCode} />;
  }

  const [roomCode, setRoomCode] = useState<string | null>(initialRoomCode ? normalizeRoomCode(initialRoomCode) : null);
  const [playerName, setPlayerName] = useState<string>(initialPlayerName);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<1 | 2 | null>(initialPlayerHint);
  const [showConfetti, setShowConfetti] = useState(false);
  const [overlay, setOverlay] = useState<{ shown: boolean; message: string; next?: Phase }>({ shown: false, message: '' });
  const [preview, setPreview] = useState<{ coords: Coord[]; valid: boolean } | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [hasEditedPlayerName, setHasEditedPlayerName] = useState(Boolean(initialPlayerName.trim()));
  const copyResetTimer = useRef<number | null>(null);
  const nameDebounceTimer = useRef<number | null>(null);

  const { connectionState, sendAction, lastMessage } = useWebSocket(roomCode || '', false);

  const handleCopyRoomCode = useCallback(async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(formatRoomCode(roomCode));
      setCopiedRoomCode(true);
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => {
        setCopiedRoomCode(false);
        copyResetTimer.current = null;
      }, 1500);
    } catch (error) {
      console.error('Failed to copy room code:', error);
    }
  }, [roomCode]);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      if (nameDebounceTimer.current) window.clearTimeout(nameDebounceTimer.current);
    };
  }, []);

  // Handle game over effects
  useEffect(() => {
    if (gameState?.phase === 'GAME_OVER' && gameState.winner) {
      const didIWin = gameState.winner === myPlayer;
      if (didIWin) {
        setShowConfetti(true);
        playWin();
      }
    }
  }, [gameState?.phase, gameState?.winner, myPlayer]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'state':
        console.log('🔧 OnlineGameManager received state message:', lastMessage);
        // Deserialize the game state
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
          console.log('🔧 Setting game state:', deserializedState);
          console.log('🔧 Setting player to:', lastMessage.meta?.player);
          setGameState(deserializedState);
          // Only update player if meta.player is provided (don't override with undefined)
          if (lastMessage.meta?.player !== undefined) {
            setMyPlayer(lastMessage.meta.player);
          }
        }
        break;

      case 'action':
        // Update local state based on server actions
        if (lastMessage.payload && gameState) {
          // The server has already validated and applied the action
          // We just need to update our local state to match
          // This would typically be handled by re-receiving the full state
          // For now, we rely on the state updates from the server
        }
        break;

      case 'error':
        console.error('WebSocket error:', lastMessage.payload);
        if (lastMessage.payload?.code === 'ROOM_FULL') {
          alert('Room is full. Please try a different room.');
          setRoomCode(null);
          window.location.hash = '/online';
        }
        break;
    }
  }, [lastMessage]);

  // Send player name once connected, with unique name for each player
  useEffect(() => {
    if (connectionState.status === 'connected' && myPlayer) {
      const finalName = playerName.trim() || `Player ${myPlayer}`;
      sendAction({
        type: 'setName',
        player: myPlayer,
        name: finalName
      });
    }
  }, [connectionState.status, myPlayer, sendAction]); // Removed playerName from dependencies to send only once

  useEffect(() => {
    if (connectionState.status !== 'connected' && nameDebounceTimer.current) {
      window.clearTimeout(nameDebounceTimer.current);
      nameDebounceTimer.current = null;
    }
  }, [connectionState.status]);

  const handlePlayerNameChange = useCallback((name: string) => {
    setPlayerName(name);
    setHasEditedPlayerName(true);

    if (!myPlayer || connectionState.status !== 'connected') {
      return;
    }

    if (nameDebounceTimer.current) {
      window.clearTimeout(nameDebounceTimer.current);
    }

    nameDebounceTimer.current = window.setTimeout(() => {
      sendAction({
        type: 'setName',
        player: myPlayer,
        name: name.trim() || `Player ${myPlayer}`
      });
      nameDebounceTimer.current = null;
    }, 450);
  }, [connectionState.status, myPlayer, sendAction]);

  // Handle room creation/joining
  const handleCreateRoom = useCallback((code: string) => {
    const normalized = normalizeRoomCode(code);
    setRoomCode(normalized);
    const params = new URLSearchParams();
    params.set('room', normalized);
    params.set('role', 'player');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  const handleJoinRoom = useCallback((code: string) => {
    const normalized = normalizeRoomCode(code);
    setRoomCode(normalized);
    const params = new URLSearchParams();
    params.set('room', normalized);
    params.set('role', 'player');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  const handleSpectate = useCallback((code: string) => {
    const normalized = normalizeRoomCode(code);
    const params = new URLSearchParams();
    params.set('room', normalized);
    params.set('role', 'spectator');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const params = new URLSearchParams();
    params.set('room', roomCode);
    params.set('role', 'player');
    if (myPlayer) params.set('as', String(myPlayer));
    const nextHash = `/online?${params.toString()}`;
    if (window.location.hash.slice(1) !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [roomCode, myPlayer]);

  // Game action handlers
  const handlePlace = useCallback((c: Coord) => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    // Only allow placement during BOTH_PLACE phase and if not already ready
    if (gameState.phase !== 'BOTH_PLACE') return;
    
    const amIReady = myPlayer === 1 ? gameState.p1Ready : gameState.p2Ready;
    if (amIReady) return; // Already ready, no more placing

    const currentPlayer = myPlayer === 1 ? gameState.p1 : gameState.p2;
    const placeIndex = myPlayer === 1 ? gameState.p1PlaceIndex : gameState.p2PlaceIndex;
    const nextSize = [5, 4, 3, 3, 2, 2][placeIndex] as ShipSize;

    if (!nextSize) return;

    sendAction({
      type: 'place',
      player: myPlayer,
      start: c,
      size: nextSize,
      orientation: gameState.orientation
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleFire = useCallback((c: Coord) => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    const isMyTurn = (myPlayer === 1 && gameState.phase === 'P1_TURN') || 
                     (myPlayer === 2 && gameState.phase === 'P2_TURN');
    
    if (!isMyTurn) return;

    sendAction({
      type: 'fire',
      player: myPlayer,
      r: c.r,
      c: c.c
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleOrientationToggle = useCallback(() => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    // Only allow orientation toggle during BOTH_PLACE phase and if not already ready
    if (gameState.phase !== 'BOTH_PLACE') return;
    
    const amIReady = myPlayer === 1 ? gameState.p1Ready : gameState.p2Ready;
    if (amIReady) return; // Already ready, no more changes

    // Toggle orientation in shared game state
    const newOrientation = gameState.orientation === 'H' ? 'V' : 'H';
    sendAction({
      type: 'setOrientation',
      player: myPlayer,
      orientation: newOrientation
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleHover = useCallback((c: Coord | null) => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') {
      setPreview(null);
      return;
    }
    
    // Only show preview during BOTH_PLACE phase and if not ready
    if (gameState.phase !== 'BOTH_PLACE') {
      setPreview(null);
      return;
    }
    
    const amIReady = myPlayer === 1 ? gameState.p1Ready : gameState.p2Ready;
    if (amIReady || !c) {
      setPreview(null);
      return;
    }

    const currentPlayer = myPlayer === 1 ? gameState.p1 : gameState.p2;
    const placeIndex = myPlayer === 1 ? gameState.p1PlaceIndex : gameState.p2PlaceIndex;
    const nextSize = [5, 4, 3, 3, 2, 2][placeIndex] as ShipSize;

    if (!nextSize) {
      setPreview(null);
      return;
    }

    const coords = coordsFor(c, nextSize, gameState.orientation);
    const valid = canPlace(currentPlayer.fleet, c, nextSize, gameState.orientation);
    setPreview({ coords, valid });
  }, [myPlayer, gameState, connectionState.status]);

  const handleUndo = useCallback(() => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    // Only allow undo during BOTH_PLACE phase and if not ready
    if (gameState.phase !== 'BOTH_PLACE') return;
    
    const amIReady = myPlayer === 1 ? gameState.p1Ready : gameState.p2Ready;
    if (amIReady) return; // Already ready, no more changes

    const currentPlayer = myPlayer === 1 ? gameState.p1 : gameState.p2;
    if (currentPlayer.fleet.length === 0) return; // No ships to undo

    sendAction({
      type: 'undo',
      player: myPlayer
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleDonePlacement = useCallback(() => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    sendAction({
      type: 'donePlacement',
      player: myPlayer
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleReset = useCallback(() => {
    if (connectionState.status !== 'connected') {
      return; // Do nothing when disconnected - restart doesn't make sense
    }
    
    // TODO: Server needs to handle 'reset' action type
    sendAction({
      type: 'reset'
    });
  }, [connectionState.status, sendAction]);

  const handleOverlayClose = useCallback(() => {
    setOverlay({ shown: false, message: '' });
  }, []);

  // Show room setup if not connected to a room
  if (!roomCode) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <RoomSetup 
          onCreateRoom={handleCreateRoom} 
          onJoinRoom={handleJoinRoom}
          onSpectate={handleSpectate}
        />
      </div>
    );
  }

  const roomCodePanel = (
    <RoomCodePanel roomCode={roomCode} copied={copiedRoomCode} onCopy={handleCopyRoomCode} />
  );

  console.log('🔧 OnlineGameManager render - gameState:', gameState, 'myPlayer:', myPlayer, 'connectionStatus:', connectionState.status);

  // Show loading/connecting state
  if (!gameState || connectionState.status !== 'connected') {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
        <GameHeader
          title="Online Multiplayer"
          subtitle="Connect to your room, then place your ships."
          onBack={onBack}
        />
        {roomCodePanel}
        <ConnectionStatus
          status={connectionState.status}
          player={myPlayer}
          error={connectionState.error}
          p1Ready={gameState?.p1Ready}
          p2Ready={gameState?.p2Ready}
          playerNames={gameState?.names}
        />
        {connectionState.status === 'connected' && myPlayer === 1 && (
          <Card className="rounded-lg border-sky-200">
            <CardContent className="space-y-2 p-6 text-center">
              <p className="text-base font-medium">Waiting for another player to join</p>
              <p className="text-sm text-muted-foreground">
                Share room code <span className="font-mono font-semibold text-foreground">{formatRoomCode(roomCode)}</span>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Check if it's my turn for UI restrictions
  const isMyTurn = gameState.phase === 'BOTH_PLACE' ? 
    true : // Both players can act during BOTH_PLACE
    (myPlayer === 1 ? gameState.phase === 'P1_TURN' : gameState.phase === 'P2_TURN');

  const isPlacementPhase = gameState.phase === 'BOTH_PLACE';
  
  // Check if I'm ready during placement
  const amIReady = myPlayer === 1 ? gameState.p1Ready : gameState.p2Ready;
  const isOpponentReady = myPlayer === 1 ? gameState.p2Ready : gameState.p1Ready;
  const displayedPlayerName = hasEditedPlayerName ? playerName : gameState.names[myPlayer || 1];


  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <GameHeader
        title="Online Multiplayer"
        subtitle={myPlayer ? `You are Player ${myPlayer}` : undefined}
        onBack={onBack}
        audioReady={audioReady}
        onEnableAudio={async () => {
          const ok = await enableAudio();
          setAudioReady(ok || isAudioEnabled());
        }}
      />

      {roomCodePanel}

      <ConnectionStatus
        status={connectionState.status}
        player={myPlayer}
        error={connectionState.error}
        p1Ready={gameState?.p1Ready}
        p2Ready={gameState?.p2Ready}
        playerNames={gameState?.names}
      />

      {gameState.phase === 'GAME_OVER' && gameState.winner ? (
        /* Game Over Screen */
        <div className="text-center space-y-6">
          {gameState.winner === myPlayer ? (
            <div>
              <h2 className="text-4xl font-bold text-green-600 mb-2">🎉 You Win! 🎉</h2>
              <p className="text-lg text-green-700">Congratulations! You sunk all of your opponent's ships!</p>
            </div>
          ) : (
            <div>
              <h2 className="text-4xl font-bold text-red-600 mb-2">💀 You Lost 💀</h2>
              <p className="text-lg text-red-700">
                {gameState.names[gameState.winner] || `Player ${gameState.winner}`} sunk all your ships!
              </p>
            </div>
          )}
          <div className="text-muted-foreground">
            Use Menu to return to the main menu and play again.
          </div>
        </div>
      ) : isPlacementPhase ? (
        <div>
          {/* Ready Status Messages */}
          {amIReady && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              You are ready. {isOpponentReady ? 'Starting battle...' : 'Waiting for opponent to finish placing ships...'}
            </div>
          )}
          {!amIReady && isOpponentReady && (
            <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
              {gameState.names[myPlayer === 1 ? 2 : 1] || `Player ${myPlayer === 1 ? 2 : 1}`} is ready. Finish placing your ships to start the battle.
            </div>
          )}
          
          <PlacementView
            playerIndex={myPlayer || 1}
            playerName={displayedPlayerName}
            onNameChange={(name) => {
              if (myPlayer && !amIReady) { // Only allow name change if not ready
                handlePlayerNameChange(name);
              }
            }}
            fleet={myPlayer === 1 ? gameState.p1.fleet : gameState.p2.fleet}
            nextSize={!amIReady ? (() => {
              const placeIndex = myPlayer === 1 ? gameState.p1PlaceIndex : gameState.p2PlaceIndex;
              return [5, 4, 3, 3, 2, 2][placeIndex] as ShipSize | undefined;
            })() : undefined}
            orientation={gameState.orientation}
            onRotate={handleOrientationToggle}
            onPlace={handlePlace}
            onHover={handleHover}
            onUndo={handleUndo}
            onDone={handleDonePlacement}
            previewCoords={preview?.coords}
            previewValid={preview?.valid}
          />
        </div>
      ) : (
        <PlayView
          currentPlayer={myPlayer || 1}
          currentPlayerName={gameState.names[myPlayer || 1]}
          meLabel={gameState.names[myPlayer || 1]?.charAt(0)?.toUpperCase() || `P${myPlayer || 1}`}
          themLabel={gameState.names[myPlayer === 1 ? 2 : 1]?.charAt(0)?.toUpperCase() || `P${myPlayer === 1 ? 2 : 1}`}
          opponentFleet={myPlayer === 1 ? gameState.p2.fleet : gameState.p1.fleet}
          attackerShots={myPlayer === 1 ? gameState.p1.shots : gameState.p2.shots}
          onFire={(r, c) => handleFire({ r, c })}
          ownFleet={myPlayer === 1 ? gameState.p1.fleet : gameState.p2.fleet}
          opponentShots={myPlayer === 1 ? gameState.p2.shots : gameState.p1.shots}
          disabled={!isMyTurn || connectionState.status !== 'connected'}
          banner={isMyTurn ? "Take your shot! 🎯" : `Waiting for ${gameState.names[gameState.phase === 'P1_TURN' ? 1 : 2] || `Player ${gameState.phase === 'P1_TURN' ? 1 : 2}`}...`}
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
              who: entry.player === myPlayer ? 'me' : entry.player ? 'them' : 'system',
              text,
              key: `${entry.type}-${index}`
            };
          })}
        />
      )}

      {overlay.shown && (
        <SwapOverlay
          shown={overlay.shown}
          message={overlay.message}
          onReady={handleOverlayClose}
        />
      )}

      {showConfetti && <Confetti />}
    </div>
  );
}

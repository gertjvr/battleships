import React, { useState, useEffect, useCallback } from 'react';
import { useConvexRoom } from './useConvexRoom';
import RoomSetup from '../components/RoomSetup';
import ConnectionStatus from '../components/ConnectionStatus';
import PlacementView from '../views/PlacementView';
import PlayView from '../views/PlayView';
import SwapOverlay from '../components/SwapOverlay';
import Confetti from '../components/Confetti';
import HelpPopover from '../components/HelpPopover';
import SpectatorGameManager from './SpectatorGameManager';
import type { Coord, Orientation, Player, ShipSize } from '@app/engine';
import { canPlace, coordsFor } from '@app/engine';
import { enableAudio, isAudioEnabled, playWin } from '../sound';
import { normalizeRoomCode } from '../utils/roomCode';

type Phase = 'BOTH_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';

interface GameState {
  phase: Phase;
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  p1Ready: boolean;
  p2Ready: boolean;
  p1Orientation: Orientation;
  p2Orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface OnlineGameManagerProps {
  onBack: () => void;
  initialPlayerName: string;
  initialRoomCode?: string | null;
  initialRole?: 'player' | 'spectator';
  initialPlayerHint?: 1 | 2 | null;
}

export default function OnlineGameManager({ onBack, initialPlayerName, initialRoomCode = null, initialRole = 'player', initialPlayerHint = null }: OnlineGameManagerProps) {
  const [roomCode, setRoomCode] = useState<string | null>(initialRoomCode ? normalizeRoomCode(initialRoomCode) : null);
  const [playerName, setPlayerName] = useState<string>(initialPlayerName);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<1 | 2 | null>(initialPlayerHint);
  const [showConfetti, setShowConfetti] = useState(false);
  const [overlay, setOverlay] = useState<{ shown: boolean; message: string; next?: Phase }>({ shown: false, message: '' });
  const [preview, setPreview] = useState<{ coords: Coord[]; valid: boolean } | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());
  const [isSpectating, setIsSpectating] = useState(initialRole === 'spectator');

  const { connectionState, sendAction, gameState: serverState } = useConvexRoom(roomCode || '', isSpectating);

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

  // Sync state from Convex
  useEffect(() => {
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
    if (!isSpectating && connectionState.player !== null) {
      setMyPlayer(connectionState.player);
    }
  }, [serverState, connectionState.player, isSpectating]);

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

  // Handle room creation/joining
  const handleCreateRoom = useCallback((code: string) => {
    setRoomCode(code);
    const params = new URLSearchParams();
    params.set('room', code);
    params.set('role', 'player');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  const handleJoinRoom = useCallback((code: string) => {
    setRoomCode(code);
    const params = new URLSearchParams();
    params.set('room', code);
    params.set('role', 'player');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  const handleSpectate = useCallback((code: string) => {
    setIsSpectating(true);
    setRoomCode(code);
    const params = new URLSearchParams();
    params.set('room', code);
    params.set('role', 'spectator');
    window.location.hash = `/online?${params.toString()}`;
  }, []);

  // Keep URL in sync with role, room, and assigned player
  useEffect(() => {
    if (!roomCode) return;
    const params = new URLSearchParams();
    params.set('room', roomCode);
    params.set('role', isSpectating ? 'spectator' : 'player');
    if (!isSpectating && myPlayer) params.set('as', String(myPlayer));
    const newHash = `/online?${params.toString()}`;
    if (window.location.hash.slice(1) !== newHash) {
      window.location.hash = newHash;
    }
  }, [roomCode, isSpectating, myPlayer]);


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
      orientation: myPlayer === 1 ? gameState.p1Orientation : gameState.p2Orientation
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

    // Toggle orientation for this player only
    const currentOrientation = myPlayer === 1 ? gameState.p1Orientation : gameState.p2Orientation;
    const newOrientation = currentOrientation === 'H' ? 'V' : 'H';
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

    const currentOrientation = myPlayer === 1 ? gameState.p1Orientation : gameState.p2Orientation;
    const coords = coordsFor(c, nextSize, currentOrientation);
    const valid = canPlace(currentPlayer.fleet, c, nextSize, currentOrientation);
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
    if (connectionState.status !== 'connected' || !myPlayer) {
      return; // Only allow when connected and player is known
    }

    sendAction({
      type: 'reset',
      player: myPlayer
    });
  }, [connectionState.status, myPlayer, sendAction]);

  const handleOverlayClose = useCallback(() => {
    setOverlay({ shown: false, message: '' });
  }, []);

  // Show spectator view if spectating
  if (isSpectating && roomCode) {
    return (
      <SpectatorGameManager 
        initialRoomCode={roomCode}
        onBack={() => { setIsSpectating(false); setRoomCode(null); onBack(); }} 
      />
    );
  }

  // Show room setup if not connected to a room
  if (!roomCode) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center">Kids Battleships - Online Multiplayer</h2>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="btn" onClick={onBack}>Main Menu</button>
            <button className="btn" onClick={() => setRoomCode(null)}>Restart</button>
          </div>
          <div className="flex items-center gap-2">
            {!audioReady && (
              <button
                className="btn"
                onClick={async () => { const ok = await enableAudio(); setAudioReady(ok || isAudioEnabled()); }}
                title="Enable sounds"
              >
                Enable Sound
              </button>
            )}
            <HelpPopover />
          </div>
        </header>
        <RoomSetup 
          onCreateRoom={handleCreateRoom} 
          onJoinRoom={handleJoinRoom}
          onSpectate={handleSpectate}
        />
      </div>
    );
  }

  console.log('🔧 OnlineGameManager render - gameState:', gameState, 'myPlayer:', myPlayer, 'connectionStatus:', connectionState.status);

  // Show loading/connecting state
  if (!gameState || connectionState.status !== 'connected') {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center">Kids Battleships - Online Multiplayer</h2>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="btn" onClick={onBack}>Main Menu</button>
            {connectionState.status === 'connected' && (
              <button className="btn" onClick={handleReset}>Restart</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!audioReady && (
              <button
                className="btn"
                onClick={async () => { const ok = await enableAudio(); setAudioReady(ok || isAudioEnabled()); }}
                title="Enable sounds"
              >
                Enable Sound
              </button>
            )}
            <HelpPopover />
          </div>
        </header>
        <ConnectionStatus 
          status={connectionState.status}
          player={myPlayer}
          roomCode={roomCode}
          error={connectionState.error}
          p1Ready={gameState?.p1Ready}
          p2Ready={gameState?.p2Ready}
          playerNames={gameState?.names}
        />
        {connectionState.status === 'connected' && myPlayer === 1 && (
          <div className="text-center space-y-2">
            <p>Waiting for another player to join...</p>
            <p>Share room code: <strong>{roomCode}</strong></p>
          </div>
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


  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-center">Kids Battleships - Online Multiplayer</h2>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn" onClick={onBack}>Main Menu</button>
          <button className="btn" onClick={handleReset}>Restart</button>
        </div>
        <div className="flex items-center gap-2">
          {!audioReady && (
            <button
              className="btn"
              onClick={async () => { const ok = await enableAudio(); setAudioReady(ok || isAudioEnabled()); }}
              title="Enable sounds"
            >
              Enable Sound
            </button>
          )}
          <HelpPopover />
        </div>
      </header>

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
              <h2 className="text-4xl font-bold text-red-600 mb-2">😔 You Lost 😔</h2>
              <p className="text-lg text-red-700">
                {gameState.names[gameState.winner] || `Player ${gameState.winner}`} sunk all your ships!
              </p>
            </div>
          )}
          <div className="text-slate-600">
            Use "Back to Offline" to return to the main menu and play again.
          </div>
        </div>
      ) : isPlacementPhase ? (
        <div>
          {/* Ready Status Messages */}
          {amIReady && (
            <div className="bg-green-100 text-green-900 rounded-md px-4 py-3 mb-4">
              ✅ You are ready! {isOpponentReady ? 'Starting battle...' : 'Waiting for opponent to finish placing ships...'}
            </div>
          )}
          {!amIReady && isOpponentReady && (
            <div className="bg-blue-100 text-blue-900 rounded-md px-4 py-3 mb-4">
              🎯 {gameState.names[myPlayer === 1 ? 2 : 1] || `Player ${myPlayer === 1 ? 2 : 1}`} is ready! Finish placing your ships to start the battle.
            </div>
          )}
          
          <PlacementView
            playerIndex={myPlayer || 1}
            playerName={gameState.names[myPlayer || 1]}
            onNameChange={(name) => {
              if (myPlayer && !amIReady) { // Only allow name change if not ready
                sendAction({
                  type: 'setName',
                  player: myPlayer,
                  name: name
                });
              }
            }}
            fleet={myPlayer === 1 ? gameState.p1.fleet : gameState.p2.fleet}
            nextSize={!amIReady ? (() => {
              const placeIndex = myPlayer === 1 ? gameState.p1PlaceIndex : gameState.p2PlaceIndex;
              return [5, 4, 3, 3, 2, 2][placeIndex] as ShipSize | undefined;
            })() : undefined}
            orientation={myPlayer === 1 ? gameState.p1Orientation : gameState.p2Orientation}
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
              who: entry.type === 'playerReady' ? (entry.player === myPlayer ? 'me' : 'them') : (entry.player === myPlayer ? 'me' : entry.player ? 'them' : 'system'),
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
      
      {/* Connection status */}
      <div className="fixed top-4 right-4">
        <ConnectionStatus
          status={connectionState.status}
          player={myPlayer}
          roomCode={roomCode || ''}
          error={connectionState.error}
          p1Ready={gameState?.p1Ready}
          p2Ready={gameState?.p2Ready}
          playerNames={gameState?.names}
        />
      </div>
    </div>
  );
}

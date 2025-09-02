import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { enableMockWebSocket } from './mockWebSocketServer';
import RoomSetup from '../components/RoomSetup';
import ConnectionStatus from '../components/ConnectionStatus';
import PlacementView from '../views/PlacementView';
import PlayView from '../views/PlayView';
import SwapOverlay from '../components/SwapOverlay';
import Confetti from '../components/Confetti';
import type { Coord, Orientation, Player, ShipSize } from '@app/engine';

// Enable mock WebSocket for local development
if (import.meta.env.VITE_MOCK_WS === 'true') {
  enableMockWebSocket();
}

type Phase = 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';

interface GameState {
  phase: Phase;
  p1: Player;
  p2: Player;
  p1PlaceIndex: number;
  p2PlaceIndex: number;
  orientation: Orientation;
  winner: 1 | 2 | null;
  names: { [key: number]: string };
  log: Array<{ type: string; player?: number; [key: string]: any }>;
}

interface OnlineGameManagerProps {
  onBack: () => void;
}

export default function OnlineGameManager({ onBack }: OnlineGameManagerProps) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<1 | 2 | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [overlay, setOverlay] = useState<{ shown: boolean; message: string; next?: Phase }>({ shown: false, message: '' });

  const { connectionState, sendAction, lastMessage } = useWebSocket(roomCode || '');

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'state':
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
          setGameState(deserializedState);
          setMyPlayer(lastMessage.meta?.player || null);
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
        }
        break;
    }
  }, [lastMessage, gameState]);

  // Handle room creation/joining
  const handleCreateRoom = useCallback((code: string) => {
    setRoomCode(code);
  }, []);

  const handleJoinRoom = useCallback((code: string) => {
    setRoomCode(code);
  }, []);

  // Game action handlers
  const handlePlace = useCallback((c: Coord) => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    const isMyTurn = (myPlayer === 1 && gameState.phase === 'P1_PLACE') || 
                     (myPlayer === 2 && gameState.phase === 'P2_PLACE');
    
    if (!isMyTurn) return;

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
    // For multiplayer, orientation is shared state, so we might not allow this
    // Or we could send an action to update orientation
    // For now, keeping it local since it's just UI feedback
  }, []);

  const handleUndo = useCallback(() => {
    // Undo might not be supported in multiplayer or would need server action
    console.log('Undo not supported in online mode');
  }, []);

  const handleDonePlacement = useCallback(() => {
    if (!myPlayer || !gameState || connectionState.status !== 'connected') return;
    
    sendAction({
      type: 'donePlacement',
      player: myPlayer
    });
  }, [myPlayer, gameState, connectionState.status, sendAction]);

  const handleReset = useCallback(() => {
    if (connectionState.status !== 'connected') return;
    
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
      <div className="online-game">
        <div className="header">
          <button onClick={onBack} className="back-button">← Back</button>
          <h2>Online Battleships</h2>
        </div>
        <RoomSetup onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      </div>
    );
  }

  // Show loading/connecting state
  if (!gameState || connectionState.status !== 'connected') {
    return (
      <div className="online-game">
        <div className="header">
          <button onClick={onBack} className="back-button">← Back</button>
          <h2>Online Battleships</h2>
        </div>
        <ConnectionStatus 
          status={connectionState.status}
          player={myPlayer}
          roomCode={roomCode}
          error={connectionState.error}
        />
        {connectionState.status === 'connected' && myPlayer === 1 && (
          <div className="waiting">
            <p>Waiting for another player to join...</p>
            <p>Share room code: <strong>{roomCode}</strong></p>
          </div>
        )}
      </div>
    );
  }

  // Check if it's my turn for UI restrictions
  const isMyTurn = myPlayer === 1 
    ? ['P1_PLACE', 'P1_TURN'].includes(gameState.phase)
    : ['P2_PLACE', 'P2_TURN'].includes(gameState.phase);

  const isPlacementPhase = ['P1_PLACE', 'P2_PLACE'].includes(gameState.phase);

  return (
    <div className="online-game">
      <div className="header">
        <button onClick={onBack} className="back-button">← Back</button>
        <h2>Online Battleships</h2>
        <ConnectionStatus 
          status={connectionState.status}
          player={myPlayer}
          roomCode={roomCode}
          error={connectionState.error}
        />
      </div>

      {isPlacementPhase ? (
        <PlacementView
          phase={gameState.phase}
          p1={gameState.p1}
          p2={gameState.p2}
          p1PlaceIndex={gameState.p1PlaceIndex}
          p2PlaceIndex={gameState.p2PlaceIndex}
          orientation={gameState.orientation}
          onPlace={handlePlace}
          onHover={() => {}} // Simplified for now
          onUndo={handleUndo}
          onOrientationToggle={handleOrientationToggle}
          onDonePlacement={handleDonePlacement}
          preview={null}
          disabled={!isMyTurn || connectionState.status !== 'connected'}
          mode="ONLINE"
          names={gameState.names}
          myPlayer={myPlayer}
        />
      ) : (
        <PlayView
          phase={gameState.phase}
          p1={gameState.p1}
          p2={gameState.p2}
          onFire={handleFire}
          onReset={handleReset}
          winner={gameState.winner}
          lastShotP1={null}
          lastShotP2={null}
          sunkOnP1={null}
          sunkOnP2={null}
          lastSunkOnP1={null}
          lastSunkOnP2={null}
          sinkingOnP1={null}
          sinkingOnP2={null}
          mode="ONLINE"
          names={gameState.names}
          log={[]} // Simplified for now
          myPlayer={myPlayer}
          disabled={!isMyTurn || connectionState.status !== 'connected'}
        />
      )}

      {overlay.shown && (
        <SwapOverlay
          message={overlay.message}
          onClose={handleOverlayClose}
        />
      )}

      {showConfetti && <Confetti />}
    </div>
  );
}
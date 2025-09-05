import React from 'react';
import Grid from '../components/Grid';
import ChatHistory, { ChatEntry } from '../components/ChatHistory';
import type { Ship } from '@app/engine';

type Props = {
  p1Name?: string;
  p2Name?: string;
  p1Fleet: Ship[];
  p2Fleet: Ship[];
  p1Shots: Set<string>;
  p2Shots: Set<string>;
  currentTurn: 1 | 2;
  phase: string;
  chat?: ChatEntry[];
  spectatorCount?: number;
  lastShotP1?: string | null;
  lastShotP2?: string | null;
  sunkOnP1?: Set<string> | null;
  sunkOnP2?: Set<string> | null;
  sinkingOnP1?: Set<string> | null;
  sinkingOnP2?: Set<string> | null;
};

export default function SpectatorView({
  p1Name,
  p2Name,
  p1Fleet,
  p2Fleet,
  p1Shots,
  p2Shots,
  currentTurn,
  phase,
  chat,
  spectatorCount,
  lastShotP1,
  lastShotP2,
  sunkOnP1,
  sunkOnP2,
  sinkingOnP1,
  sinkingOnP2,
}: Props) {
  const isGameOver = phase === 'GAME_OVER';
  const isPlacementPhase = phase === 'BOTH_PLACE';
  
  return (
    <div className="space-y-6">
      {/* Header with game status */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Spectating Game</h1>
        {spectatorCount !== undefined && (
          <p className="text-sm text-slate-600">
            👥 {spectatorCount} spectator{spectatorCount !== 1 ? 's' : ''} watching
          </p>
        )}
        {!isGameOver && !isPlacementPhase && (
          <div className="bg-blue-100 text-blue-900 rounded-md px-4 py-2">
            🎯 {currentTurn === 1 ? (p1Name || 'Player 1') : (p2Name || 'Player 2')}'s turn
          </div>
        )}
        {isPlacementPhase && (
          <div className="bg-amber-100 text-amber-900 rounded-md px-4 py-2">
            🚢 Players are placing their ships...
          </div>
        )}
      </div>

      {/* Dual grid layout - just the guesses */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Player 1's Guesses */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg text-center">
            {p1Name || 'Player 1'} Guesses
            {currentTurn === 1 && !isGameOver && !isPlacementPhase && (
              <span className="ml-2 text-blue-600">🎯</span>
            )}
          </h2>
          
          <div className="overflow-auto">
            <Grid
              mode="fire"
              opponentFleet={p2Fleet}
              shots={p1Shots}
              highlightKey={lastShotP1 ?? undefined}
              sunkKeys={sunkOnP2 ?? undefined}
              sinkingKeys={sinkingOnP2 ?? undefined}
              disabled={true}
              showShips={false} // Spectators only see revealed information
            />
          </div>
        </div>

        {/* Player 2's Guesses */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg text-center">
            {p2Name || 'Player 2'} Guesses
            {currentTurn === 2 && !isGameOver && !isPlacementPhase && (
              <span className="ml-2 text-blue-600">🎯</span>
            )}
          </h2>
          
          <div className="overflow-auto">
            <Grid
              mode="fire"
              opponentFleet={p1Fleet}
              shots={p2Shots}
              highlightKey={lastShotP2 ?? undefined}
              sunkKeys={sunkOnP1 ?? undefined}
              sinkingKeys={sinkingOnP1 ?? undefined}
              disabled={true}
              showShips={false} // Spectators only see revealed information
            />
          </div>
        </div>
      </div>

      {/* Legend and game log */}
      <div className="space-y-4">
        <div className="text-slate-600 text-sm text-center">
          Legend: 💥 Hit • 💧 Miss • 🚢 Sunk
        </div>

        {chat && chat.length > 0 && (
          <ChatHistory 
            entries={chat} 
            title="Game History" 
            meLabel={p1Name?.charAt(0)?.toUpperCase() || 'P1'} 
            themLabel={p2Name?.charAt(0)?.toUpperCase() || 'P2'} 
          />
        )}
      </div>
    </div>
  );
}

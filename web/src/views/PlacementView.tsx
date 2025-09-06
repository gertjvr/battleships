import React, { useEffect, useState } from 'react';
import Grid from '../components/Grid';
import type { Coord, Orientation, Ship, ShipSize } from '@app/engine';

type Props = {
  playerIndex: 1 | 2;
  playerName?: string;
  onNameChange?: (name: string) => void;
  fleet: Ship[];
  nextSize?: ShipSize;
  orientation: Orientation;
  onRotate: () => void;
  onPlace: (c: Coord) => void;
  onHover: (c: Coord | null) => void;
  onUndo: () => void;
  onDone: () => void;
  previewCoords?: Coord[];
  previewValid?: boolean;
};

export default function PlacementView({ playerIndex, playerName, onNameChange, fleet, nextSize, orientation, onRotate, onPlace, onHover, onUndo, onDone, previewCoords, previewValid }: Props) {
  const allPlaced = !nextSize;
  const [focusedCell, setFocusedCell] = useState<Coord>({ r: 4, c: 4 }); // Start in center

  // Add keyboard controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle keys when not typing in input field
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case ' ': // Space key for rotation
          e.preventDefault();
          onRotate();
          break;
        case 'Escape': // ESC key for undo/delete
          e.preventDefault();
          onUndo();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedCell(prev => ({ r: Math.max(0, prev.r - 1), c: prev.c }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedCell(prev => ({ r: Math.min(9, prev.r + 1), c: prev.c }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedCell(prev => ({ r: prev.r, c: Math.max(0, prev.c - 1) }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedCell(prev => ({ r: prev.r, c: Math.min(9, prev.c + 1) }));
          break;
        case 'Enter':
          e.preventDefault();
          onPlace(focusedCell);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRotate, onPlace, focusedCell]);

  // Update hover when focused cell changes
  useEffect(() => {
    onHover(focusedCell);
    return () => onHover(null);
  }, [focusedCell, onHover]);

  return (
    <div className="p-6 sm:p-8 space-y-4 max-w-7xl mx-auto">
      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border-2 border-white/30 text-center">
        <div className="text-4xl mb-2">⚓</div>
        <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
          {playerName ? `Captain ${playerName}` : `Captain ${playerIndex}`}: Deploy Your Fleet
        </h1>
        <p className="text-white/90 text-lg">
          Position your ships strategically on the battlefield! 🏴‍☠️
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30 space-y-4 lg:max-w-md">
          <div className="space-y-2">
            <input
              className="w-full border-2 border-amber-400 rounded-xl px-4 py-3 bg-white/95 backdrop-blur text-lg font-semibold focus:outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-200 text-center shadow-lg"
              placeholder="✏️ Enter your captain name..."
              value={playerName ?? ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              autoFocus
            />
            <p className="text-white/80 text-sm text-center">
              💡 Make it unique so you can tell who's winning!
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button className="btn" onClick={onRotate}>
              🔄 {orientation === 'H' ? 'Horizontal' : 'Vertical'}
            </button>
            <button className="btn" onClick={onUndo} disabled={fleet.length === 0}>
              ↶ Undo Last
            </button>
            <button className="btn" onClick={onDone} disabled={!allPlaced}>
              ✅ Ready for Battle!
            </button>
          </div>
          
          <div className="text-white text-xl font-bold text-center">
            {allPlaced ? '🎉 All ships deployed!' : `📏 Deploy ship of length ${nextSize}`}
          </div>
          <div className="text-white/80 text-sm bg-white/10 rounded-lg p-3 text-center">
            💡 Tip: Use Arrow keys to navigate, Space to rotate, Enter to place ships.
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 flex items-center justify-center">
          <Grid mode="place" fleet={fleet} showShips onCell={onPlace} onHover={onHover} previewCoords={previewCoords} previewValid={previewValid} />
        </div>
      </div>
    </div>
  );
}

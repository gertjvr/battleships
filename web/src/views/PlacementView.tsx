import React from 'react';
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{playerName ? `${playerName}` : `Player ${playerIndex}`}: Place Your Ships</h1>
      <div className="flex items-center gap-3">
        <input
          className="border border-slate-300 rounded px-3 py-1"
          placeholder={`Player ${playerIndex}`}
          value={playerName ?? ''}
          onChange={(e) => onNameChange?.(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" onClick={onRotate}>Rotate: {orientation === 'H' ? 'Horizontal' : 'Vertical'}</button>
        <button className="btn" onClick={onUndo} disabled={fleet.length === 0}>Undo Last</button>
        <button className="btn" onClick={onDone} disabled={!allPlaced}>Done</button>
      </div>
      <div className="text-slate-700">{allPlaced ? 'All ships placed!' : `Place ship of length ${nextSize}`}</div>
      <div className="text-slate-600 text-sm">Tip: Use Space to rotate, Enter to place, Tab to move.</div>
      <div className="overflow-auto">
        <Grid mode="place" fleet={fleet} showShips onCell={onPlace} onHover={onHover} previewCoords={previewCoords} previewValid={previewValid} />
      </div>
    </div>
  );
}

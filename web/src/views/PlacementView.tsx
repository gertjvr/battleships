import React from 'react';
import { Check, RotateCw, Undo2 } from 'lucide-react';
import Grid from '../components/Grid';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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

export default function PlacementView({
  playerIndex,
  playerName,
  onNameChange,
  fleet,
  nextSize,
  orientation,
  onRotate,
  onPlace,
  onHover,
  onUndo,
  onDone,
  previewCoords,
  previewValid,
}: Props) {
  const allPlaced = !nextSize;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {playerName ? `${playerName}` : `Player ${playerIndex}`}: Place Ships
          </h2>
          <Badge variant={allPlaced ? 'default' : 'outline'} className="px-3 py-1">
            {allPlaced ? 'All ships placed' : `Place length ${nextSize}`}
          </Badge>
        </div>
        <div className="w-full space-y-2 sm:w-64">
          <Label htmlFor={`player-${playerIndex}-name`}>Player name</Label>
          <Input
            id={`player-${playerIndex}-name`}
            placeholder={`Player ${playerIndex}`}
            value={playerName ?? ''}
            onChange={(e) => onNameChange?.(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:flex sm:flex-wrap">
        <Button variant="outline" onClick={onRotate} className="whitespace-nowrap">
          <RotateCw />
          {orientation === 'H' ? 'Horizontal' : 'Vertical'}
        </Button>
        <Button variant="outline" onClick={onUndo} disabled={fleet.length === 0} className="whitespace-nowrap">
          <Undo2 />
          Undo
        </Button>
        <Button onClick={onDone} disabled={!allPlaced} className="whitespace-nowrap">
          <Check />
          Done
        </Button>
      </div>

      <div className="overflow-auto">
        <Grid
          mode="place"
          fleet={fleet}
          showShips
          onCell={onPlace}
          onHover={onHover}
          previewCoords={previewCoords}
          previewValid={previewValid}
        />
      </div>
    </section>
  );
}

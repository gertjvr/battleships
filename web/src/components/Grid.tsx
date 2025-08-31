import React from 'react';
import type { Coord, Ship } from '@app/engine';

const letters = ['A','B','C','D','E','F','G','H','I','J'];

function keyOf(c: Coord) { return `${c.r},${c.c}`; }
function hasCoord(fleet: Ship[] | undefined, c: Coord) {
  if (!fleet) return false;
  const k = keyOf(c);
  return fleet.some(s => s.coords.some(x => keyOf(x) === k));
}
function shipAt(fleet: Ship[] | undefined, c: Coord): Ship | undefined {
  if (!fleet) return undefined;
  const k = keyOf(c);
  return fleet.find((s) => s.coords.some((x) => keyOf(x) === k));
}

type Mode = 'place' | 'fire' | 'display';

type Props = {
  mode: Mode;
  fleet?: Ship[]; // for place/display
  opponentFleet?: Ship[]; // for fire rendering hits
  shots?: Set<string>; // shots relevant to this grid
  showShips?: boolean;
  disabled?: boolean;
  onCell?: (c: Coord) => void;
  previewCoords?: Coord[];
  previewValid?: boolean;
  onHover?: (c: Coord | null) => void;
  highlightKey?: string;
  sunkKeys?: Set<string>;
  lastSunkKeys?: Set<string>;
  sinkingKeys?: Set<string>;
};

export default function Grid({ mode, fleet, opponentFleet, shots, showShips = false, disabled = false, onCell, previewCoords, previewValid, onHover, highlightKey, sunkKeys, lastSunkKeys, sinkingKeys }: Props) {
  const headerRow = [<th key="corner" />].concat(letters.map((L) => <th key={L} className="px-1 text-center text-sm text-slate-600">{L}</th>));

  const rows = [] as React.ReactNode[];
  for (let r = 0; r < 10; r++) {
    const cells = [] as React.ReactNode[];
    cells.push(<th key={`h-${r}`} className="px-1 text-center text-sm text-slate-600">{r + 1}</th>);
    for (let c = 0; c < 10; c++) {
      const coord: Coord = { r, c };
      const k = keyOf(coord);
      let content: React.ReactNode = null;
      let cls = 'grid-cell';

      if (mode === 'display') {
        const shipHere = hasCoord(fleet, coord);
        if (shipHere && showShips) {
          cls += ' bg-slate-300 grid-cell-ship ship-outline';
          const s = shipAt(fleet, coord);
          if (s && fleet) {
            const idx = fleet.findIndex((f) => f.id === s.id);
            cls += ` ship-p${((idx % 6) + 6) % 6}`;
            // Determine outer edges for inner outline
            const up: Coord = { r: r - 1, c };
            const right: Coord = { r, c: c + 1 };
            const down: Coord = { r: r + 1, c };
            const left: Coord = { r, c: c - 1 };
            const sameUp = r > 0 && shipAt(fleet, up)?.id === s.id;
            const sameRight = c < 9 && shipAt(fleet, right)?.id === s.id;
            const sameDown = r < 9 && shipAt(fleet, down)?.id === s.id;
            const sameLeft = c > 0 && shipAt(fleet, left)?.id === s.id;
            if (!sameUp) cls += ' edge-t';
            if (!sameRight) cls += ' edge-r';
            if (!sameDown) cls += ' edge-b';
            if (!sameLeft) cls += ' edge-l';
          }
        }
        if (shots?.has(k)) {
          if (shipHere) {
            cls += ' bg-rose-500 text-white animate-hit';
            content = '💥';
          } else {
            // Opponent guessed here but it's a miss
            cls += ' bg-sky-200 animate-miss';
            content = '💧';
          }
        }
        if (highlightKey && shots?.has(k) && highlightKey === k) {
          cls += ' grid-cell-last';
        }
        if (sunkKeys?.has(k)) cls += ' grid-cell-sunk';
        if (lastSunkKeys?.has(k)) cls += ' grid-cell-last-sunk';
        if (sinkingKeys?.has(k)) cls += ' animate-jiggle';
      } else if (mode === 'fire') {
        if (shots?.has(k)) {
          const hit = hasCoord(opponentFleet, coord);
          if (hit) { cls += ' bg-rose-400 text-white animate-hit'; content = '💥'; }
          else { cls += ' bg-sky-200 animate-miss'; content = '💧'; }
        }
        if (highlightKey && shots?.has(k) && highlightKey === k) {
          cls += ' grid-cell-last';
        }
        if (sunkKeys?.has(k)) cls += ' grid-cell-sunk';
        if (lastSunkKeys?.has(k)) cls += ' grid-cell-last-sunk';
        if (sinkingKeys?.has(k)) cls += ' animate-jiggle';
      } else if (mode === 'place') {
        const shipHere = hasCoord(fleet, coord);
        if (shipHere) {
          cls += ' bg-slate-400 grid-cell-ship ship-outline';
          const s = shipAt(fleet, coord);
          if (s && fleet) {
            const idx = fleet.findIndex((f) => f.id === s.id);
            cls += ` ship-p${((idx % 6) + 6) % 6}`;
            const up: Coord = { r: r - 1, c };
            const right: Coord = { r, c: c + 1 };
            const down: Coord = { r: r + 1, c };
            const left: Coord = { r, c: c - 1 };
            const sameUp = r > 0 && shipAt(fleet, up)?.id === s.id;
            const sameRight = c < 9 && shipAt(fleet, right)?.id === s.id;
            const sameDown = r < 9 && shipAt(fleet, down)?.id === s.id;
            const sameLeft = c > 0 && shipAt(fleet, left)?.id === s.id;
            if (!sameUp) cls += ' edge-t';
            if (!sameRight) cls += ' edge-r';
            if (!sameDown) cls += ' edge-b';
            if (!sameLeft) cls += ' edge-l';
          }
        }
        if (previewCoords?.some((x) => keyOf(x) === k)) {
          cls += previewValid ? ' bg-emerald-300' : ' bg-rose-300';
        }
      }

      cells.push(
        <td
          key={c}
          className={cls + (disabled ? ' pointer-events-none opacity-60' : ' hover:bg-slate-200 cursor-pointer')}
          onClick={() => onCell && onCell(coord)}
          onMouseEnter={() => onHover && onHover(coord)}
          onMouseLeave={() => onHover && onHover(null)}
          onFocus={() => onHover && onHover(coord)}
          onBlur={() => onHover && onHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onCell) {
              e.preventDefault();
              onCell(coord);
            }
          }}
          tabIndex={disabled ? -1 : 0}
          aria-label={`Row ${r + 1}, Column ${letters[c]}`}
        >
          {content}
        </td>
      );
    }
    rows.push(<tr key={r}>{cells}</tr>);
  }

  return (
    <table className="border-collapse">
      <thead><tr>{headerRow}</tr></thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

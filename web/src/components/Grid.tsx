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

function getShipColor(size: number): string {
  switch (size) {
    case 2: return 'bg-teal-400'; // Destroyer - teal
    case 3: return 'bg-amber-400'; // Cruiser - amber
    case 4: return 'bg-orange-400'; // Battleship - orange
    case 5: return 'bg-purple-400'; // Carrier - purple
    default: return 'bg-pink-400'; // Submarine - pink
  }
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
  hoverCoord?: Coord | null; // for spyglass preview in fire mode
};

export default function Grid({ mode, fleet, opponentFleet, shots, showShips = false, disabled = false, onCell, previewCoords, previewValid, onHover, highlightKey, sunkKeys, lastSunkKeys, sinkingKeys, hoverCoord }: Props) {
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
          const s = shipAt(fleet, coord);
          if (s && fleet) {
            cls += ` ${getShipColor(s.size)} grid-cell-ship ship-outline`;
            
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
            cls += ' !bg-gradient-to-br !from-orange-400 !to-red-500 text-white animate-hit text-2xl';
            content = <span style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.3)' }}>💥</span>; // Explosion for hits
          } else {
            // Opponent guessed here but it's a miss
            cls += ' !bg-gradient-to-br !from-blue-300 !to-cyan-400 animate-miss text-2xl';
            content = <span style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5), -1px -1px 2px rgba(255,255,255,0.8)' }}>🌊</span>; // Ocean wave for misses
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
          if (hit) {
            cls += ' bg-gradient-to-br from-orange-400 to-red-500 text-white animate-hit text-2xl';
            content = <span style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.3)' }}>💥</span>; // Explosion for hits
            // Only outline once the ship is sunk (including during sinking animation)
            const isSunkCell = !!(sunkKeys?.has(k) || lastSunkKeys?.has(k) || sinkingKeys?.has(k));
            if (isSunkCell) {
              const s = shipAt(opponentFleet, coord);
              if (s) {
                const isSunkSame = (rr: number, cc: number) => {
                  if (rr < 0 || rr > 9 || cc < 0 || cc > 9) return false;
                  const nk = `${rr},${cc}`;
                  if (!(sunkKeys?.has(nk) || lastSunkKeys?.has(nk) || sinkingKeys?.has(nk))) return false;
                  const ns = shipAt(opponentFleet, { r: rr, c: cc });
                  return ns?.id === s.id;
                };
                const up = isSunkSame(r - 1, c);
                const right = isSunkSame(r, c + 1);
                const down = isSunkSame(r + 1, c);
                const left = isSunkSame(r, c - 1);
                cls += ' ship-outline';
                if (!up) cls += ' edge-t';
                if (!right) cls += ' edge-r';
                if (!down) cls += ' edge-b';
                if (!left) cls += ' edge-l';
              }
            }
          } else {
            cls += ' bg-gradient-to-br from-blue-300 to-cyan-400 animate-miss text-2xl';
            content = <span style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5), -1px -1px 2px rgba(255,255,255,0.8)' }}>🌊</span>; // Ocean wave for misses
          }
        }
        if (highlightKey && shots?.has(k) && highlightKey === k) {
          cls += ' grid-cell-last';
        }
        if (sunkKeys?.has(k)) cls += ' grid-cell-sunk';
        if (lastSunkKeys?.has(k)) cls += ' grid-cell-last-sunk';
        if (sinkingKeys?.has(k)) cls += ' animate-jiggle';
        
        // Show magnifying glass when hovering over empty cells that haven't been shot
        if (hoverCoord && !shots?.has(k) && keyOf(coord) === keyOf(hoverCoord)) {
          content = <span style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>🔍</span>; // Magnifying glass
          cls += ' bg-amber-200 animate-pulse';
        }
      } else if (mode === 'place') {
        const shipHere = hasCoord(fleet, coord);
        if (shipHere) {
          const s = shipAt(fleet, coord);
          if (s && fleet) {
            cls += ` ${getShipColor(s.size)} grid-cell-ship ship-outline`;
            
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

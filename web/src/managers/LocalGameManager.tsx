import React, { useMemo, useState } from 'react';
import PlacementView from '../views/PlacementView';
import PlayView from '../views/PlayView';
import SwapOverlay from '../components/SwapOverlay';
import Confetti from '../components/Confetti';
import HelpPopover from '../components/HelpPopover';
import {
  FLEET_SIZES,
  type Coord,
  type Orientation,
  type Player as PlayerEngine,
  type ShipSize,
  canPlace,
  placeShip,
  fire,
  coordsFor,
} from '@app/engine';
import { enableAudio, isAudioEnabled, playHit, playMiss, playSunk, playWin } from '../sound';

type Phase = 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';

function emptyPlayer(): PlayerEngine {
  return { fleet: [], shots: new Set() };
}

interface Props {
  onBack: () => void;
}

export default function LocalGameManager({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('P1_PLACE');
  const [p1, setP1] = useState<PlayerEngine>(() => emptyPlayer());
  const [p2, setP2] = useState<PlayerEngine>(() => emptyPlayer());
  const [p1PlaceIndex, setP1PlaceIndex] = useState(0);
  const [p2PlaceIndex, setP2PlaceIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>('H');
  const [overlay, setOverlay] = useState<{ shown: boolean; message: string; next?: Phase }>({ shown: false, message: '' });
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [preview, setPreview] = useState<{ coords: Coord[]; valid: boolean } | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());
  const [lastShotP1, setLastShotP1] = useState<string | null>(null);
  const [lastShotP2, setLastShotP2] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [names, setNames] = useState<{ 1?: string; 2?: string }>({});

  const nextSize = useMemo<ShipSize | undefined>(() => {
    const i = phase === 'P1_PLACE' ? p1PlaceIndex : p2PlaceIndex;
    return FLEET_SIZES[i] as ShipSize | undefined;
  }, [phase, p1PlaceIndex, p2PlaceIndex]);

  function handlePlace(c: Coord) {
    const size = nextSize;
    if (!size) return;
    if (phase === 'P1_PLACE') {
      if (!canPlace(p1.fleet, c, size, orientation)) return;
      setP1((prev) => ({ ...prev, fleet: placeShip(prev.fleet, c, size, orientation) }));
      const nextIdx = p1PlaceIndex + 1;
      setP1PlaceIndex(nextIdx);
      if (nextIdx >= FLEET_SIZES.length) {
        setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_PLACE' });
      }
    } else if (phase === 'P2_PLACE') {
      if (!canPlace(p2.fleet, c, size, orientation)) return;
      setP2((prev) => ({ ...prev, fleet: placeShip(prev.fleet, c, size, orientation) }));
      const nextIdx = p2PlaceIndex + 1;
      setP2PlaceIndex(nextIdx);
      if (nextIdx >= FLEET_SIZES.length) {
        setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
      }
    }
  }

  function handleHover(c: Coord | null) {
    const size = nextSize;
    if (!size || !c) {
      setPreview(null);
      return;
    }
    const coords = coordsFor(c, size, orientation);
    const valid = phase === 'P1_PLACE'
      ? canPlace(p1.fleet, c, size, orientation)
      : canPlace(p2.fleet, c, size, orientation);
    setPreview({ coords, valid });
  }

  function handleUndo() {
    if (phase === 'P1_PLACE' && p1.fleet.length > 0) {
      setP1((prev) => ({ ...prev, fleet: prev.fleet.slice(0, -1) }));
      setP1PlaceIndex((i) => Math.max(0, i - 1));
    }
    if (phase === 'P2_PLACE' && p2.fleet.length > 0) {
      setP2((prev) => ({ ...prev, fleet: prev.fleet.slice(0, -1) }));
      setP2PlaceIndex((i) => Math.max(0, i - 1));
    }
  }

  function handleDonePlacement() {
    if (phase === 'P1_PLACE' && p1PlaceIndex >= FLEET_SIZES.length) {
      setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_PLACE' });
    }
    if (phase === 'P2_PLACE' && p2PlaceIndex >= FLEET_SIZES.length) {
      setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
    }
  }

  function handleFire(r: number, c: number) {
    if (phase === 'P1_TURN') {
      const k = `${r},${c}`;
      if (p1.shots.has(k)) return;
      const res = fire(p1.shots, p2.fleet, { r, c });
      setLastShotP1(k);
      setP1((prev) => ({ ...prev, shots: res.attackerShots }));
      setP2((prev) => ({ ...prev, fleet: res.defenderFleet }));
      if (res.result.hit) playHit(); else playMiss();
      if (res.result.sunk) playSunk();
      if (res.result.win) {
        setWinner(1);
        setPhase('GAME_OVER');
        setShowConfetti(true);
        playWin();
        return;
      }
      setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_TURN' });
    } else if (phase === 'P2_TURN') {
      const k = `${r},${c}`;
      if (p2.shots.has(k)) return;
      const res = fire(p2.shots, p1.fleet, { r, c });
      setLastShotP2(k);
      setP2((prev) => ({ ...prev, shots: res.attackerShots }));
      setP1((prev) => ({ ...prev, fleet: res.defenderFleet }));
      if (res.result.hit) playHit(); else playMiss();
      if (res.result.sunk) playSunk();
      if (res.result.win) {
        setWinner(2);
        setPhase('GAME_OVER');
        setShowConfetti(true);
        playWin();
        return;
      }
      setOverlay({ shown: true, message: `Pass the device to ${names[1] ?? 'Player 1'}`, next: 'P1_TURN' });
    }
  }

  function handleReset() {
    setPhase('P1_PLACE');
    setP1(emptyPlayer());
    setP2(emptyPlayer());
    setP1PlaceIndex(0);
    setP2PlaceIndex(0);
    setOrientation('H');
    setOverlay({ shown: false, message: '' });
    setWinner(null);
    setPreview(null);
    setLastShotP1(null);
    setLastShotP2(null);
    setShowConfetti(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-center">Player vs Player</h2>
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

      {phase === 'P1_PLACE' && (
        <PlacementView
          playerIndex={1}
          playerName={names[1]}
          onNameChange={(nm) => setNames((prev) => ({ ...prev, 1: nm.trim() || undefined }))}
          fleet={p1.fleet}
          nextSize={nextSize}
          orientation={orientation}
          onRotate={() => setOrientation((o) => (o === 'H' ? 'V' : 'H'))}
          onPlace={handlePlace}
          onHover={handleHover}
          onUndo={handleUndo}
          onDone={handleDonePlacement}
          previewCoords={preview?.coords}
          previewValid={preview?.valid}
        />
      )}

      {phase === 'P2_PLACE' && (
        <PlacementView
          playerIndex={2}
          playerName={names[2]}
          onNameChange={(nm) => setNames((prev) => ({ ...prev, 2: nm.trim() || undefined }))}
          fleet={p2.fleet}
          nextSize={nextSize}
          orientation={orientation}
          onRotate={() => setOrientation((o) => (o === 'H' ? 'V' : 'H'))}
          onPlace={handlePlace}
          onHover={handleHover}
          onUndo={handleUndo}
          onDone={handleDonePlacement}
          previewCoords={preview?.coords}
          previewValid={preview?.valid}
        />
      )}

      {phase === 'P1_TURN' && (
        <PlayView
          currentPlayer={1}
          currentPlayerName={names[1]}
          opponentFleet={p2.fleet}
          attackerShots={p1.shots}
          onFire={handleFire}
          ownFleet={p1.fleet}
          opponentShots={p2.shots}
          lastAttackerShot={lastShotP1}
          lastOpponentShot={lastShotP2}
        />
      )}

      {phase === 'P2_TURN' && (
        <PlayView
          currentPlayer={2}
          currentPlayerName={names[2]}
          opponentFleet={p1.fleet}
          attackerShots={p2.shots}
          onFire={handleFire}
          ownFleet={p2.fleet}
          opponentShots={p1.shots}
          lastAttackerShot={lastShotP2}
          lastOpponentShot={lastShotP1}
        />
      )}

      {phase === 'GAME_OVER' && (
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">🎉 {(winner && names[winner]) ? names[winner] : `Player ${winner}`} wins!</h2>
          <div className="text-slate-700">Press Restart to play again.</div>
        </div>
      )}

      <SwapOverlay
        shown={overlay.shown}
        message={overlay.message}
        onReady={() => {
          enableAudio().finally(() => setAudioReady(isAudioEnabled()));
          setOverlay({ shown: false, message: '' });
          if (overlay.next) setPhase(overlay.next);
        }}
      />

      {phase === 'GAME_OVER' && showConfetti && <Confetti loop origin="center" />}
    </div>
  );
}

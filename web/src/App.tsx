import React, { useEffect, useMemo, useState } from 'react';
import PlacementView from './views/PlacementView';
import PlayView from './views/PlayView';
import SwapOverlay from './components/SwapOverlay';
import Confetti from './components/Confetti';
import HelpPopover from './components/HelpPopover';
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
import { playHit, playMiss, playSunk, enableAudio, isAudioEnabled } from './sound';
function coordLabel(r: number, c: number): string {
  const letters = ['A','B','C','D','E','F','G','H','I','J'];
  return `${letters[c]}:${r + 1}`;
}

type Phase = 'P1_PLACE' | 'P2_PLACE' | 'P1_TURN' | 'P2_TURN' | 'GAME_OVER';

type PlayerState = PlayerEngine;

function emptyPlayer(): PlayerState {
  return { fleet: [], shots: new Set() };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('P1_PLACE');
  const [p1, setP1] = useState<PlayerState>(() => emptyPlayer());
  const [p2, setP2] = useState<PlayerState>(() => emptyPlayer());
  const [p1PlaceIndex, setP1PlaceIndex] = useState(0);
  const [p2PlaceIndex, setP2PlaceIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>('H');
  const [overlay, setOverlay] = useState<{ shown: boolean; message: string; next?: Phase }>({ shown: false, message: '' });
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [preview, setPreview] = useState<{ coords: Coord[]; valid: boolean } | null>(null);
  const [bannerP1, setBannerP1] = useState<string | null>(null);
  const [bannerP2, setBannerP2] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState<boolean>(() => isAudioEnabled());
  const [lastShotP1, setLastShotP1] = useState<string | null>(null);
  const [lastShotP2, setLastShotP2] = useState<string | null>(null);
  const [sunkOnP1, setSunkOnP1] = useState<Set<string> | null>(null);
  const [sunkOnP2, setSunkOnP2] = useState<Set<string> | null>(null);
  const [lastSunkOnP1, setLastSunkOnP1] = useState<Set<string> | null>(null);
  const [lastSunkOnP2, setLastSunkOnP2] = useState<Set<string> | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sinkingOnP1, setSinkingOnP1] = useState<Set<string> | null>(null);
  const [sinkingOnP2, setSinkingOnP2] = useState<Set<string> | null>(null);
  const [lockUI, setLockUI] = useState(false);
  const [pendingHandoff, setPendingHandoff] = useState<{ next: Phase; message: string } | null>(null);
  const [log, setLog] = useState<{ attacker: 1 | 2; text: string; system?: boolean; key: string; side?: 1 | 2 }[]>([]);
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
    if (phase === 'P1_PLACE' && p1PlaceIndex >= FLEET_SIZES.length)
      setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_PLACE' });
    if (phase === 'P2_PLACE' && p2PlaceIndex >= FLEET_SIZES.length)
      setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
  }

  function handleFire(r: number, c: number) {
    if (phase === 'P1_TURN') {
      // Clear any previous banner for P1 when they take action
      if (bannerP1) setBannerP1(null);
      // Clear last-sunk highlight on P1's own board once they start their turn
      if (lastSunkOnP1) setLastSunkOnP1(null);
      const k = `${r},${c}`;
      if (p1.shots.has(k)) return; // ignore repeats
      const res = fire(p1.shots, p2.fleet, { r, c });
      setLastShotP1(k);
      setP1((prev) => ({ ...prev, shots: res.attackerShots }));
      setP2((prev) => ({ ...prev, fleet: res.defenderFleet }));
      if (res.result.win && !res.result.sunk) {
        setWinner(1);
        setPhase('GAME_OVER');
        setShowConfetti(true);
        return;
      }
      let msg = res.result.hit ? 'Hit! ' : 'Miss! ';
      setLog((prev) => [...prev, { attacker: 1, text: `${coordLabel(r,c)} - ${res.result.hit ? 'Hit 💥' : 'Miss 💧'}`, key: `${Date.now()}-p1` }]);
      if (res.result.sunk) {
        msg += 'You sunk a ship! 🚢 ';
        const sunkShip = res.defenderFleet.find((s) => s.id === res.result.sunk);
        const sizeVal = sunkShip?.size ?? '?';
        // Align sunk message on the side that was sunk (defender)
        setLog((prev) => [...prev, { attacker: 1, side: 2, text: `Sunk: ${sizeVal} 🚢`, key: `${Date.now()}-p1s` }]);
        setBannerP2('Opponent sunk one of your ships! 🚢');
        playSunk();
        // Collect coords for sunk ship on opponent's board
        if (sunkShip) {
          const keys = new Set(sunkShip.coords.map((co) => `${co.r},${co.c}`));
          setSunkOnP2((prev) => {
            const acc = new Set(prev ?? [] as any);
            keys.forEach((k) => acc.add(k));
            return acc;
          });
          setSinkingOnP2(keys);
          setLastSunkOnP2(keys);
          setLockUI(true);
          if (res.result.win) {
            // Skip handoff; finish the game after a brief moment to enjoy the animation
            window.setTimeout(() => {
              setWinner(1);
              setShowConfetti(true);
              setPhase('GAME_OVER');
              setSinkingOnP2(null);
              setLockUI(false);
            }, 1500);
            return;
          }
          // Wait for user to trigger handoff; keep jiggle running until then
          // Message is written for the current (attacking) player here
          setPendingHandoff({ next: 'P2_TURN', message: 'You sunk a ship! 🚢' });
          return;
        }
      } else if (res.result.hit) {
        setBannerP2('Opponent hit a ship! 💥');
        playHit();
      } else {
        setBannerP2('Opponent missed. 💧');
        playMiss();
      }
      // Always hand over via explicit swap
      setLockUI(true);
      setPendingHandoff({ next: 'P2_TURN', message: res.result.hit ? 'You hit a ship! 💥' : 'You missed. 💧' });
      // Clear the last-sunk emphasis once the next player starts their action
      setLastSunkOnP2((prev) => prev); // keep for next view
    } else if (phase === 'P2_TURN') {
      if (bannerP2) setBannerP2(null);
      if (lastSunkOnP2) setLastSunkOnP2(null);
      const k = `${r},${c}`;
      if (p2.shots.has(k)) return;
      const res = fire(p2.shots, p1.fleet, { r, c });
      setLastShotP2(k);
      setP2((prev) => ({ ...prev, shots: res.attackerShots }));
      setP1((prev) => ({ ...prev, fleet: res.defenderFleet }));
      if (res.result.win && !res.result.sunk) {
        setWinner(2);
        setPhase('GAME_OVER');
        setShowConfetti(true);
        return;
      }
      let msg = res.result.hit ? 'Hit! ' : 'Miss! ';
      setLog((prev) => [...prev, { attacker: 2, text: `${coordLabel(r,c)} - ${res.result.hit ? 'Hit 💥' : 'Miss 💧'}`, key: `${Date.now()}-p2` }]);
      if (res.result.sunk) {
        msg += 'You sunk a ship! 🚢 ';
        const sunkShip = res.defenderFleet.find((s) => s.id === res.result.sunk);
        const sizeVal = sunkShip?.size ?? '?';
        setLog((prev) => [...prev, { attacker: 2, side: 1, text: `Sunk: ${sizeVal} 🚢`, key: `${Date.now()}-p2s` }]);
        setBannerP1('Opponent sunk one of your ships! 🚢');
        playSunk();
        if (sunkShip) {
          const keys = new Set(sunkShip.coords.map((co) => `${co.r},${co.c}`));
          setSunkOnP1((prev) => {
            const acc = new Set(prev ?? [] as any);
            keys.forEach((k) => acc.add(k));
            return acc;
          });
          setSinkingOnP1(keys);
          setLastSunkOnP1(keys);
          setLockUI(true);
          if (res.result.win) {
            window.setTimeout(() => {
              setWinner(2);
              setShowConfetti(true);
              setPhase('GAME_OVER');
              setSinkingOnP1(null);
              setLockUI(false);
            }, 1500);
            return;
          }
          setPendingHandoff({ next: 'P1_TURN', message: 'You sunk a ship! 🚢' });
          return;
        }
      } else if (res.result.hit) {
        setBannerP1('Opponent hit a ship! 💥');
        playHit();
      } else {
        setBannerP1('Opponent missed. 💧');
        playMiss();
      }
      setLockUI(true);
      setPendingHandoff({ next: 'P1_TURN', message: res.result.hit ? 'You hit a ship! 💥' : 'You missed. 💧' });
      setLastSunkOnP1((prev) => prev);
    }
  }

  // Keyboard: Space to rotate during placement phases
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlay.shown) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (phase === 'P1_PLACE' || phase === 'P2_PLACE') {
          e.preventDefault();
          setOrientation((o) => (o === 'H' ? 'V' : 'H'));
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, overlay.shown]);

  function handleReset() {
    setPhase('P1_PLACE');
    setP1(emptyPlayer());
    setP2(emptyPlayer());
    setP1PlaceIndex(0);
    setP2PlaceIndex(0);
    setOrientation('H');
    setOverlay({ shown: false, message: '' });
    setWinner(null);
    setLog([]);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3" aria-hidden={overlay.shown} style={{ visibility: overlay.shown ? 'hidden' as const : 'visible' }}>
        <h1 className="text-3xl font-extrabold">Kids Battleships</h1>
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
          <button className="btn" onClick={handleReset}>Restart</button>
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
          meLabel={(names[1]?.trim()?.[0]?.toUpperCase() ?? 'P1')}
          themLabel={(names[2]?.trim()?.[0]?.toUpperCase() ?? 'P2')}
          opponentFleet={p2.fleet}
          attackerShots={p1.shots}
          onFire={handleFire}
          ownFleet={p1.fleet}
          opponentShots={p2.shots}
          lastAttackerShot={lastShotP1}
          lastOpponentShot={lastShotP2}
          sunkOnOpponent={sunkOnP2}
          sunkOnSelf={sunkOnP1}
          lastSunkOnOpponent={lastSunkOnP2}
          lastSunkOnSelf={lastSunkOnP1}
          sinkingOnOpponent={sinkingOnP2}
          sinkingOnSelf={sinkingOnP1}
          disabled={lockUI}
          ctaLabel={pendingHandoff ? 'Swap Players' : null}
          ctaMessage={pendingHandoff?.message ?? null}
          onCta={pendingHandoff ? () => { const next = pendingHandoff!.next; setOverlay({ shown: true, message: next === 'P2_TURN' ? `Pass the device to ${names[2] ?? 'Player 2'}` : `Pass the device to ${names[1] ?? 'Player 1'}`, next }); setPendingHandoff(null); } : undefined}
          chat={log.map((e) => ({
            who: e.system ? 'system' : (e.side ? (1 === e.side ? 'me' : 'them') : (e.attacker === 1 ? 'me' : 'them')),
            text: e.text,
            key: e.key,
          }))}
          banner={bannerP1 ?? undefined}
        />
      )}

      {phase === 'P2_TURN' && (
        <PlayView
          currentPlayer={2}
          currentPlayerName={names[2]}
          meLabel={(names[2]?.trim()?.[0]?.toUpperCase() ?? 'P2')}
          themLabel={(names[1]?.trim()?.[0]?.toUpperCase() ?? 'P1')}
          opponentFleet={p1.fleet}
          attackerShots={p2.shots}
          onFire={handleFire}
          ownFleet={p2.fleet}
          opponentShots={p1.shots}
          lastAttackerShot={lastShotP2}
          lastOpponentShot={lastShotP1}
          sunkOnOpponent={sunkOnP1}
          sunkOnSelf={sunkOnP2}
          lastSunkOnOpponent={lastSunkOnP1}
          lastSunkOnSelf={lastSunkOnP2}
          sinkingOnOpponent={sinkingOnP1}
          sinkingOnSelf={sinkingOnP2}
          disabled={lockUI}
          ctaLabel={pendingHandoff ? 'Swap Players' : null}
          ctaMessage={pendingHandoff?.message ?? null}
          onCta={pendingHandoff ? () => { const next = pendingHandoff!.next; setOverlay({ shown: true, message: next === 'P2_TURN' ? `Pass the device to ${names[2] ?? 'Player 2'}` : `Pass the device to ${names[1] ?? 'Player 1'}`, next }); setPendingHandoff(null); } : undefined}
          chat={log.map((e) => ({
            who: e.system ? 'system' : (e.side ? (2 === e.side ? 'me' : 'them') : (e.attacker === 2 ? 'me' : 'them')),
            text: e.text,
            key: e.key,
          }))}
          banner={bannerP2 ?? undefined}
        />
      )}

      {phase === 'GAME_OVER' && (
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">🎉 Player {winner} wins!</h2>
          <div className="text-slate-700">Press Restart to play again.</div>
        </div>
      )}

      <SwapOverlay
        shown={overlay.shown}
        message={overlay.message}
        onReady={() => {
          // attempt to unlock audio on a user gesture
          enableAudio().finally(() => setAudioReady(isAudioEnabled()));
          setOverlay({ shown: false, message: '' });
          if (overlay.next) setPhase(overlay.next);
          // Clear transient animations; keep sunk rings so next player can see what sank
          setSinkingOnP1(null);
          setSinkingOnP2(null);
          setLockUI(false);
        }}
      />

      {phase === 'GAME_OVER' && showConfetti && <Confetti />}
    </div>
  );
}

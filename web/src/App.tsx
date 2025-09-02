import React, { useEffect, useMemo, useState } from 'react';
import PlacementView from './views/PlacementView';
import PlayView from './views/PlayView';
import SwapOverlay from './components/SwapOverlay';
import Confetti from './components/Confetti';
import HelpPopover from './components/HelpPopover';
import OnlineGameManager from './multiplayer/OnlineGameManager';
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
import { playHit, playMiss, playSunk, playWin, enableAudio, isAudioEnabled } from './sound';
import { loadState, saveState, clearState, serializePlayer, deserializePlayer, type Mode } from './persistence';
import { randomPlaceFleet, chooseNextShot, emptyAIMemory, updateAIMemory } from './ai';
import type { Difficulty } from './persistence';
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
  const [mode, setMode] = useState<Mode>('PVP');
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('easy');
  const [aiMem, setAiMem] = useState(() => emptyAIMemory());
  useEffect(() => {
    const persisted = loadState();
    if (persisted && persisted.mode) setMode(persisted.mode);
    if (persisted?.ai?.difficulty) setAiDifficulty(persisted.ai.difficulty);
    if (persisted?.ai?.mem) setAiMem({
      targetQueue: persisted.ai.mem.targetQueue ?? [],
      cluster: persisted.ai.mem.cluster ?? [],
      parity: (persisted.ai.mem.parity ?? 0) as 0 | 1,
      sizesLeft: (persisted.ai.mem.sizesLeft && persisted.ai.mem.sizesLeft.length > 0) ? persisted.ai.mem.sizesLeft : [...FLEET_SIZES],
    } as any);
  }, []);
  useEffect(() => {
    const current = loadState();
    if (current) {
      saveState({ ...current, mode, ai: { difficulty: aiDifficulty, mem: { targetQueue: aiMem.targetQueue, cluster: aiMem.cluster, parity: (aiMem as any).parity, sizesLeft: (aiMem as any).sizesLeft } } });
    }
  }, [mode, aiDifficulty, aiMem]);
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
  const [hydrated, setHydrated] = useState(false);

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
        if (mode === 'PVC') {
          const autoFleet = randomPlaceFleet();
          setP2((prev) => ({ ...prev, fleet: autoFleet }));
          setNames((prev) => ({ ...prev, 2: prev[2] ?? 'Computer' }));
          setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
        } else {
          setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_PLACE' });
        }
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
      if (mode === 'PVC') {
        const autoFleet = randomPlaceFleet();
        setP2((prev) => ({ ...prev, fleet: autoFleet }));
        setNames((prev) => ({ ...prev, 2: prev[2] ?? 'Computer' }));
        setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
      } else {
        setOverlay({ shown: true, message: `Pass the device to ${names[2] ?? 'Player 2'}`, next: 'P2_PLACE' });
      }
    }
    if (phase === 'P2_PLACE' && p2PlaceIndex >= FLEET_SIZES.length)
      setOverlay({ shown: true, message: `${names[1] ?? 'Player 1'} starts!`, next: 'P1_TURN' });
  }

  function handleFire(r: number, c: number) {
    if (phase === 'P1_TURN') {
      if (bannerP1) setBannerP1(null);
      if (lastSunkOnP1) setLastSunkOnP1(null);
      const k = `${r},${c}`;
      if (p1.shots.has(k)) return;
      const res = fire(p1.shots, p2.fleet, { r, c });
      setLastShotP1(k);
      setP1((prev) => ({ ...prev, shots: res.attackerShots }));
      setP2((prev) => ({ ...prev, fleet: res.defenderFleet }));
      if (res.result.win && !res.result.sunk) {
        setWinner(1);
        setPhase('GAME_OVER');
        setShowConfetti(true);
        playWin();
        return;
      }
      setLog((prev) => [...prev, { attacker: 1, text: `${coordLabel(r,c)} - ${res.result.hit ? 'Hit 💥' : 'Miss 💧'}`, key: `${Date.now()}-p1` }]);
      if (res.result.sunk) {
        // Attacker-side feedback
        setBannerP1('You sunk a ship! 🚢');
        const sunkShip = res.defenderFleet.find((s) => s.id === res.result.sunk);
        const sizeVal = sunkShip?.size ?? '?';
        setLog((prev) => [...prev, { attacker: 1, side: 2, text: `Sunk: ${sizeVal} 🚢`, key: `${Date.now()}-p1s` }]);
        setBannerP2('Opponent sunk one of your ships! 🚢');
        playSunk();
        if (sunkShip) {
          const keys = new Set(sunkShip.coords.map((co) => `${co.r},${co.c}`));
          setSunkOnP2((prev) => { const acc = new Set(prev ?? [] as any); keys.forEach((x) => acc.add(x)); return acc; });
          setSinkingOnP2(keys);
          setLastSunkOnP2(keys);
          setLockUI(true);
          if (res.result.win) {
            window.setTimeout(() => {
              setWinner(1);
              setShowConfetti(true);
              setPhase('GAME_OVER');
              setSinkingOnP2(null);
              setLockUI(false);
              playWin();
            }, 1500);
            return;
          }
          if (mode === 'PVC') {
            // After sinking animation, briefly think then auto-fire for computer
            window.setTimeout(() => {
              setSinkingOnP2(null);
              setLockUI(true);
              setBannerP1('Computer is thinking…');
              window.setTimeout(() => {
                setPhase('P2_TURN');
                computerAct();
              }, 650);
            }, 1500);
            return;
          }
          setPendingHandoff({ next: 'P2_TURN', message: 'You sunk a ship! 🚢' });
          return;
        }
      } else if (res.result.hit) {
        // Attacker-side feedback
        setBannerP1('You hit a ship! 💥');
        setBannerP2('Opponent hit a ship! 💥');
        playHit();
      } else {
        // Attacker-side feedback
        setBannerP1('You missed. 💧');
        setBannerP2('Opponent missed. 💧');
        playMiss();
      }
      if (mode === 'PVC') {
        // Briefly show thinking then auto-fire for computer
        setLockUI(true);
        setBannerP1('Computer is thinking…');
        setLastSunkOnP2((prev) => prev);
        window.setTimeout(() => {
          setPhase('P2_TURN');
          computerAct();
        }, 650);
      } else {
        setLockUI(true);
        setPendingHandoff({ next: 'P2_TURN', message: res.result.hit ? 'You hit a ship! 💥' : 'You missed. 💧' });
        setLastSunkOnP2((prev) => prev);
      }
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
        playWin();
        return;
      }
      setLog((prev) => [...prev, { attacker: 2, text: `${coordLabel(r,c)} - ${res.result.hit ? 'Hit 💥' : 'Miss 💧'}`, key: `${Date.now()}-p2` }]);
      if (res.result.sunk) {
        setBannerP2('You sunk a ship! 🚢');
        const sunkShip = res.defenderFleet.find((s) => s.id === res.result.sunk);
        const sizeVal = sunkShip?.size ?? '?';
        setLog((prev) => [...prev, { attacker: 2, side: 1, text: `Sunk: ${sizeVal} 🚢`, key: `${Date.now()}-p2s` }]);
        setBannerP1('Opponent sunk one of your ships! 🚢');
        playSunk();
        if (sunkShip) {
          const keys = new Set(sunkShip.coords.map((co) => `${co.r},${co.c}`));
          setSunkOnP1((prev) => { const acc = new Set(prev ?? [] as any); keys.forEach((x) => acc.add(x)); return acc; });
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
              playWin();
            }, 1500);
            return;
          }
          if (mode === 'PVC') {
            window.setTimeout(() => {
              setSinkingOnP1(null);
              setLockUI(false);
              setPhase('P1_TURN');
            }, 1500);
            return;
          }
          setPendingHandoff({ next: 'P1_TURN', message: 'You sunk a ship! 🚢' });
          return;
        }
      } else if (res.result.hit) {
        setBannerP2('You hit a ship! 💥');
        setBannerP1('Opponent hit a ship! 💥');
        playHit();
      } else {
        setBannerP2('You missed. 💧');
        setBannerP1('Opponent missed. 💧');
        playMiss();
      }
      if (mode === 'PVC') {
        setLockUI(true);
        window.setTimeout(() => {
          setLockUI(false);
          setPhase('P1_TURN');
        }, 600);
        setLastSunkOnP1((prev) => prev);
      } else {
        setLockUI(true);
        setPendingHandoff({ next: 'P1_TURN', message: res.result.hit ? 'You hit a ship! 💥' : 'You missed. 💧' });
        setLastSunkOnP1((prev) => prev);
      }
    }
  }

  // Computer logic for P2 with difficulty + memory
  function computerAct() {
    if (mode !== 'PVC') return;
    const target = chooseNextShot(p2.shots, aiMem, aiDifficulty);
    const k = `${target.r},${target.c}`;
    if (p2.shots.has(k)) return;
    const res = fire(p2.shots, p1.fleet, target);
    setLastShotP2(k);
    setP2((prev) => ({ ...prev, shots: res.attackerShots }));
    setP1((prev) => ({ ...prev, fleet: res.defenderFleet }));
    setAiMem((prev) => updateAIMemory(prev, aiDifficulty, target, res.result, res.attackerShots));
    if (res.result.win && !res.result.sunk) {
      setWinner(2);
      setPhase('GAME_OVER');
      setShowConfetti(true);
      playWin();
      return;
    }
    setLog((prev) => [...prev, { attacker: 2, text: `${coordLabel(target.r,target.c)} - ${res.result.hit ? 'Hit 💥' : 'Miss 💧'}`, key: `${Date.now()}-p2-ai` }]);
    if (res.result.sunk) {
      const sunkShip = res.defenderFleet.find((s) => s.id === res.result.sunk);
      const sizeVal = sunkShip?.size ?? '?';
      setLog((prev) => [...prev, { attacker: 2, side: 1, text: `Sunk: ${sizeVal} 🚢`, key: `${Date.now()}-p2s-ai` }]);
      setBannerP1('Opponent sunk one of your ships! 🚢');
      playSunk();
      if (sunkShip) {
        const keys = new Set(sunkShip.coords.map((co) => `${co.r},${co.c}`));
        setSunkOnP1((prev) => { const acc = new Set(prev ?? [] as any); keys.forEach((x) => acc.add(x)); return acc; });
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
            playWin();
          }, 1500);
          return;
        }
        window.setTimeout(() => {
          setSinkingOnP1(null);
          setLockUI(false);
          setPhase('P1_TURN');
        }, 1500);
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
    window.setTimeout(() => {
      setLockUI(false);
      setPhase('P1_TURN');
    }, 900);
  }

  // Load from localStorage once on mount
  useEffect(() => {
    const persisted = loadState();
    if (!persisted) return;
    try {
      setPhase(persisted.phase);
      setP1(deserializePlayer(persisted.p1));
      setP2(deserializePlayer(persisted.p2));
      setP1PlaceIndex(persisted.p1PlaceIndex ?? 0);
      setP2PlaceIndex(persisted.p2PlaceIndex ?? 0);
      setOrientation((persisted.orientation as Orientation) ?? 'H');
      if (persisted.overlay) setOverlay(persisted.overlay);
      setWinner(persisted.winner ?? null);
      setNames(persisted.names ?? {});
      setLog(persisted.log ?? []);
      setLastShotP1(persisted.lastShotP1 ?? null);
      setLastShotP2(persisted.lastShotP2 ?? null);
      setSunkOnP1(persisted.sunkOnP1 ? new Set(persisted.sunkOnP1) : null);
      setSunkOnP2(persisted.sunkOnP2 ? new Set(persisted.sunkOnP2) : null);
      setLastSunkOnP1(persisted.lastSunkOnP1 ? new Set(persisted.lastSunkOnP1) : null);
      setLastSunkOnP2(persisted.lastSunkOnP2 ? new Set(persisted.lastSunkOnP2) : null);
      setSinkingOnP1(persisted.sinkingOnP1 ? new Set(persisted.sinkingOnP1) : null);
      setSinkingOnP2(persisted.sinkingOnP2 ? new Set(persisted.sinkingOnP2) : null);
      setLockUI(!!persisted.lockUI);
      setPendingHandoff(persisted.pendingHandoff ?? null);
    } catch {
      // ignore corrupted state
    }
  }, []);

  // Mark hydration complete after we attempted to load state (next tick)
  useEffect(() => {
    // Even if nothing to load, we still want to allow saving after initial mount
    setHydrated(true);
  }, []);

  // Persist on meaningful changes
  useEffect(() => {
    if (!hydrated) return; // avoid clobbering saved state before hydration
    const state = {
      phase,
      p1: serializePlayer(p1),
      p2: serializePlayer(p2),
      p1PlaceIndex,
      p2PlaceIndex,
      orientation,
      overlay,
      winner,
      names,
      log,
      lastShotP1,
      lastShotP2,
      sunkOnP1: sunkOnP1 ? Array.from(sunkOnP1) : null,
      sunkOnP2: sunkOnP2 ? Array.from(sunkOnP2) : null,
      lastSunkOnP1: lastSunkOnP1 ? Array.from(lastSunkOnP1) : null,
      lastSunkOnP2: lastSunkOnP2 ? Array.from(lastSunkOnP2) : null,
      sinkingOnP1: sinkingOnP1 ? Array.from(sinkingOnP1) : null,
      sinkingOnP2: sinkingOnP2 ? Array.from(sinkingOnP2) : null,
      lockUI,
      pendingHandoff,
    } as const;
    saveState(state as any);
  }, [
    hydrated,
    phase,
    p1,
    p2,
    p1PlaceIndex,
    p2PlaceIndex,
    orientation,
    overlay,
    winner,
    names,
    log,
    lastShotP1,
    lastShotP2,
    sunkOnP1,
    sunkOnP2,
    lastSunkOnP1,
    lastSunkOnP2,
    sinkingOnP1,
    sinkingOnP2,
    lockUI,
    pendingHandoff,
  ]);

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
    setLastShotP1(null);
    setLastShotP2(null);
    setSunkOnP1(null);
    setSunkOnP2(null);
    setLastSunkOnP1(null);
    setLastSunkOnP2(null);
    setSinkingOnP1(null);
    setSinkingOnP2(null);
    setLockUI(false);
    setPendingHandoff(null);
    clearState();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3" aria-hidden={overlay.shown} style={{ visibility: overlay.shown ? 'hidden' as const : 'visible' }}>
        {mode !== 'ONLINE' && (
          <div className="text-sm flex items-center gap-2">
            <label className="font-medium">Mode:</label>
            <select
              className="border rounded px-2 py-1"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              disabled={phase !== 'P1_PLACE' && phase !== 'P2_PLACE'}
            >
              <option value="PVP">Two Players</option>
              <option value="PVC">Vs Computer</option>
            </select>
            {mode === 'PVC' && (
              <>
                <label className="font-medium ml-3">Difficulty:</label>
                <select
                  className="border rounded px-2 py-1"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as Difficulty)}
                  disabled={phase !== 'P1_PLACE' && phase !== 'P2_PLACE'}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </>
            )}
            <button 
              className="btn ml-3"
              onClick={() => setMode('ONLINE')}
              disabled={phase !== 'P1_PLACE' && phase !== 'P2_PLACE'}
            >
              Connect Online
            </button>
          </div>
        )}
        {mode === 'ONLINE' && <div></div>}
        <h1 className="text-3xl font-extrabold">Kids Battleships{mode === 'ONLINE' ? ' - Online' : ''}</h1>
        {mode !== 'ONLINE' && (
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
        )}
        {mode === 'ONLINE' && <div></div>}
      </header>

      {mode === 'ONLINE' ? (
        <OnlineGameManager 
          onBack={() => setMode('PVP')} 
          initialPlayerName={names[1] || ''} 
        />
      ) : (
        <>
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

      {(phase === 'P1_TURN' || (mode === 'PVC' && phase === 'P2_TURN')) && (
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
          ctaLabel={mode === 'PVC' ? null : (pendingHandoff ? 'Swap Players' : null)}
          ctaMessage={mode === 'PVC' ? null : (pendingHandoff?.message ?? null)}
          onCta={mode === 'PVC' ? undefined : (pendingHandoff ? () => { const next = pendingHandoff!.next; setOverlay({ shown: true, message: next === 'P2_TURN' ? `Pass the device to ${names[2] ?? 'Player 2'}` : `Pass the device to ${names[1] ?? 'Player 1'}`, next }); setPendingHandoff(null); } : undefined)}
          chat={log.map((e) => ({
            who: e.system ? 'system' : (e.side ? (1 === e.side ? 'me' : 'them') : (e.attacker === 1 ? 'me' : 'them')),
            text: e.text,
            key: e.key,
          }))}
          banner={bannerP1 ?? undefined}
        />
      )}

      {phase === 'P2_TURN' && mode !== 'PVC' && (
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
          <h2 className="text-2xl font-bold">🎉 {(winner && names[winner]) ? names[winner] : `Player ${winner}`} wins!</h2>
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

      {phase === 'GAME_OVER' && showConfetti && <Confetti loop origin="center" />}
      </>
      )}

    </div>
  );
}

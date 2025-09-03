import React, { useState } from 'react';
import LocalGameManager from './managers/LocalGameManager';
import ComputerGameManager from './managers/ComputerGameManager';
import OnlineGameManager from './multiplayer/OnlineGameManager';
import type { Mode, Difficulty } from './persistence';

export default function App() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  if (mode === 'PVP') {
    return <LocalGameManager onBack={() => setMode(null)} />;
  }
  if (mode === 'PVC') {
    return <ComputerGameManager onBack={() => setMode(null)} difficulty={difficulty} />;
  }
  if (mode === 'ONLINE') {
    return <OnlineGameManager onBack={() => setMode(null)} initialPlayerName="" />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 text-center max-w-md mx-auto">
      <h1 className="text-3xl font-extrabold">Kids Battleships</h1>
      <div className="space-y-3">
        <button className="btn w-full" onClick={() => setMode('PVP')}>Player vs Player</button>
        <div className="flex items-center gap-2">
          <button className="btn flex-1" onClick={() => setMode('PVC')}>Player vs Computer</button>
          <select
            className="border rounded px-2 py-1"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <button className="btn w-full" onClick={() => setMode('ONLINE')}>Online</button>
      </div>
    </div>
  );
}

import React from 'react';
import type { Difficulty } from '../persistence';

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onNavigate: (path: string) => void;
}

export default function HomeView({ difficulty, onDifficultyChange, onNavigate }: Props) {
  return (
    <div className="p-4 sm:p-6 space-y-4 text-center max-w-md mx-auto">
      <h1 className="text-3xl font-extrabold">Kids Battleships</h1>
      <div className="space-y-3">
        <button className="btn w-full" onClick={() => onNavigate('/pvp')}>Player vs Player</button>
        <div className="flex items-center gap-2">
          <button className="btn flex-1" onClick={() => onNavigate('/pvc')}>Player vs Computer</button>
          <select
            className="border rounded px-2 py-1"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <button className="btn w-full" onClick={() => onNavigate('/online')}>Online</button>
      </div>
    </div>
  );
}

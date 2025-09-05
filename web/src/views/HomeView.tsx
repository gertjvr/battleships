import React from 'react';
import type { Difficulty } from '../persistence';

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onNavigate: (path: string) => void;
}

export default function HomeView({ difficulty, onDifficultyChange, onNavigate }: Props) {
  return (
    <div className="p-6 sm:p-8 space-y-6 text-center max-w-lg mx-auto">
      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 shadow-xl border-2 border-white/30">
        <div className="text-6xl mb-4">🏴‍☠️</div>
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg mb-2">
          Captain's Battleships
        </h1>
        <p className="text-white/90 text-lg font-medium">
          Ahoy there, Captain! Ready to battle on the high seas? ⚓
        </p>
      </div>
      
      <div className="space-y-4">
        <button className="btn w-full text-xl py-4" onClick={() => onNavigate('/pvp')}>
          ⚔️ Battle a Friend
        </button>
        <div className="flex items-center gap-3">
          <button className="btn flex-1 text-xl py-4" onClick={() => onNavigate('/pvc')}>
            🤖 Fight the Computer Pirate
          </button>
          <select
            className="border-2 border-amber-400 rounded-xl px-3 py-2 bg-white/90 backdrop-blur text-lg font-semibold focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
          >
            <option value="easy">🌊 Calm Seas</option>
            <option value="medium">⛈️ Rough Waters</option>
            <option value="hard">🌊 Storm Mode</option>
          </select>
        </div>
        <button className="btn w-full text-xl py-4" onClick={() => onNavigate('/online')}>
          🌍 Sail the Seven Seas Online
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import LocalGameManager from './managers/LocalGameManager';
import ComputerGameManager from './managers/ComputerGameManager';
import OnlineGameManager from './multiplayer/OnlineGameManager';
import HomeView from './views/HomeView';
import type { Difficulty } from './persistence';
import { normalizeRoomCode } from './utils/roomCode';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  useEffect(() => {
    function handleHashChange() {
      setRoute(window.location.hash.slice(1) || '/');
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const base = (route.split('?')[0]) || route;
    const titles: Record<string, string> = {
      '/': '',
      '/pvp': 'Player vs Player',
      '/pvc': 'Player vs Computer',
      '/online': 'Online Multiplayer',
    };
    const pageTitle = titles[base] || '';
    document.title = `Kids Battleships${pageTitle ? ` - ${pageTitle}` : ''}`;
  }, [route]);

  function navigate(path: string) {
    window.location.hash = path;
  }

  const baseRoute = (route.split('?')[0]) || route;
  const query = (() => {
    const q = route.includes('?') ? route.split('?')[1] : '';
    return new URLSearchParams(q);
  })();

  if (baseRoute === '/pvp') {
    return <LocalGameManager onBack={() => navigate('/')} />;
  }
  if (baseRoute === '/pvc') {
    return <ComputerGameManager onBack={() => navigate('/')} difficulty={difficulty} />;
  }
  if (baseRoute === '/online') {
    const roomParam = query.get('room');
    const room = roomParam ? normalizeRoomCode(roomParam) : undefined;
    const role = (query.get('role') as 'player' | 'spectator' | null) || undefined;
    const asPlayer = query.get('as');
    const initialPlayer = asPlayer === '1' ? 1 : asPlayer === '2' ? 2 : undefined;
    return (
      <OnlineGameManager
        onBack={() => navigate('/')}
        initialPlayerName=""
        initialRoomCode={room || null}
        initialRole={role}
        initialPlayerHint={initialPlayer}
      />
    );
  }

  return (
    <HomeView
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      onNavigate={navigate}
    />
  );
}

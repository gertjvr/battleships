import React, { useEffect, useState } from 'react';
import LocalGameManager from './managers/LocalGameManager';
import ComputerGameManager from './managers/ComputerGameManager';
import OnlineGameManager from './multiplayer/OnlineGameManager';
import HomeView from './views/HomeView';
import type { Difficulty } from './persistence';

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
    let title = 'Kids Battleships';
    if (route === '/pvp') title += ' - Player vs Player';
    else if (route === '/pvc') title += ' - Player vs Computer';
    else if (route === '/online') title += ' - Online';
    document.title = title;
  }, [route]);

  function navigate(path: string) {
    window.location.hash = path;
  }

  if (route === '/pvp') {
    return <LocalGameManager onBack={() => navigate('/')} />;
  }
  if (route === '/pvc') {
    return <ComputerGameManager onBack={() => navigate('/')} difficulty={difficulty} />;
  }
  if (route === '/online') {
    return <OnlineGameManager onBack={() => navigate('/')} initialPlayerName="" />;
  }

  return (
    <HomeView
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      onNavigate={navigate}
    />
  );
}

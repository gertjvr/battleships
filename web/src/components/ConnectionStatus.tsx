import React from 'react';
import { formatRoomCode } from '../utils/roomCode';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected';
  player: 1 | 2 | null;
  roomCode: string;
  error: string | null;
  p1Ready?: boolean;
  p2Ready?: boolean;
  playerNames?: { [key: number]: string };
  isSpectator?: boolean;
  spectatorCount?: number;
}

export default function ConnectionStatus({ status, player, roomCode, error, p1Ready, p2Ready, playerNames, isSpectator, spectatorCount }: ConnectionStatusProps) {
  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        if (isSpectator) {
          return `Connected as Spectator ${spectatorCount || ''}`;
        }
        return `Connected as Player ${player}`;
      case 'disconnected':
        return error || 'Disconnected';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100';
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
        return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-2 ${getStatusClass()}`}>
      <div className="w-2 h-2 rounded-full bg-current"></div>
      <div className="status-text">{getStatusText()}</div>
      <div className="text-gray-500">({formatRoomCode(roomCode)})</div>
    </div>
  );
}
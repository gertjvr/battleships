import React from 'react';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected';
  player: 1 | 2 | null;
  roomCode: string;
  error: string | null;
}

export default function ConnectionStatus({ status, player, roomCode, error }: ConnectionStatusProps) {
  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return `Connected as Player ${player}`;
      case 'disconnected':
        return error || 'Disconnected';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'connecting':
        return 'status-connecting';
      case 'connected':
        return 'status-connected';
      case 'disconnected':
        return 'status-disconnected';
    }
  };

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <div className="status-indicator"></div>
      <div className="status-info">
        <div className="status-text">{getStatusText()}</div>
        <div className="room-code">Room: {roomCode}</div>
      </div>
    </div>
  );
}
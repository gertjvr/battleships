import React, { useState } from 'react';
import {
  generateRoomCode,
  formatRoomCode,
  normalizeRoomCode
} from '../utils/roomCode';

interface RoomSetupProps {
  onCreateRoom: (roomCode: string) => void;
  onJoinRoom: (roomCode: string) => void;
  onSpectate: (roomCode: string) => void;
}

export default function RoomSetup({ onCreateRoom, onJoinRoom, onSpectate }: RoomSetupProps) {
  const [mode, setMode] = useState<'create' | 'join' | 'spectate'>('create');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    const code = generateRoomCode();
    onCreateRoom(code);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(roomCode);
    if (code.length === 6) {
      onJoinRoom(code);
    }
  };

  const handleSpectate = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(roomCode);
    if (code.length === 6) {
      onSpectate(code);
    }
  };


  return (
    <div className="room-setup">
      <div className="mode-tabs">
        <button 
          className={mode === 'create' ? 'active' : ''}
          onClick={() => setMode('create')}
        >
          Create Room
        </button>
        <button 
          className={mode === 'join' ? 'active' : ''}
          onClick={() => setMode('join')}
        >
          Join Room
        </button>
        <button 
          className={mode === 'spectate' ? 'active' : ''}
          onClick={() => setMode('spectate')}
        >
          Spectate
        </button>
      </div>

      {mode === 'create' ? (
        <div className="create-room">
          <p>Create a new game room and share the code with another player</p>
          <button onClick={handleCreate} className="create-button">
            Create Room
          </button>
        </div>
      ) : mode === 'join' ? (
        <div className="join-room">
          <p>Enter the room code shared by another player</p>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                const norm = normalizeRoomCode(e.target.value);
                setRoomCode(formatRoomCode(norm));
              }}
              placeholder="Enter room code"
              maxLength={7}
              pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
              className="room-input"
            />
            <button
              type="submit"
              disabled={normalizeRoomCode(roomCode).length !== 6}
              className="btn"
            >
              Join Room
            </button>
          </form>
        </div>
      ) : (
        <div className="spectate-room">
          <p>Watch an ongoing game by entering the room code</p>
          <form onSubmit={handleSpectate}>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                const norm = normalizeRoomCode(e.target.value);
                setRoomCode(formatRoomCode(norm));
              }}
              placeholder="Enter room code"
              maxLength={7}
              pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
              className="room-input"
            />
            <button
              type="submit"
              disabled={normalizeRoomCode(roomCode).length !== 6}
              className="btn"
            >
              Spectate Game
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

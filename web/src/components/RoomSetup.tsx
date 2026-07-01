import React, { useState } from 'react';
import { Eye, LogIn, Plus } from 'lucide-react';
import {
  generateRoomCode,
  formatRoomCode,
  normalizeRoomCode
} from '../utils/roomCode';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface RoomSetupProps {
  onCreateRoom: (roomCode: string) => void;
  onJoinRoom: (roomCode: string) => void;
  onSpectate: (roomCode: string) => void;
}

export default function RoomSetup({ onCreateRoom, onJoinRoom, onSpectate }: RoomSetupProps) {
  const [mode, setMode] = useState<'create' | 'join' | 'spectate'>('create');
  const [roomCode, setRoomCode] = useState('');
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const canSubmitCode = normalizedRoomCode.length === 6;

  const handleCreate = () => {
    const code = generateRoomCode();
    onCreateRoom(code);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmitCode) {
      onJoinRoom(normalizedRoomCode);
    }
  };

  const handleSpectate = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmitCode) {
      onSpectate(normalizedRoomCode);
    }
  };

  const renderRoomCodeInput = (id: string) => (
    <div className="space-y-2 text-left">
      <Label htmlFor={id}>Room code</Label>
      <Input
        id={id}
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(formatRoomCode(e.target.value))}
        placeholder="ABC-123"
        maxLength={7}
        pattern="[A-Z0-9]{3}-[A-Z0-9]{3}"
        autoComplete="off"
        className="h-11 font-mono text-base uppercase tracking-widest"
      />
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-xl rounded-lg">
      <CardHeader className="text-center">
        <CardTitle>Online Multiplayer</CardTitle>
        <CardDescription>Create a room, join a friend, or watch a game.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="gap-4">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="create" className="min-h-10">Create</TabsTrigger>
            <TabsTrigger value="join" className="min-h-10">Join</TabsTrigger>
            <TabsTrigger value="spectate" className="min-h-10">Watch</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Start a new game room and share the code with another player.
            </p>
            <Button onClick={handleCreate} size="lg" className="w-full sm:w-auto">
              <Plus />
              Create Room
            </Button>
          </TabsContent>

          <TabsContent value="join">
            <form onSubmit={handleJoin} className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Enter the room code shared by another player.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                {renderRoomCodeInput('join-room-code')}
                <Button type="submit" disabled={!canSubmitCode} size="lg" className="w-full whitespace-nowrap sm:w-auto">
                  <LogIn />
                  Join
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="spectate">
            <form onSubmit={handleSpectate} className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Watch an ongoing game with a room code.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                {renderRoomCodeInput('watch-room-code')}
                <Button type="submit" disabled={!canSubmitCode} size="lg" className="w-full whitespace-nowrap sm:w-auto">
                  <Eye />
                  Watch
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

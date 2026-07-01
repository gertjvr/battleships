import React from 'react';
import { Check, Copy } from 'lucide-react';
import { formatRoomCode } from '../utils/roomCode';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

type Props = {
  roomCode: string;
  copied?: boolean;
  onCopy?: () => void;
};

export default function RoomCodePanel({ roomCode, copied = false, onCopy }: Props) {
  return (
    <Card className="rounded-lg border-sky-200 py-0 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room code</div>
          <div className="font-mono text-2xl font-extrabold tracking-widest text-foreground">
            {formatRoomCode(roomCode)}
          </div>
        </div>
        {onCopy && (
          <Button variant="outline" onClick={onCopy} className="w-full whitespace-nowrap sm:w-auto">
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

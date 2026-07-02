import React from 'react';
import { Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected';
  player: 1 | 2 | null;
  error: string | null;
  p1Ready?: boolean;
  p2Ready?: boolean;
  playerNames?: { [key: number]: string };
  isSpectator?: boolean;
  spectatorCount?: number;
  className?: string;
}

export default function ConnectionStatus({
  status,
  error,
  isSpectator,
  spectatorCount,
  className,
}: ConnectionStatusProps) {
  const statusText = (() => {
    if (status === 'connecting') return 'Connecting';
    if (status === 'disconnected') return error || 'Disconnected';
    if (isSpectator) return spectatorCount ? `Spectating (${spectatorCount})` : 'Spectating';
    return 'Connected';
  })();

  const tone = (() => {
    if (status === 'connected') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (status === 'connecting') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-red-200 bg-red-50 text-red-800';
  })();

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant="outline" className={cn('gap-2 px-3 py-1', tone)}>
        <Circle className="size-2 fill-current" />
        {statusText}
      </Badge>
    </div>
  );
}

import React from 'react';
import { Home, RotateCcw, Volume2 } from 'lucide-react';
import HelpPopover from './HelpPopover';
import { Button } from './ui/button';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  onReset?: () => void;
  resetLabel?: string;
  audioReady?: boolean;
  onEnableAudio?: () => void | Promise<void>;
  children?: React.ReactNode;
};

export default function GameHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Menu',
  onReset,
  resetLabel = 'Restart',
  audioReady = true,
  onEnableAudio,
  children,
}: Props) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {!audioReady && onEnableAudio && (
          <Button variant="outline" size="sm" onClick={onEnableAudio} className="whitespace-nowrap">
            <Volume2 />
            Sound
          </Button>
        )}
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset} className="whitespace-nowrap">
            <RotateCcw />
            {resetLabel}
          </Button>
        )}
        <HelpPopover />
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="whitespace-nowrap">
            <Home />
            {backLabel}
          </Button>
        )}
      </div>
    </header>
  );
}

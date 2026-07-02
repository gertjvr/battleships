import React from 'react';
import Grid from '../components/Grid';
import ChatHistory, { ChatEntry } from '../components/ChatHistory';
import { Button } from '../components/ui/button';
import type { Ship } from '@app/engine';

type Props = {
  currentPlayer: 1 | 2;
  currentPlayerName?: string;
  meLabel?: string;
  themLabel?: string;
  opponentFleet: Ship[];
  attackerShots: Set<string>;
  onFire: (r: number, c: number) => void;
  ownFleet: Ship[];
  opponentShots: Set<string>;
  banner?: string;
  lastAttackerShot?: string | null;
  lastOpponentShot?: string | null;
  sunkOnOpponent?: Set<string> | null;
  sunkOnSelf?: Set<string> | null;
  sinkingOnOpponent?: Set<string> | null;
  sinkingOnSelf?: Set<string> | null;
  disabled?: boolean;
  ctaLabel?: string | null;
  ctaMessage?: string | null;
  onCta?: () => void;
  lastSunkOnOpponent?: Set<string> | null;
  lastSunkOnSelf?: Set<string> | null;
  statusSlot?: React.ReactNode;
};

export default function PlayView({ currentPlayer, currentPlayerName, meLabel, themLabel, opponentFleet, attackerShots, onFire, ownFleet, opponentShots, banner, lastAttackerShot, lastOpponentShot, sunkOnOpponent, sunkOnSelf, sinkingOnOpponent, sinkingOnSelf, disabled, ctaLabel, ctaMessage, onCta, lastSunkOnOpponent, lastSunkOnSelf, statusSlot, chat }: Props & { chat?: ChatEntry[] }) {
  const isComputer = !!(currentPlayerName && /computer/i.test(currentPlayerName));
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{currentPlayerName ? currentPlayerName : `Player ${currentPlayer}`}</h1>
        {statusSlot && <div className="shrink-0">{statusSlot}</div>}
      </div>
      {(() => {
        const has = !!banner;
        const thinking = has && /computer is thinking/i.test(banner!);
        const cls = `rounded-md border px-4 py-3 text-sm font-medium ${thinking ? 'border-amber-200 bg-amber-50 text-amber-900 animate-pulse' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`;
        return (
          <div className={has ? cls : cls + ' invisible'}>
            {banner || ' '}
          </div>
        );
      })()}
      <div className="grid gap-6 md:grid-cols-2">
        {!isComputer && (
        <div>
          <h2 className="font-semibold mb-2">Your Guesses</h2>
          <div className="overflow-auto">
            <Grid
              mode="fire"
              opponentFleet={opponentFleet}
              shots={attackerShots}
              highlightKey={lastAttackerShot ?? undefined}
              sinkingKeys={sinkingOnOpponent ?? undefined}
              sunkKeys={sunkOnOpponent ?? undefined}
              lastSunkKeys={lastSunkOnOpponent ?? undefined}
              disabled={disabled}
              onCell={({ r, c }) => onFire(r, c)}
            />
          </div>
        </div>
        )}
        <div>
          <h2 className="font-semibold mb-2">Your Fleet (status)</h2>
          <div className="overflow-auto">
            <Grid
              mode="display"
              fleet={ownFleet}
              shots={opponentShots}
              showShips={!(currentPlayerName && /computer/i.test(currentPlayerName))}
              highlightKey={lastOpponentShot ?? undefined}
              sunkKeys={sunkOnSelf ?? undefined}
              lastSunkKeys={lastSunkOnSelf ?? undefined}
              sinkingKeys={sinkingOnSelf ?? undefined}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
      {ctaLabel && (
        <div className="space-y-2">
          {ctaMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {ctaMessage}
            </div>
          )}
          <Button onClick={onCta} disabled={!onCta}>{ctaLabel}</Button>
        </div>
      )}
      {chat && chat.length > 0 && (
        <ChatHistory entries={chat} title="Turn History" meLabel={meLabel} themLabel={themLabel} />
      )}
    </div>
  );
}

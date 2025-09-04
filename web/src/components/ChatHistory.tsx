import React, { useMemo } from 'react';

export type ChatEntry = {
  who: 'me' | 'them' | 'system';
  text: string;
  key?: string | number;
};

export default function ChatHistory({ entries, title = 'History', meLabel = 'P1', themLabel = 'P2' }: { entries: ChatEntry[]; title?: string; meLabel?: string; themLabel?: string }) {

  const grouped = useMemo(() => {
    return entries.map((e, i, arr) => {
      const prev = arr[i - 1];
      const next = arr[i + 1];
      const firstOfGroup = !prev || prev.who !== e.who || e.who === 'system';
      const lastOfGroup = !next || next.who !== e.who || e.who === 'system';
      return { ...e, firstOfGroup, lastOfGroup } as ChatEntry & { firstOfGroup: boolean; lastOfGroup: boolean };
    });
  }, [entries]);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="rounded-xl border border-slate-300 bg-white p-3 h-64 overflow-auto flex flex-col">
        <div className="mt-auto space-y-1">
          {grouped.map((e, i) => {
            if (e.who === 'system') {
              return (
                <div key={e.key ?? i} className="text-center text-xs text-slate-500">
                  {e.text}
                </div>
              );
            }
            const isMe = e.who === 'me';
            const bubbleBase = isMe
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-900';
            const align = isMe ? 'justify-end' : 'justify-start';
            const radius = isMe
              ? `${e.firstOfGroup ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${e.lastOfGroup ? 'rounded-br-2xl' : 'rounded-br-md'} rounded-tl-2xl rounded-bl-2xl`
              : `${e.firstOfGroup ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${e.lastOfGroup ? 'rounded-bl-2xl' : 'rounded-bl-md'} rounded-tr-2xl rounded-br-2xl`;
            const isSunk = typeof e.text === 'string' && e.text.startsWith('Sunk:');
            return (
              <div key={e.key ?? i} className={`flex items-end ${align} gap-1`}>
                {!isMe && (e.lastOfGroup || isSunk) && (
                  <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] select-none ring-1 ring-slate-300">{themLabel}</div>
                )}
                <div className={`max-w-[80%] px-3 py-2 text-sm shadow ${bubbleBase} ${radius}`}>
                  {e.text}
                </div>
                {isMe && (e.lastOfGroup || isSunk) && (
                  <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] select-none ring-1 ring-blue-300">{meLabel}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

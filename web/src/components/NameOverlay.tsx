import React, { useEffect, useRef, useState } from 'react';

export default function NameOverlay({
  which,
  onSubmit,
}: {
  which: 1 | 2;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="overlay">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Enter Player {which} Name</h1>
        <input
          ref={inputRef}
          className="w-full border border-slate-300 rounded-lg px-4 py-2 text-lg"
          placeholder={`Player ${which}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()); }}
        />
        <button className="btn w-full" disabled={!name.trim()} onClick={() => name.trim() && onSubmit(name.trim())}>
          Continue
        </button>
      </div>
    </div>
  );
}


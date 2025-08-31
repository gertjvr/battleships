import React from 'react';

type Props = {
  shown: boolean;
  message: string;
  onReady: () => void;
};

export default function SwapOverlay({ shown, message, onReady }: Props) {
  if (!shown) return null;
  return (
    <div className="overlay">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold">{message}</h1>
        <button className="btn" onClick={onReady} autoFocus>Ready</button>
      </div>
    </div>
  );
}


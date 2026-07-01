import React from 'react';
import { Button } from './ui/button';

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
        <Button onClick={onReady} autoFocus size="lg">Ready</Button>
      </div>
    </div>
  );
}

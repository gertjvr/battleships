import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);

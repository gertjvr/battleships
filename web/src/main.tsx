import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App';
import './index.css';

const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || '');
const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ConvexProvider client={client}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);


import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VisuApp } from './VisuApp';
import './index.css';

console.log('[Wiresheet Visu] Version 2025-03-14 loaded');

createRoot(document.getElementById('visu-root')!).render(
  <StrictMode>
    <VisuApp />
  </StrictMode>
);

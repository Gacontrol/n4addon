import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VisuApp } from './VisuApp';
import './index.css';

createRoot(document.getElementById('visu-root')!).render(
  <StrictMode>
    <VisuApp />
  </StrictMode>
);

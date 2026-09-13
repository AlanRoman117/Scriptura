import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyPrefs, loadPrefs } from './lib/prefs';
import './styles.css';

// The inline script in index.html has already set the theme; this applies the
// full set (the custom properties as well) before anything renders, so the
// first frame React paints is the one the reader asked for.
applyPrefs(loadPrefs());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

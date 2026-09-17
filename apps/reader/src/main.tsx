import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Announcer } from './lib/announce';
import { UpdateNotice } from './components/UpdateNotice';
import { ConfirmProvider } from './components/ConfirmDialog';
import { applyPrefs, loadPrefs } from './lib/prefs';
import { I18nRoot } from './i18n/root';
import './styles.css';

// The inline script in index.html has already set the theme; this applies the
// full set (the custom properties as well) before anything renders, so the
// first frame React paints is the one the reader asked for.
applyPrefs(loadPrefs());

// The live regions sit beside the app, not inside it: App returns early while
// it boots, and a region that appears after load is not announced. The
// confirmation dialog is one for the whole app, rendered after it.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nRoot>
      <Announcer />
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
      <UpdateNotice />
    </I18nRoot>
  </StrictMode>
);

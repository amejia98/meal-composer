import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { supabase } from './lib/supabase';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Test hook, dev builds only — never ships in the production bundle. The
// e2e suite drives real clicks and reaches in here only to assert, mirroring
// the old window.__souschef pattern.
if (import.meta.env.DEV) {
  (window as unknown as { __mealComposer: unknown }).__mealComposer = { supabase };
}

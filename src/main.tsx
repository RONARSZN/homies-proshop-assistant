import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { InstallPrompt } from './InstallPrompt';
import { UpdateBanner } from './UpdateBanner';
import './styles.css';
/* After styles.css on purpose. The inventory sheet overrides shared rules
   (.product-group-grid columns, the pinned .product-buy-actions bar) at equal
   specificity, so it has to be the later sheet. Importing it from App.tsx put
   it first, because App is imported above. */
import './inventory.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <InstallPrompt />
      <UpdateBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

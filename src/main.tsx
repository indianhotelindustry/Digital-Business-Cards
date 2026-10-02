import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { ENVIRONMENT_ERROR } from './lib/environment';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (ENVIRONMENT_ERROR) {
  // Directive 27: a bundle without a valid, designated environment never
  // starts the app (and never connects to Firebase); it fails closed.
  console.error(ENVIRONMENT_ERROR);
  root.render(
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 560, margin: '64px auto' }} data-testid="environment-error">
      <h1 style={{ fontSize: 18 }}>This deployment is misconfigured</h1>
      <p style={{ fontSize: 13, color: '#475569' }}>The application was not started. Please contact the platform owner.</p>
    </div>
  );
} else {
  // Loaded only after the environment is known to be valid, so Firebase is
  // never initialised for an unknown target.
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}

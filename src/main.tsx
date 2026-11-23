import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import 'lenis/dist/lenis.css';
import './index.css';
import App from './App.tsx';
import { LanguageProvider } from './components/LanguageProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LanguageProvider>
  </StrictMode>,
);

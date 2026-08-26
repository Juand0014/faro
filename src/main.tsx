import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    const url = e.data?.url;
    if (e.data?.type !== 'faro-open' || typeof url !== 'string') return;
    try {
      const hash = new URL(url, location.href).hash;
      if (hash) location.hash = hash;
    } catch { /* ignore */ }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js?v=12').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

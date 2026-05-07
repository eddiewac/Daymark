import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import { initThemeSystem } from './lib/theme.js';

// Apply saved theme before React renders to avoid a flash of unthemed content
initThemeSystem();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

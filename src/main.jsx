import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Capturar el evento de instalación lo antes posible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const setAppViewportHeight = () => {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
};

setAppViewportHeight();
window.addEventListener('resize', setAppViewportHeight);
window.visualViewport?.addEventListener('resize', setAppViewportHeight);
window.visualViewport?.addEventListener('scroll', setAppViewportHeight);

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch((error) => console.warn('Failed to unregister dev service worker', error));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

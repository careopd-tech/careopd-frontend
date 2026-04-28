import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

let stableViewportHeight = window.innerHeight;

const setAppViewportHeight = () => {
  stableViewportHeight = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${stableViewportHeight}px`);
};

const setKeyboardViewportState = () => {
  const visualViewportHeight = window.visualViewport?.height || window.innerHeight;
  const keyboardHeight = Math.max(0, stableViewportHeight - visualViewportHeight - (window.visualViewport?.offsetTop || 0));
  const isKeyboardOpen = keyboardHeight > 120;

  document.documentElement.style.setProperty('--keyboard-height', `${isKeyboardOpen ? keyboardHeight : 0}px`);
  document.body.classList.toggle('keyboard-open', isKeyboardOpen);
};

setAppViewportHeight();
setKeyboardViewportState();
window.addEventListener('resize', () => {
  if (!document.body.classList.contains('keyboard-open')) {
    setAppViewportHeight();
  }
  setKeyboardViewportState();
});
window.visualViewport?.addEventListener('resize', setKeyboardViewportState);
window.visualViewport?.addEventListener('scroll', setKeyboardViewportState);

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

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

let stableViewportHeight = window.innerHeight;
let viewportStateEnabled = false;

const blurStartupFocus = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const setAppViewportHeight = () => {
  stableViewportHeight = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${stableViewportHeight}px`);
};

const setKeyboardViewportState = () => {
  if (!viewportStateEnabled) return;

  const visualViewportHeight = window.visualViewport?.height || window.innerHeight;
  const keyboardHeight = Math.max(0, stableViewportHeight - visualViewportHeight - (window.visualViewport?.offsetTop || 0));
  const isKeyboardOpen = keyboardHeight > 120;

  document.documentElement.style.setProperty('--keyboard-height', `${isKeyboardOpen ? keyboardHeight : 0}px`);
  document.body.classList.toggle('keyboard-open', isKeyboardOpen);
};

setAppViewportHeight();
blurStartupFocus();
window.setTimeout(blurStartupFocus, 250);
window.setTimeout(() => {
  viewportStateEnabled = true;
  setKeyboardViewportState();
}, 700);
window.addEventListener('resize', () => {
  if (!viewportStateEnabled) return;

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

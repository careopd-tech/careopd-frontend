import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const KEYBOARD_OPEN_THRESHOLD = 120;
const VIEWPORT_SYNC_DELAY_MS = 700;

let stableViewportHeight = window.visualViewport?.height || window.innerHeight;
let viewportStateEnabled = false;
let viewportRaf = 0;

const blurStartupFocus = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const getVisibleViewportHeight = () => (
  window.visualViewport?.height || window.innerHeight
);

const isTextInputFocused = () => (
  document.activeElement instanceof HTMLElement
  && document.activeElement.matches('input, textarea, select, [contenteditable="true"]')
);

const setAppViewportHeight = (height = stableViewportHeight) => {
  const roundedHeight = Math.round(height);
  stableViewportHeight = roundedHeight;
  document.documentElement.style.setProperty('--app-height', `${roundedHeight}px`);
};

const setKeyboardViewportState = () => {
  if (!viewportStateEnabled) return;

  const visualViewportHeight = getVisibleViewportHeight();
  const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
  const keyboardHeight = Math.max(0, stableViewportHeight - visualViewportHeight - viewportOffsetTop);
  const isKeyboardOpen = isTextInputFocused() && keyboardHeight > KEYBOARD_OPEN_THRESHOLD;

  document.documentElement.style.setProperty('--keyboard-height', `${isKeyboardOpen ? keyboardHeight : 0}px`);
  document.body.classList.toggle('keyboard-open', isKeyboardOpen);

  if (!isKeyboardOpen) {
    setAppViewportHeight(visualViewportHeight);
  }
};

const scheduleViewportSync = () => {
  window.cancelAnimationFrame(viewportRaf);
  viewportRaf = window.requestAnimationFrame(setKeyboardViewportState);
};

setAppViewportHeight(getVisibleViewportHeight());
blurStartupFocus();
window.setTimeout(blurStartupFocus, 250);
window.setTimeout(() => {
  viewportStateEnabled = true;
  setKeyboardViewportState();
}, VIEWPORT_SYNC_DELAY_MS);
window.addEventListener('resize', scheduleViewportSync);
window.addEventListener('orientationchange', () => {
  viewportStateEnabled = false;
  window.setTimeout(() => {
    setAppViewportHeight(getVisibleViewportHeight());
    viewportStateEnabled = true;
    setKeyboardViewportState();
  }, 250);
});
window.visualViewport?.addEventListener('resize', scheduleViewportSync);
window.visualViewport?.addEventListener('scroll', scheduleViewportSync);

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

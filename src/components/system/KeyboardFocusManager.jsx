import { useEffect } from 'react';

const FOCUSABLE_FORM_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const KEYBOARD_SCROLL_PADDING = 18;

const isMobilePointer = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
};

const isScrollable = (element) => {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
};

const findScrollContainer = (target) => {
  let element = target instanceof Element ? target.parentElement : null;

  while (element && element !== document.body) {
    if (isScrollable(element)) return element;
    element = element.parentElement;
  }

  return document.scrollingElement || document.documentElement;
};

const getVisibleViewport = () => {
  const viewport = window.visualViewport;

  return {
    top: viewport?.offsetTop || 0,
    bottom: (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight),
  };
};

const scrollFocusedFieldIntoView = (target) => {
  if (!(target instanceof HTMLElement) || !target.matches(FOCUSABLE_FORM_SELECTOR)) return;
  if (!isMobilePointer()) return;

  const scrollContainer = findScrollContainer(target);
  const viewport = getVisibleViewport();
  const targetRect = target.getBoundingClientRect();
  const label = target.id ? document.querySelector(`label[for="${CSS.escape(target.id)}"]`) : null;
  const labelRect = label?.getBoundingClientRect();
  const desiredTop = Math.min(labelRect?.top ?? targetRect.top, targetRect.top) - KEYBOARD_SCROLL_PADDING;
  const desiredBottom = targetRect.bottom + KEYBOARD_SCROLL_PADDING;
  const overshootBottom = desiredBottom - viewport.bottom;
  const overshootTop = viewport.top - desiredTop;

  if (overshootBottom <= 0 && overshootTop <= 0) return;

  const delta = overshootBottom > 0 ? overshootBottom : -overshootTop;

  if (scrollContainer === document.scrollingElement || scrollContainer === document.documentElement) {
    window.scrollBy({ top: delta, behavior: 'smooth' });
    return;
  }

  scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
};

const KeyboardFocusManager = () => {
  useEffect(() => {
    let focusTimer;

    const handleFocusIn = (event) => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => scrollFocusedFieldIntoView(event.target), 300);
    };

    const handleViewportChange = () => {
      const activeElement = document.activeElement;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => scrollFocusedFieldIntoView(activeElement), 120);
    };

    document.addEventListener('focusin', handleFocusIn);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('focusin', handleFocusIn);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return null;
};

export default KeyboardFocusManager;

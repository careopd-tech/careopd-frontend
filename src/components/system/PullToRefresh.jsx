import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const TRIGGER_DISTANCE = 88;
const MAX_PULL_DISTANCE = 128;

const isMobilePointer = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
};

const isScrollable = (element) => {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return /(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight;
};

const findScrollContainer = (target) => {
  let element = target instanceof Element ? target : null;

  while (element && element !== document.body) {
    if (isScrollable(element)) return element;
    element = element.parentElement;
  }

  return document.scrollingElement || document.documentElement;
};

const getScrollTop = (element) => {
  if (element === document.scrollingElement || element === document.documentElement) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  return element?.scrollTop || 0;
};

const PullToRefresh = () => {
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const scrollTargetRef = useRef(null);
  const canPullRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updatePullDistance = (distance) => {
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };

    const resetPull = () => {
      canPullRef.current = false;
      scrollTargetRef.current = null;
      updatePullDistance(0);
    };

    const handleTouchStart = (event) => {
      if (!isMobilePointer() || event.touches.length !== 1 || isRefreshing) return;

      const touch = event.touches[0];
      const scrollTarget = findScrollContainer(event.target);

      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      scrollTargetRef.current = scrollTarget;
      canPullRef.current = getScrollTop(scrollTarget) <= 1;
    };

    const handleTouchMove = (event) => {
      if (!canPullRef.current || event.touches.length !== 1 || isRefreshing) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = Math.abs(touch.clientX - startXRef.current);

      if (deltaY <= 0 || deltaX > deltaY || getScrollTop(scrollTargetRef.current) > 1) {
        resetPull();
        return;
      }

      const dampedDistance = Math.min(deltaY * 0.55, MAX_PULL_DISTANCE);
      updatePullDistance(dampedDistance);

      if (dampedDistance > 8) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!canPullRef.current || isRefreshing) {
        resetPull();
        return;
      }

      if (pullDistanceRef.current >= TRIGGER_DISTANCE) {
        setIsRefreshing(true);
        updatePullDistance(TRIGGER_DISTANCE);
        window.dispatchEvent(new Event('careopd:check-app-update'));

        navigator.serviceWorker?.getRegistration()
          .then((registration) => registration?.update())
          .catch((error) => console.log('SW update check before refresh failed', error))
          .finally(() => window.location.reload());
        return;
      }

      resetPull();
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', resetPull);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, [isRefreshing]);

  const progress = Math.min(pullDistance / TRIGGER_DISTANCE, 1);
  const isVisible = pullDistance > 0 || isRefreshing;

  if (!isVisible) return null;

  return (
    <div
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[10001] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-teal-600 shadow-lg ring-1 ring-slate-200 transition-transform"
      style={{ transform: `translate(-50%, ${Math.max(0, pullDistance - 48)}px) scale(${0.82 + progress * 0.18})` }}
      aria-hidden="true"
    >
      {isRefreshing ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <RefreshCw size={18} style={{ transform: `rotate(${progress * 180}deg)` }} />
      )}
    </div>
  );
};

export default PullToRefresh;

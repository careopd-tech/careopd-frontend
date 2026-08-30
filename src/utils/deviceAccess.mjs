const MOBILE_USER_AGENT = /Android.*Mobile|iPhone|iPod|IEMobile|Windows Phone|BlackBerry|Opera Mini|webOS/i;

export const isMobilePhone = ({ navigatorObject = globalThis.navigator, windowObject = globalThis.window } = {}) => {
  if (navigatorObject?.userAgentData?.mobile === true) return true;
  if (MOBILE_USER_AGENT.test(navigatorObject?.userAgent || '')) return true;

  const hasCoarsePointer = windowObject?.matchMedia?.('(pointer: coarse)')?.matches === true;
  const hasTouchInput = Number(navigatorObject?.maxTouchPoints || 0) > 0 && hasCoarsePointer;
  const shortestScreenSide = Math.min(
    windowObject?.screen?.width || windowObject?.innerWidth || Number.POSITIVE_INFINITY,
    windowObject?.screen?.height || windowObject?.innerHeight || Number.POSITIVE_INFINITY
  );
  return hasTouchInput && shortestScreenSide <= 767;
};

export const isPortraitOrientation = ({ windowObject = globalThis.window } = {}) => {
  const orientationType = windowObject?.screen?.orientation?.type;
  if (orientationType) return orientationType.startsWith('portrait');
  if (typeof windowObject?.orientation === 'number') return Math.abs(windowObject.orientation) !== 90;
  return Number(windowObject?.innerHeight || 0) >= Number(windowObject?.innerWidth || 0);
};

export const getDeviceAccessState = (environment) => ({
  isMobile: isMobilePhone(environment),
  isPortrait: isPortraitOrientation(environment)
});

import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let updateCheckIntervalId;

function UpdatePrompt() {
  const registrationRef = useRef(null);

  const checkForServiceWorkerUpdate = () => {
    const registration = registrationRef.current;
    if (!registration) return;

    registration.update().catch((error) => console.log('SW update check failed', error));
  };

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swScriptUrl, registration) {
      console.log('SW Registered', swScriptUrl);
      registrationRef.current = registration || null;

      if (updateCheckIntervalId) {
        window.clearInterval(updateCheckIntervalId);
      }

      if (registration) {
        window.setTimeout(checkForServiceWorkerUpdate, 1000);

        updateCheckIntervalId = window.setInterval(() => {
          registration.update().catch((error) => console.log('SW update check failed', error));
        }, UPDATE_CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForServiceWorkerUpdate();
      }
    };

    window.addEventListener('focus', checkForServiceWorkerUpdate);
    window.addEventListener('online', checkForServiceWorkerUpdate);
    window.addEventListener('careopd:check-app-update', checkForServiceWorkerUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', checkForServiceWorkerUpdate);
      window.removeEventListener('online', checkForServiceWorkerUpdate);
      window.removeEventListener('careopd:check-app-update', checkForServiceWorkerUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // If there's an update, show a persistent floating toast
  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:bottom-6 z-[10000] animate-slideUp w-[calc(100%-2rem)] max-w-[320px]">
        <div className="bg-white rounded-xl shadow-2xl border border-teal-100 p-4 max-w-[320px] w-full flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-800 leading-tight">Update Available</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Please update to latest version and continue.</p>
            </div>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-bold py-2 rounded-lg transition-colors shadow-sm"
          >
            Update Now
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default UpdatePrompt;

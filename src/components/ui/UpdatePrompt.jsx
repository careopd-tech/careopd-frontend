import React, { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_SUCCESS_FLAG = 'careopd:app-updated';
let updateCheckIntervalId;

function UpdatePrompt() {
  const registrationRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdatedNotice, setShowUpdatedNotice] = useState(false);

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
    if (!window.sessionStorage.getItem(UPDATE_SUCCESS_FLAG)) {
      return undefined;
    }

    window.sessionStorage.removeItem(UPDATE_SUCCESS_FLAG);
    setShowUpdatedNotice(true);
    successTimeoutRef.current = window.setTimeout(() => {
      setShowUpdatedNotice(false);
    }, 4000);

    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleControllerChange = () => {
      window.sessionStorage.setItem(UPDATE_SUCCESS_FLAG, String(Date.now()));
    };

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

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
      if (updateTimeoutRef.current) {
        window.clearTimeout(updateTimeoutRef.current);
      }
      window.removeEventListener('focus', checkForServiceWorkerUpdate);
      window.removeEventListener('online', checkForServiceWorkerUpdate);
      window.removeEventListener('careopd:check-app-update', checkForServiceWorkerUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);

    updateTimeoutRef.current = window.setTimeout(() => {
      setIsUpdating(false);
    }, 12000);

    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.log('SW update failed', error);
      setIsUpdating(false);
      if (updateTimeoutRef.current) {
        window.clearTimeout(updateTimeoutRef.current);
      }
    }
  };

  if (showUpdatedNotice && !needRefresh) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] animate-fadeIn w-[calc(100%-1.5rem)] max-w-[320px]">
        <div className="bg-white rounded-xl shadow-xl border border-green-100 px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 bg-green-50 text-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-slate-800 leading-tight">App Updated</h3>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">You are now on the latest CareOPD version.</p>
          </div>
        </div>
      </div>
    );
  }

  if (needRefresh) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] animate-slideUp w-[calc(100%-1.5rem)] max-w-[340px]">
        <div className="bg-white rounded-xl shadow-2xl border border-teal-100 p-4 max-w-[320px] w-full flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
              {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-800 leading-tight">
                {isUpdating ? 'Updating CareOPD' : 'Update Available'}
              </h3>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                {isUpdating
                  ? 'Downloading the latest version and refreshing your app...'
                  : 'A newer app version is ready. Update now for the latest fixes and improvements.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-bold py-2 rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating...
              </>
            ) : (
              'Update Now'
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default UpdatePrompt;

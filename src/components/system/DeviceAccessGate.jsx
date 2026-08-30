import React, { useEffect, useState } from 'react';
import { MonitorX, RotateCw, Smartphone } from 'lucide-react';
import { getDeviceAccessState } from '../../utils/deviceAccess.mjs';

const AccessMessage = ({ type }) => {
  const isLandscape = type === 'landscape';
  const Icon = isLandscape ? RotateCw : MonitorX;

  return (
    <main
      data-device-access-gate={type}
      className="min-h-dvh bg-slate-50 flex items-center justify-center p-6 text-center"
    >
      <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-7 py-9 shadow-xl shadow-slate-200/60">
        <img src="/icon_x512.png" alt="CareOPD" className="mx-auto mb-6 h-20 w-20 object-contain" />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon size={28} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {isLandscape ? 'Please rotate your phone' : 'Open CareOPD on your phone'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isLandscape
            ? 'CareOPD works in portrait mode only. Rotate your device vertically to continue.'
            : 'CareOPD is designed for mobile phones and is not available on desktop or tablet screens.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Smartphone size={16} aria-hidden="true" />
          Mobile portrait experience
        </div>
      </section>
    </main>
  );
};

const DeviceAccessGate = ({ children }) => {
  const [deviceState, setDeviceState] = useState(getDeviceAccessState);

  useEffect(() => {
    const syncDeviceState = () => setDeviceState(getDeviceAccessState());
    const orientationQuery = window.matchMedia('(orientation: portrait)');

    window.addEventListener('resize', syncDeviceState);
    window.addEventListener('orientationchange', syncDeviceState);
    orientationQuery.addEventListener?.('change', syncDeviceState);

    return () => {
      window.removeEventListener('resize', syncDeviceState);
      window.removeEventListener('orientationchange', syncDeviceState);
      orientationQuery.removeEventListener?.('change', syncDeviceState);
    };
  }, []);

  if (!deviceState.isMobile) return <AccessMessage type="desktop" />;
  if (!deviceState.isPortrait) return <AccessMessage type="landscape" />;
  return children;
};

export default DeviceAccessGate;

import React, { useState, useEffect } from 'react';
import { DateProvider } from './context/DateContext'; 
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';
import KeyboardFocusManager from './components/system/KeyboardFocusManager';
import LaunchScreen from './components/ui/LaunchScreen';
import UpdatePrompt from './components/ui/UpdatePrompt';
import Onboarding from './modules/Onboarding';


// --- MODULE IMPORTS (Unified) ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';
import {
  cacheClinicalCatalog,
  getCachedClinicalCatalog
} from './utils/clinicalCatalog';
import {
  authFetch,
  clearSession,
  logoutSession,
  maintainActiveSession,
  refreshSession,
  SESSION_EXPIRED_EVENT,
  SESSION_UPDATED_EVENT
} from './utils/auth';
import { getAvailableTabs } from './utils/permissions';
import { APP_VERSION } from './config/appVersion';

const SESSION_PERMISSION_SYNC_INTERVAL_MS = 60 * 1000;
const SESSION_PERMISSION_SYNC_MIN_GAP_MS = SESSION_PERMISSION_SYNC_INTERVAL_MS;

const getCachedClinic = () => {
  try {
    return JSON.parse(localStorage.getItem('careopd_clinic_context') || '{}');
  } catch (err) {
    return {};
  }
};

const App = () => {
  // --- AUTH & ROLE STATE ---
  const [authState, setAuthState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('activate') && params.get('email')) return 'activate';
    return localStorage.getItem('clinicId') ? 'restoring-session' : 'login';
  });
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || 'admin';
  });
  const [sessionVersion, setSessionVersion] = useState(0);
  const [authMessage, setAuthMessage] = useState('');

  // UNIFIED: Everyone defaults to the Appointments (Queue) module
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('careopd_active_tab') || 'appointments';
  });
  const [appointmentBookingPatient, setAppointmentBookingPatient] = useState(null);
  const [patientBookingNotification, setPatientBookingNotification] = useState(null);
  
  const [data, setData] = useState(() => ({
    appointments: [],
    doctors: [],
    patients: [],
    clinic: getCachedClinic(),
    clinicalCatalog: getCachedClinicalCatalog(localStorage.getItem('clinicId')),
    notifications: []
  }));

  const savedUser = (() => {
    void sessionVersion;
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (err) {
      return {};
    }
  })();

  const hasLinkedDoctor = Boolean(savedUser.doctorId || localStorage.getItem('doctorId'));
  const isSoloWorkspace = data.clinic?.type === 'Solo' || (!data.clinic?.type && hasLinkedDoctor);
  const availableTabs = getAvailableTabs({
    userRole,
    clinicType: data.clinic?.type,
    hasLinkedDoctor,
    permissions: savedUser.permissions || {}
  });
  const fallbackTab = availableTabs[0] || 'appointments';

  useEffect(() => {
    if (authState !== 'authenticated') {
      return;
    }

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    let isMounted = true;

    const fetchClinicType = async () => {
      try {
        const [clinicResponse, catalogResponse] = await Promise.all([
          authFetch(`${API_BASE_URL}/api/clinics/${clinicId}`),
          authFetch(`${API_BASE_URL}/api/clinical-catalog/${clinicId}`)
        ]);

        if (clinicResponse.ok) {
          const clinic = await clinicResponse.json();
          localStorage.setItem('careopd_clinic_context', JSON.stringify(clinic));
          if (isMounted) {
            setData(prev => ({ ...prev, clinic: { ...prev.clinic, ...clinic } }));
          }
        }

        if (catalogResponse.ok) {
          const catalog = await catalogResponse.json();
          cacheClinicalCatalog(clinicId, catalog);
          if (isMounted) {
            setData(prev => ({ ...prev, clinicalCatalog: catalog }));
          }
        }
      } catch (err) {
        console.error('Failed to load clinic context', err);
      }
    };

    fetchClinicType();

    return () => {
      isMounted = false;
    };
  }, [authState]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, availableTabs, fallbackTab]);

  useEffect(() => {
    sessionStorage.setItem('careopd_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;
    cacheClinicalCatalog(clinicId, data.clinicalCatalog);
  }, [data.clinicalCatalog]);

  const returnToLogin = (message = '') => {
    clearSession();
    setAuthMessage(message);
    setAuthState('login');
    setActiveTab('appointments');
    setUserRole('admin'); 
    setData({ appointments: [], doctors: [], patients: [], clinic: {}, clinicalCatalog: getCachedClinicalCatalog(''), notifications: [] });
  };

  const handleLogout = () => {
    logoutSession().catch(() => {});
    returnToLogin();
  };

  useEffect(() => {
    if (authState !== 'restoring-session') return;

    let isMounted = true;
    refreshSession()
      .then((result) => {
        if (!isMounted) return;
        setUserRole(result.user.role);
        setAuthMessage('');
        setAuthState('authenticated');
      })
      .catch(() => {
        if (isMounted) returnToLogin('Your session has expired. Please sign in again.');
      });

    return () => {
      isMounted = false;
    };
  }, [authState]);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      returnToLogin(event.detail?.message || 'Your session has expired. Please sign in again.');
    };
    const handleSessionUpdated = (event) => {
      if (event.detail?.user?.role) {
        setUserRole(event.detail.user.role);
      }
      setSessionVersion(version => version + 1);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    };
  }, []);

  useEffect(() => {
    if (authState !== 'authenticated') return undefined;

    let lastPermissionSyncAt = 0;

    const syncSessionPermissions = ({ force = false } = {}) => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (!force && now - lastPermissionSyncAt < SESSION_PERMISSION_SYNC_MIN_GAP_MS) return;
      lastPermissionSyncAt = now;
      refreshSession().catch(() => {});
    };

    const renewOnActivity = () => {
      maintainActiveSession();
    };

    syncSessionPermissions();
    const permissionSyncTimer = window.setInterval(
      () => syncSessionPermissions({ force: true }),
      SESSION_PERMISSION_SYNC_INTERVAL_MS
    );

    window.addEventListener('pointerdown', renewOnActivity, { passive: true });
    window.addEventListener('keydown', renewOnActivity);
    window.addEventListener('focus', syncSessionPermissions);
    document.addEventListener('visibilitychange', syncSessionPermissions);

    return () => {
      window.clearInterval(permissionSyncTimer);
      window.removeEventListener('pointerdown', renewOnActivity);
      window.removeEventListener('keydown', renewOnActivity);
      window.removeEventListener('focus', syncSessionPermissions);
      document.removeEventListener('visibilitychange', syncSessionPermissions);
    };
  }, [authState]);

  const renderWithUpdatePrompt = (content) => (
    <>
      <UpdatePrompt />
      <KeyboardFocusManager />
      {content}
    </>
  );

  if (authState === 'onboarding') {
    return renderWithUpdatePrompt(<Onboarding setAuthState={setAuthState} />);
  }

  if (authState === 'restoring-session') {
    return renderWithUpdatePrompt(
      <LaunchScreen />
    );
  }

  if (authState !== 'authenticated') {
    return renderWithUpdatePrompt(<Auth authState={authState} setAuthState={setAuthState} setUserRole={setUserRole} sessionMessage={authMessage} />);
  }

  // --- UNIFIED ROUTING ---
  let content;
  
  const effectiveActiveTab = availableTabs.includes(activeTab) ? activeTab : fallbackTab;

  if (effectiveActiveTab === 'appointments') {
    content = (
      <Appointments
        data={data}
        setData={setData}
        onLogout={handleLogout}
        bookingPatientRequest={appointmentBookingPatient}
        onBookingRequestConsumed={() => setAppointmentBookingPatient(null)}
      />
    );
  } else if (effectiveActiveTab === 'doctors') {
    content = <Doctors data={data} setData={setData} onLogout={handleLogout}/>;
  } else if (effectiveActiveTab === 'patients') {
    content = (
      <>
        <Patients
          data={data}
          setData={setData}
          onLogout={handleLogout}
          onBookAppointment={(patient) => {
            setAppointmentBookingPatient(patient);
          }}
          bookingNotification={patientBookingNotification}
          onBookingNotificationConsumed={() => setPatientBookingNotification(null)}
        />
        {appointmentBookingPatient && (
          <Appointments
            data={data}
            setData={setData}
            onLogout={handleLogout}
            bookingPatientRequest={appointmentBookingPatient}
            modalOnly
            onBookingModalClose={() => setAppointmentBookingPatient(null)}
            onBookingSuccess={(notification) => setPatientBookingNotification(notification)}
          />
        )}
      </>
    );
  } else if (effectiveActiveTab === 'settings') {
    content = <Settings data={data} setData={setData} onLogout={handleLogout} />;
  } else {
    content = <div className="p-10 text-slate-400">Tab "{effectiveActiveTab}" not found.</div>;
  }

  return renderWithUpdatePrompt(
    <>
      <DateProvider>
        <Layout
          activeTab={effectiveActiveTab}
          setActiveTab={setActiveTab}
          userRole={userRole}
          accountRole={savedUser.accountRole}
          clinicType={data.clinic?.type}
          hasLinkedDoctor={hasLinkedDoctor}
          permissions={savedUser.permissions || {}}
        >
          {content}
        </Layout>
      </DateProvider>
      
      {/* Floating Version Tag for Deployment Validation */}
      <div className="fixed bottom-1 right-2 text-[12px] font-bold text-slate-400/50 pointer-events-none z-[9999]">
        v{APP_VERSION}
      </div>
    </>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { DateProvider } from './context/DateContext'; 
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';
import KeyboardFocusManager from './components/system/KeyboardFocusManager';
import UpdatePrompt from './components/ui/UpdatePrompt';
import Onboarding from './modules/Onboarding';


// --- MODULE IMPORTS (Unified) ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';

const LaunchScreen = () => (
  <div className="app-viewport bg-slate-50 flex flex-col items-center justify-center px-4">
    <img src="/CareOPD-Logo.png" alt="CareOPD Logo" className="h-24 mb-4 object-contain" />
    <div className="w-9 h-9 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
  </div>
);

const App = () => {
  // --- AUTH & ROLE STATE ---
  const [authState, setAuthState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('activate') && params.get('email')) return 'activate';
    return localStorage.getItem('clinicId') ? 'authenticated' : 'login';
  });
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || 'admin';
  });

  // UNIFIED: Everyone defaults to the Appointments (Queue) module
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('careopd_active_tab') || 'appointments';
  });
  
  const [data, setData] = useState({
    appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] 
  });
  const [clinicContextStatus, setClinicContextStatus] = useState(() => {
    return localStorage.getItem('clinicId') ? 'loading' : 'idle';
  });

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (err) {
      return {};
    }
  })();

  const hasLinkedDoctor = Boolean(savedUser.doctorId || localStorage.getItem('doctorId'));
  const isSoloWorkspace = data.clinic?.type === 'Solo' || (!data.clinic?.type && hasLinkedDoctor);

  useEffect(() => {
    if (authState !== 'authenticated') {
      setClinicContextStatus('idle');
      return;
    }

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) {
      setClinicContextStatus('failed');
      return;
    }

    let isMounted = true;
    setClinicContextStatus('loading');

    const fetchClinicType = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}`);
        if (response.ok) {
          const clinic = await response.json();
          if (isMounted) {
            setData(prev => ({ ...prev, clinic: { ...prev.clinic, ...clinic } }));
            setClinicContextStatus('ready');
          }
        } else if (isMounted) {
          setClinicContextStatus('failed');
        }
      } catch (err) {
        console.error('Failed to load clinic context', err);
        if (isMounted) setClinicContextStatus('failed');
      }
    };

    fetchClinicType();

    return () => {
      isMounted = false;
    };
  }, [authState]);

  useEffect(() => {
    if (activeTab === 'doctors' && isSoloWorkspace) {
      setActiveTab('appointments');
    }
  }, [activeTab, isSoloWorkspace]);

  useEffect(() => {
    sessionStorage.setItem('careopd_active_tab', activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.clear(); 
    setAuthState('login');
    setActiveTab('appointments');
    setUserRole('admin'); 
    setData({ appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] });
    setClinicContextStatus('idle');
  };

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

  if (authState !== 'authenticated') {
    return renderWithUpdatePrompt(<Auth authState={authState} setAuthState={setAuthState} setUserRole={setUserRole} />);
  }

  if (clinicContextStatus === 'loading' || clinicContextStatus === 'idle') {
    return renderWithUpdatePrompt(<LaunchScreen />);
  }

  // --- UNIFIED ROUTING ---
  let content;
  
  const effectiveActiveTab = activeTab === 'doctors' && isSoloWorkspace ? 'appointments' : activeTab;

  if (effectiveActiveTab === 'appointments') {
    content = <Appointments data={data} setData={setData} onLogout={handleLogout}/>;
  } else if (effectiveActiveTab === 'doctors') {
    content = <Doctors data={data} setData={setData} onLogout={handleLogout}/>;
  } else if (effectiveActiveTab === 'patients') {
    content = <Patients data={data} setData={setData} onLogout={handleLogout} />;
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
          clinicType={data.clinic?.type}
          hasLinkedDoctor={hasLinkedDoctor}
        >
          {content}
        </Layout>
      </DateProvider>
      
      {/* Floating Version Tag for Deployment Validation */}
      <div className="fixed bottom-1 right-2 text-[10px] font-bold text-slate-400/50 pointer-events-none z-[9999]">
        v1.0.0
      </div>
    </>
  );
};

export default App;

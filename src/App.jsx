import React, { useState, useEffect } from 'react';
import { DateProvider } from './context/DateContext'; 
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';
import PullToRefresh from './components/system/PullToRefresh';
import UpdatePrompt from './components/ui/UpdatePrompt';
import Onboarding from './modules/Onboarding';


// --- MODULE IMPORTS (Unified) ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';

const App = () => {
  const [isBooting, setIsBooting] = useState(true);

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
  const [activeTab, setActiveTab] = useState('appointments');
  
  const [data, setData] = useState({
    appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] 
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
    const timer = setTimeout(() => setIsBooting(false), 150); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authState !== 'authenticated') return;

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    const fetchClinicType = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}`);
        if (response.ok) {
          const clinic = await response.json();
          setData(prev => ({ ...prev, clinic: { ...prev.clinic, ...clinic } }));
        }
      } catch (err) {
        console.error('Failed to load clinic context', err);
      }
    };

    fetchClinicType();
  }, [authState]);

  useEffect(() => {
    if (activeTab === 'doctors' && isSoloWorkspace) {
      setActiveTab('appointments');
    }
  }, [activeTab, isSoloWorkspace]);

  const handleLogout = () => {
    localStorage.clear(); 
    setAuthState('login');
    setActiveTab('appointments');
    setUserRole('admin'); 
    setData({ appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] });
  };

  if (isBooting) return null; 

  const renderWithUpdatePrompt = (content) => (
    <>
      <UpdatePrompt />
      <PullToRefresh />
      {content}
    </>
  );

  if (authState === 'onboarding') {
    return renderWithUpdatePrompt(<Onboarding setAuthState={setAuthState} />);
  }

  if (authState !== 'authenticated') {
    return renderWithUpdatePrompt(<Auth authState={authState} setAuthState={setAuthState} setUserRole={setUserRole} />);
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

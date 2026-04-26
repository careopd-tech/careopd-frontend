import React, { useState, useEffect } from 'react';
import { DateProvider } from './context/DateContext'; 
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';
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

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 150); 
    return () => clearTimeout(timer);
  }, []);

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
  
  if (activeTab === 'appointments') {
    content = <Appointments data={data} setData={setData} onLogout={handleLogout}/>;
  } else if (activeTab === 'doctors') {
    content = <Doctors data={data} setData={setData} onLogout={handleLogout}/>;
  } else if (activeTab === 'patients') {
    content = <Patients data={data} setData={setData} onLogout={handleLogout} />;
  } else if (activeTab === 'settings') {
    content = <Settings data={data} setData={setData} onLogout={handleLogout} />;
  } else {
    content = <div className="p-10 text-slate-400">Tab "{activeTab}" not found.</div>;
  }

  return renderWithUpdatePrompt(
    <>
      <DateProvider>
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole}>
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

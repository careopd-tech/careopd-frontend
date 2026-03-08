import React, { useState } from 'react';
import { DateProvider } from './context/DateContext'; // <--- Provider Import
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';

// --- MODULE IMPORTS ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';

const App = () => {
  // --- AUTH STATE ---
  const [authState, setAuthState] = useState(() => {
    return localStorage.getItem('clinicId') ? 'authenticated' : 'login';
  });

  // Default to appointments tab
  const [activeTab, setActiveTab] = useState('appointments');
  
  // GLOBAL STATE CONTAINER
  const [data, setData] = useState({
    appointments: [],
    doctors: [],
    patients: [],
    clinic: {},
    notifications: [] 
  });

  const handleLogout = () => {
    localStorage.clear(); 
    setAuthState('login');
    setActiveTab('appointments');
    setData({ appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] });
  };

  // --- VIEW ROUTING ---
  let content;
  if (activeTab === 'appointments') {
    content = <Appointments data={data} setData={setData} />;
  } else if (activeTab === 'doctors') {
    content = <Doctors data={data} setData={setData} />;
  } else if (activeTab === 'patients') {
    content = <Patients data={data} setData={setData} />;
  } else if (activeTab === 'settings') {
    content = <Settings data={data} setData={setData} onLogout={handleLogout} />;
  } else {
    content = <div className="p-10 text-slate-400">Tab "{activeTab}" not found.</div>;
  }

  // --- RENDER ---
  if (authState !== 'authenticated') {
    return <Auth authState={authState} setAuthState={setAuthState} />;
  }

  // WRAP APP IN DATE PROVIDER
  return (
    <DateProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {content}
      </Layout>
    </DateProvider>
  );
};

export default App;
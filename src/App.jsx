import React, { useState } from 'react';
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';

// --- INSTANT IMPORTS ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';

const App = () => {
  // --- FIX 1: NO FLASH ON REFRESH ---
  // By passing a function () => check, React runs this logic BEFORE the first render.
  // The app will boot up directly in 'authenticated' mode if the ID exists.
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
    // Clear sensitive data from memory immediately
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
  // If not authenticated, show Auth screen
  if (authState !== 'authenticated') {
    return <Auth authState={authState} setAuthState={setAuthState} />;
  }

  // If authenticated, show the App Layout
  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {content}
    </Layout>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { DateProvider } from './context/DateContext'; 
import API_BASE_URL from './config'; 
import Layout from './components/layout/Layout';

// --- MODULE IMPORTS ---
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';

const App = () => {
  // --- BOOT STATE ---
  // This prevents the PWA layout jerk by holding the render for a split second 
  // until React, CSS, and Fonts are fully hydrated in the browser.
  const [isBooting, setIsBooting] = useState(true);

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

  // --- SMOOTH MOUNT EFFECT ---
  useEffect(() => {
    // 150ms is the UI design sweet-spot. It's fast enough that the user doesn't 
    // feel a delay, but slow enough to let the browser paint the layout smoothly.
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 150); 
    
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    localStorage.clear(); 
    setAuthState('login');
    setActiveTab('appointments');
    setData({ appointments: [], doctors: [], patients: [], clinic: {}, notifications: [] });
  };

  // --- EARLY RETURN FOR BOOTING ---
  if (isBooting) {
    // Returning null allows the plain HTML/CSS spinner inside public/index.html 
    // to stay on screen, perfectly bridging the gap from the OS splash screen!
    return null; 
  }

  // --- VIEW ROUTING ---
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
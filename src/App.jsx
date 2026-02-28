import React, { useState, useEffect, Suspense, lazy } from 'react';
import API_BASE_URL from './config'; // Import your production URL config
import Layout from './components/layout/Layout';

// --- 1. LAZY IMPORTS (Performance Optimization) ---
// These files are only downloaded when the user actually needs them.
const Auth = lazy(() => import('./modules/Auth'));
const Appointments = lazy(() => import('./modules/Appointments'));
const Doctors = lazy(() => import('./modules/Doctors'));
const Patients = lazy(() => import('./modules/Patients'));
const Settings = lazy(() => import('./modules/Settings'));

// --- 2. LOADING COMPONENT ---
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen bg-slate-50 text-teal-600 font-bold animate-pulse">
    Loading CareOPD...
  </div>
);

const App = () => {
  const [authState, setAuthState] = useState('login');
  const [activeTab, setActiveTab] = useState('appointments');
  
  const [data, setData] = useState({
    appointments: [],
    doctors: [],
    patients: [] 
  });

  // --- CRITICAL FIX: useEffect moved BEFORE return ---
  useEffect(() => {
    const loadBaseData = async () => {
      const clinicId = localStorage.getItem('clinicId');
      
      // Only load data if user is fully authenticated
      if (!clinicId || authState !== 'authenticated') return;

      try {
        const [docRes, patRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}`),
          fetch(`${API_BASE_URL}/api/patients/${clinicId}`)
          
        ]);

        if (docRes.ok && patRes.ok) {
           const doctors = await docRes.json();
           const patients = await patRes.json();
           setData(prev => ({ ...prev, doctors, patients }));
        }
      } catch (err) {
        console.error("Critical: Could not load base data.", err);
      }
    };

    loadBaseData();
  }, [authState]); // Re-run when authState changes

  const handleLogout = () => {
    // Optional: Clear storage on logout if needed
    // localStorage.removeItem('token'); 
    setAuthState('login');
    setActiveTab('appointments');
  };

  // --- 3. RENDERING WITH SUSPENSE ---
  
  // A. Handling Authentication Screen
  if (authState !== 'authenticated') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Auth authState={authState} setAuthState={setAuthState} />
      </Suspense>
    );
  }

  // B. Define Authenticated Content
  // We wrap this logic in a function or just render conditionally below
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
    content = <div className="p-10">Tab "{activeTab}" not found.</div>;
  }

  // C. Final Render
  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* Wrapping the inner content in Suspense ensures that when switching tabs,
         the user sees a loading state instead of a blank screen/freeze.
      */}
      <Suspense fallback={<div className="p-10 text-center text-gray-400">Loading Module...</div>}>
        {content}
      </Suspense>
    </Layout>
  );
};

export default App;
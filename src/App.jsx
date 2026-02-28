import React, { useState } from 'react';
import { INITIAL_DATA } from './data/mockData';
import Layout from './components/layout/Layout';
import Auth from './modules/Auth';
import Appointments from './modules/Appointments';
import Doctors from './modules/Doctors';
import Patients from './modules/Patients';
import Settings from './modules/Settings';


const App = () => {
  const [authState, setAuthState] = useState('login');
  const [activeTab, setActiveTab] = useState('appointments');
  
  const [data, setData] = useState({
  appointments: [],
  doctors: [],
  patients: [] 
});

  const handleLogout = () => {
    setAuthState('login');
    setActiveTab('appointments');
  };

  // 1. Handle Authentication Screen
  if (authState !== 'authenticated') {
    return <Auth authState={authState} setAuthState={setAuthState} />;
  }

  // 2. Define Content
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
    // Fallback if no tab matches
    content = <div className="p-10">Tab "{activeTab}" not found.</div>;
  }

  // 3. Render within Layout
  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {content}
    </Layout>
  );

  useEffect(() => {
  const loadBaseData = async () => {
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId || authState !== 'authenticated') return;

    try {
      const [docRes, patRes] = await Promise.all([
        fetch(`http://localhost:5000/api/doctors/${clinicId}`),
        fetch(`http://localhost:5000/api/patients/search/${clinicId}?q=`)
      ]);

      const doctors = await docRes.json();
      const patients = await patRes.json();

      setData(prev => ({ ...prev, doctors, patients }));
    } catch (err) {
      console.error("Critical: Could not load base data.");
    }
  };

  loadBaseData();
}, [authState]);

};

export default App;
import React, { useState, useRef, useEffect } from 'react';
import PatientHistoryList, { filterValidHistory, getUiStatus, getStatusStyling } from '../components/ui/PatientHistoryList';
import { 
  Plus, ChevronDown, Edit2, Loader2, CheckCircle, AlertCircle, Users, X, History, Clock,
  Activity, FileText, Pill, FlaskConical
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import API_BASE_URL from '../config';





  

// Note: I included data & setData in the props so App.jsx stays perfectly happy
const Patients = ({ data, setData, onLogout }) => {
  const clinicId = localStorage.getItem('clinicId');
  const userRole = localStorage.getItem('userRole') || 'admin';
  const doctorId = localStorage.getItem('doctorId') || '';

  const rbacQuery = `&userRole=${userRole}&doctorId=${doctorId}`;

  // --- STATE MANAGEMENT ---
  const [patients, setPatients] = useState(() => data.cachedPatients || []);
  const [totalPatients, setTotalPatients] = useState(() => data.cachedPatientStats?.total || 0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(() => data.cachedPatientStats || { total: 0, new: 0, returning: 0, noVisit: 0 });
  
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const hasActiveFilters = typeFilter !== '' || dateRange.from || dateRange.to || searchQuery !== '';

  // Notifications
  const [notification, setNotification] = useState(null);
  const [notificationStack, setNotificationStack] = useState(() => {
    try { const saved = localStorage.getItem('pat_notifications'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  useEffect(() => { localStorage.setItem('pat_notifications', JSON.stringify(notificationStack)); }, [notificationStack]);

  // --- ADD THIS STATE ---
  const [selectedPastVisit, setSelectedPastVisit] = useState(null);
  // --- ADD THIS HELPER (For the Deep-Dive Modal) ---
  const getFormattedUnit = (med) => {
    if (med.duration === 'Custom') return med.quantity;
    let unit = '';
    const nameLower = (med.name || '').toLowerCase();
    if (nameLower.startsWith('tab') || nameLower.includes(' tab')) unit = 'Tab';
    else if (nameLower.startsWith('cap') || nameLower.includes(' cap')) unit = 'Cap';
    else if (nameLower.startsWith('syp') || nameLower.includes('syrup')) unit = 'ml';
    else if (nameLower.includes('drop')) unit = 'Drop';
    else if (nameLower.startsWith('inj') || nameLower.includes('injection')) unit = 'Amp';
    const hasLetters = /[a-zA-Z]/.test(med.quantity || '');
    return hasLetters ? med.quantity : `${med.quantity} ${unit}`.trim();
  };
  // --- PATIENT SKELETON LOADER ---
const PatientSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="p-3 rounded-xl border border-slate-100 bg-white flex flex-col md:flex-row gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          <div className="h-3 bg-slate-100 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-1/5 mt-2"></div>
        </div>
        <div className="flex gap-2 mt-2 md:mt-0 md:w-32">
          <div className="flex-1 h-7 bg-slate-100 rounded-lg"></div>
          <div className="flex-1 h-7 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
    ))}
  </div>
);

  // Modal States
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [addPatientTab, setAddPatientTab] = useState('demographics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const defaultPatientState = { 
    _id: null, firstName: '', middleName: '', lastName: '', name: '', 
    phone: '', age: '', gender: 'M', bloodGroup: '', email: '', address: '', type: 'New', lastVisit: null 
  };
  const [newPatient, setNewPatient] = useState(defaultPatientState);

  // Refs for debouncing
  const searchTimeoutRef = useRef(null);
  const queryRef = useRef(searchQuery);
  const typeRef = useRef(typeFilter);

  useEffect(() => { queryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { typeRef.current = typeFilter; }, [typeFilter]);

  // --- NOTIFICATION HELPERS ---
  const showNotification = (shortMessage, type = 'success', detailedMessage = null) => {
    setNotification({ message: shortMessage, type });
    setTimeout(() => setNotification(null), 3000);
    const newNotif = { id: Date.now(), message: detailedMessage || shortMessage, type, timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    setNotificationStack(prev => [newNotif, ...prev]);
  };

  const handleClearNotifications = () => setNotificationStack([]);
  const handleDismissNotification = (id) => setNotificationStack(prev => prev.filter(n => n.id !== id));

  // --- DATA FETCHING ---
  const fetchPatientData = async (targetPage = 1, isBackgroundSync = false) => {
    if (!clinicId) return;
    
    if (targetPage === 1 && !isBackgroundSync) {
       if (queryRef.current) setIsSearching(true);
       else setLoading(true);
    }

    try {
      const promises = [];
      
      // 1. Fetch Stats (Snapshot) - WITH FAILSAFES
      promises.push(
        fetch(`${API_BASE_URL}/api/patients/${clinicId}?mode=snapshot${rbacQuery}`)
          .then(res => res.json())
          .then(resData => {
             if (resData && resData.stats) {
                 setStats(resData.stats);
                 
             }
          })
          .catch(() => console.log("Stats fetch failed quietly"))
      );

      // 2. Fetch List
      let url = `${API_BASE_URL}/api/patients/${clinicId}?mode=list&page=${targetPage}&limit=20${rbacQuery}`;
      if (queryRef.current) url += `&query=${queryRef.current}`;
      if (typeRef.current) url += `&type=${typeRef.current}`;
      if (dateRange.from) url += `&dateFrom=${dateRange.from}`;
      if (dateRange.to) url += `&dateTo=${dateRange.to}`;

      promises.push(
        fetch(url)
          .then(res => res.json())
          .then(resData => {
            const incomingPatients = Array.isArray(resData.data) ? resData.data : [];
            if (targetPage === 1) {
              setPatients(incomingPatients);
              
            } else {
              setPatients(prev => {
                const existingIds = new Set(prev.map(p => p._id));
                const uniqueNew = incomingPatients.filter(p => !existingIds.has(p._id));
                return [...prev, ...uniqueNew];
              });
            }
            setTotalPatients(resData.total || 0);
            setPage(targetPage);
          })
          .catch(() => console.log("List fetch failed quietly"))
      );

      await Promise.all(promises);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsSearching(false);
      setIsFetchingMore(false);
    }
  };

  // Initial load & Polling
  useEffect(() => {
    const isInitialBackgroundSync = !typeFilter && !dateRange.from && !dateRange.to && !searchQuery && (data.cachedPatients?.length > 0);
    fetchPatientData(1, isInitialBackgroundSync);
    const interval = setInterval(() => fetchPatientData(page, true), 60000);
    return () => clearInterval(interval);
  }, [typeFilter, dateRange]); 

  // --- ACTIONS ---
  const handleSearchInput = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchPatientData(1);
    }, 500);
  };

  const handleLoadMore = () => {
    setIsFetchingMore(true);
    fetchPatientData(page + 1);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setDateRange({ from: '', to: '' });
  };

  // --- NAME HANDLING & MODAL ---
  const handlePatientNameInput = (field, value) => {
    let cleanVal = value.replace(/[^a-zA-Z.]/g, ''); 
    if ((cleanVal.match(/\./g) || []).length > 1) return; 
    
    if (cleanVal.length > 0) {
      cleanVal = cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1).toLowerCase();
    }

    setNewPatient(prev => ({ ...prev, [field]: cleanVal }));
  };

  const openEditModal = (p, tab) => {
    const nameParts = (p?.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
    
    setNewPatient({ ...defaultPatientState, ...p, firstName, middleName, lastName });
    setAddPatientTab(tab);
    setIsAddPatientModalOpen(true);
  };

  const handleSavePatient = async () => {
    setModalError('');
    let errors = [];

    const fullName = [newPatient.firstName, newPatient.middleName, newPatient.lastName].filter(Boolean).join(' ');

    if (!newPatient.firstName) errors.push('firstName');
    if (!newPatient.age) errors.push('age');
    if (!newPatient.phone) errors.push('phone');
    if (!newPatient.address) errors.push('address');

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (['firstName', 'age'].some(f => errors.includes(f))) setAddPatientTab('demographics');
      else setAddPatientTab('contact');
      return setModalError('Please fill all required details *');
    }

    setIsSubmitting(true);
    try {
      const url = newPatient._id ? `${API_BASE_URL}/api/patients/${newPatient._id}` : `${API_BASE_URL}/api/patients`;
      const method = newPatient._id ? 'PUT' : 'POST';
      const patPayload = { ...newPatient, name: fullName, clinicId, type: newPatient._id ? newPatient.type : 'New' };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patPayload) });
      if (res.ok) {
        await fetchPatientData(1);
        
        // This instantly tells the Appointments page to update its dropdown!
        if (setData) {
          const allPatsRes = await fetch(`${API_BASE_URL}/api/patients/${clinicId}?tag=patients`);
          if (allPatsRes.ok) {
             const freshPats = await allPatsRes.json();
             setData(prev => ({ ...prev, patients: freshPats }));
          }
        }

        setIsAddPatientModalOpen(false);
        setNewPatient(defaultPatientState);
        setAddPatientTab('demographics');
        showNotification('Profile Saved', 'success', `Patient profile for ${fullName} has been ${method === 'PUT' ? 'updated' : 'created'}.`);
      } else {
        const result = await res.json();
        setModalError(result.error || "Failed to save patient.");
      }
    } catch (err) { setModalError("Server connection failed."); }
    finally { setIsSubmitting(false); }
  };

  const openHistoryModal = async (p) => {
    setSelectedHistoryPatient(p);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=history&patientId=${p._id}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out future/active visits
        setPatientHistory(filterValidHistory(data)); 
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const formatDate = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

const renderPatientCard = (p) => {
    if (!p) return null; // Failsafe
    return (
      <div key={p._id} className="p-3 rounded-xl border border-slate-100 shadow-sm relative flex flex-col md:flex-row gap-2 bg-white hover:border-teal-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex items-center gap-1.5 mt-0.5">
              <h3 className="font-bold text-[13px] text-slate-800 leading-tight">{p.name || 'Unknown Name'}</h3>
            </div>
            <div className={`px-2 py-0.5 rounded flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${p.type === 'New' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${p.type === 'New' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
               {p.type || 'New'}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{p.gender || '?'}, {p.age || '?'} Yrs • {p.phone || 'No Phone'}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">Last Visit: {formatDate(p.lastVisit)}</p>
        </div>
        <div className="flex flex-row md:flex-col gap-1.5 border-t md:border-t-0 md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-3 justify-end flex-shrink-0 md:w-32">          
          <button onClick={() => openEditModal(p, 'demographics')} className="flex-1 md:flex-none w-full h-7 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-colors"><Edit2 size={12} /> Edit Profile</button>
          <button onClick={() => openHistoryModal(p)} className="flex-1 md:flex-none w-full h-7 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-colors"><Clock size={12} /> View History</button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="text-[13px] font-bold">{notification.message}</span>
        </div>
      )}

      <ModuleHeader 
        title="Patients" 
        searchVal={searchQuery} 
        onSearch={handleSearchInput} 
        onFilterClick={() => setIsFilterModalOpen(true)} 
        hasFilter={hasActiveFilters} 
        notifications={notificationStack} 
        onClearAll={handleClearNotifications} 
        onDismiss={handleDismissNotification} 
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col landscape:flex-row min-h-0 p-2 gap-2">
        {/* Quick Filters sidebar/topbar */}
        <div className="flex-none landscape:w-[76px] md:landscape:w-20 pb-1 landscape:pb-0">
          <div className="flex flex-row landscape:flex-col gap-1.5 landscape:h-full">
            {[
              { label: 'All', val: stats?.total || 0, color: 'bg-blue-50 text-blue-700', filterKey: '', isToggle: false },
              { label: 'New', val: stats?.new || 0, color: 'bg-green-50 text-green-700', filterKey: 'New', isToggle: true },
              { label: 'Returning', val: stats?.returning || 0, color: 'bg-amber-50 text-amber-700', filterKey: 'Returning', isToggle: true },
              { label: 'No Visit', val: stats?.noVisit || 0, color: 'bg-red-50 text-red-700', filterKey: 'No Visit', isToggle: true }
            ].map((s, i) => {
              const isActive = typeFilter === s.filterKey && s.isToggle;
              return (
                <button key={i} onClick={() => { if(s.isToggle) { setTypeFilter(isActive ? '' : s.filterKey); }}}
                  className={`flex-1 p-1.5 rounded-xl border transition-all duration-200 text-center flex flex-col items-center justify-center ${s.color} ${isActive ? 'border-slate-400 shadow-inner ring-2 ring-slate-200' : 'border-slate-100 hover:shadow-sm'}`}>
                  <div className="text-[17px] font-bold leading-tight">{s.val}</div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">{s.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main List Area */}
        {/* Main List Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            
            {/* MATCHED APPOINTMENTS SEARCH HEADER */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 shadow-sm flex-none">
                 <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-teal-700" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                      Patients {hasActiveFilters && <span className="text-red-500 ml-1.5 text-[10px]">(Filtered)</span>}
                    </h3>
                    <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                      Showing {patients.length} of {totalPatients}
                    </span>
                 </div>
                 {hasActiveFilters && (
                    <button onClick={clearAllFilters} className="p-0 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors" aria-label="Clear filters">
                      <X size={14} />
                    </button>
                 )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50 scrollbar-hide">
              {loading ? (
                 <PatientSkeleton />
              ) : isSearching ? (
                 <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-2">
                   <Loader2 className="animate-spin text-teal-600" size={24}/>
                   <span className="text-xs">Searching directory...</span>
                 </div>
              ) : patients && patients.length > 0 ? (
                 <div className="space-y-1.5">
                   {patients.map(renderPatientCard)}
                   
                   {/* MATCHED APPOINTMENTS LOAD MORE BUTTON */}
                   {patients.length < totalPatients && (
                      <button 
                        onClick={handleLoadMore} 
                        disabled={isFetchingMore} 
                        className="w-full py-2 mt-2 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5"
                      >
                         {isFetchingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                         {isFetchingMore ? 'Loading...' : 'Load More Results'}
                      </button>
                   )}
                 </div>
              ) : (
                 <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-2">
                   <span className="text-xs">
                     {hasActiveFilters ? "No patients match your active filters." : "No patients found."}
                   </span>
                 </div>
              )}
            </div>
        </div>
      </div>

      {userRole === 'admin' && (
        <FAB icon={Plus} onClick={() => { setNewPatient(defaultPatientState); setAddPatientTab('demographics'); setIsAddPatientModalOpen(true); }} />
      )}

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Advanced Filters" footer={<div className="flex gap-2"><button onClick={() => { setDateRange({ from: '', to: '' }); setIsFilterModalOpen(false); }} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white">Clear</button><button onClick={() => setIsFilterModalOpen(false)} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Apply Filters</button></div>}>
        <div className="space-y-3">
           <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Date Range (Last Visit)</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">From</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} /></div>
                <div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">To</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} /></div>
              </div>
           </div>
        </div>
      </Modal>

      <Modal isOpen={isAddPatientModalOpen} onClose={() => { setIsAddPatientModalOpen(false); setModalError(''); setInvalidFields([]); setAddPatientTab('demographics'); setNewPatient(defaultPatientState); }} title={newPatient._id ? "Update Patient Profile" : "Add New Patient"} footer={<div className="flex gap-2 w-full">{addPatientTab === 'demographics' ? <div className="flex-1" /> : <button onClick={() => setAddPatientTab('demographics')} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white">Previous</button>} {addPatientTab === 'contact' ? <button onClick={handleSavePatient} disabled={isSubmitting} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium flex justify-center items-center gap-2 disabled:opacity-70">{isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : newPatient._id ? "Update Profile" : "Create Profile"}</button> : <button onClick={() => setAddPatientTab('contact')} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Next</button>}</div>}>
        <div className="space-y-4">
          <AlertMessage message={modalError} />
          <div className="flex border-b border-slate-200">
            <button onClick={() => setAddPatientTab('demographics')} className={`flex-1 py-1.5 text-[11px] uppercase font-bold tracking-wide border-b-2 transition-colors ${addPatientTab === 'demographics' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Demographics</button>
            <button onClick={() => setAddPatientTab('contact')} className={`flex-1 py-1.5 text-[11px] uppercase font-bold tracking-wide border-b-2 transition-colors ${addPatientTab === 'contact' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Contact</button>
          </div>
          <div className="min-h-[160px]">
            {addPatientTab === 'demographics' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Full Name <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="First Name *" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('firstName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.firstName} onChange={(e) => handlePatientNameInput('firstName', e.target.value)} />
                    <input type="text" placeholder="Middle" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.middleName} onChange={(e) => handlePatientNameInput('middleName', e.target.value)} />
                    <input type="text" placeholder="Last Name" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.lastName} onChange={(e) => handlePatientNameInput('lastName', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Age <span className="text-red-500">*</span></label><input type="tel" placeholder="Years" maxLength={3} className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('age') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value.replace(/\D/g, '')})} /></div>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Gender <span className="text-red-500">*</span></label><select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></div>
                </div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Blood Group</label><select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none" value={newPatient.bloodGroup} onChange={e => setNewPatient({...newPatient, bloodGroup: e.target.value})}><option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}</select></div>
              </div>
            )}
            {addPatientTab === 'contact' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Phone <span className="text-red-500">*</span></label><input type="tel" maxLength={10} placeholder="Mobile number" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value.replace(/\D/g, '')})} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Email</label><input type="email" placeholder="Email address" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Address <span className="text-red-500">*</span></label><input type="text" placeholder="Full residential address" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('address') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.address} onChange={e => setNewPatient({...newPatient, address: e.target.value})} /></div>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal 
        isOpen={isHistoryModalOpen} 
        onClose={() => { setIsHistoryModalOpen(false); setPatientHistory([]); setSelectedHistoryPatient(null); }} 
        title={`Visit History: ${selectedHistoryPatient?.name || ''}`} 
        footer={<button onClick={() => setIsHistoryModalOpen(false)} className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors py-1.5 rounded-lg text-[15px] font-medium">Close</button>}
      >
        <div className="-mx-2 px-2">
             <PatientHistoryList 
                historyData={patientHistory} 
                isLoading={isHistoryLoading} 
                layout="vertical" 
                // The Lazy Loader: Fires if the doctor clicks a card that lacks deep-dive details
                onFetchDetails={async (visitId) => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/appointments/details/${visitId}`); // Assuming you have an endpoint for this
                        if (res.ok) {
                            const detailedData = await res.json();
                            // Update the specific visit in state with the newly fetched details
                            setPatientHistory(prev => prev.map(v => v._id === visitId ? { ...v, ...detailedData } : v));
                        }
                    } catch (e) {
                        console.error("Failed to lazy load visit details", e);
                    }
                }} 
             />
        </div>
      </Modal>
    </div>
  );
};

export default Patients;
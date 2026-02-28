import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, CalendarCheck, History, XCircle, ChevronDown, ChevronRight, Edit2 
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import API_BASE_URL from '../config';

const Patients = ({ data, setData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState('visitingToday');

  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [addPatientTab, setAddPatientTab] = useState('demographics');
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [loading, setLoading] = useState(false);

  // Default state ensures we don't have nulls for new patients
  const defaultPatientState = {
    _id: null, name: '', phone: '', age: '', gender: 'M', bloodGroup: '',
    email: '', address: '', insuranceProvider: '', insuranceId: '', expiryDate: '',
    type: 'New', lastVisit: '-'
  };
  const [newPatient, setNewPatient] = useState(defaultPatientState);

  useEffect(() => {
    const fetchPatientsAndAppointments = async () => {
      const clinicId = localStorage.getItem('clinicId');
      if (!clinicId) return;

      try {
        setLoading(true);
        const [patsRes, apptsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/patients/${clinicId}?tag=patients`),
          fetch(`${API_BASE_URL}/api/appointments/${clinicId}?tag=appointments`)
        ]);

        if (patsRes.ok && apptsRes.ok) {
          const pats = await patsRes.json();
          const appts = await apptsRes.json();
          
          setData(prev => ({
            ...prev,
            patients: pats,
            appointments: appts
          }));
        }
      } catch (err) {
        console.error("Error fetching patient data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientsAndAppointments();
  }, [setData]);

  const handleEditPatient = (patient, tab = 'demographics') => {
    setModalError('');
    setInvalidFields([]);
    setNewPatient({ ...defaultPatientState, ...patient });
    setAddPatientTab(tab);
    setIsAddPatientModalOpen(true);
  };

  const handleSavePatient = async () => {
    setModalError('');
    let errors = [];
    
    if (!newPatient.name) errors.push('name');
    if (!newPatient.age) errors.push('age');
    if (!newPatient.phone) errors.push('phone');
    if (!newPatient.address) errors.push('address');

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (['name', 'age'].some(f => errors.includes(f))) setAddPatientTab('demographics');
      else setAddPatientTab('contact');
      return setModalError('Please fill all required details marked with *');
    }
    setInvalidFields([]);
    
    const clinicId = localStorage.getItem('clinicId');
    const patPayload = {
      ...newPatient,
      clinicId,
      type: newPatient._id ? newPatient.type : 'New',
      lastVisit: newPatient._id ? newPatient.lastVisit : '-'
    };

    try {
      let response;
      if (newPatient._id) {
        response = await fetch(`${API_BASE_URL}/api/patients/${newPatient._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patPayload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patPayload)
        });
      }

      if (response.ok) {
        const savedPat = await response.json();
        
        setData(prev => {
          const isUpdate = prev.patients.some(p => p._id === savedPat._id);
          return {
            ...prev,
            patients: isUpdate
              ? prev.patients.map(p => p._id === savedPat._id ? savedPat : p)
              : [savedPat, ...prev.patients]
          };
        });

        setIsAddPatientModalOpen(false);
        setNewPatient(defaultPatientState);
        setAddPatientTab('demographics');
        setModalError('');
      } else {
        const result = await response.json();
        setModalError(result.error || "Failed to save patient.");
      }
    } catch (err) {
      setModalError("Server connection failed.");
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const sixMonthsAgoDate = new Date();
  sixMonthsAgoDate.setMonth(sixMonthsAgoDate.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgoDate.toISOString().split('T')[0];

  const processedPatients = useMemo(() => {
    return (data.patients || []).map(p => {
      // Safety Check: Ensure _id exists
      if (!p._id) return { ...p, category: 'noVisit', sortDate: '', sortTime: '' };

      const pAppts = (data.appointments || []).filter(a => a.patientId === p._id && a.status !== 'Cancelled');
      const todayAppt = pAppts.find(a => a.date === todayStr);

      let category = '';
      let sortTime = '';
      let sortDate = '';
      
      // Safety Check: handle missing lastVisit
      const safeLastVisit = p.lastVisit || '-';

      if (todayAppt) {
        category = 'visitingToday';
        sortTime = todayAppt.time || '';
        sortDate = todayAppt.date || '';
      } else {
        if (safeLastVisit === '-' || safeLastVisit < sixMonthsAgoStr) {
          category = 'noVisit';
          sortDate = safeLastVisit === '-' ? '0000-00-00' : safeLastVisit;
        } else {
          category = 'recent';
          sortDate = safeLastVisit;
        }
      }

      return { ...p, category, sortDate, sortTime };
    });
  }, [data.patients, data.appointments, todayStr, sixMonthsAgoStr]);

  const stats = useMemo(() => {
    const patients = data.patients || [];
    return {
      total: patients.length,
      new: patients.filter(p => p.type === 'New').length,
      returning: patients.filter(p => p.type === 'Returning').length,
      noVisit: patients.filter(p => (p.lastVisit || '-') === '-' || p.lastVisit < sixMonthsAgoStr).length
    };
  }, [data.patients, sixMonthsAgoStr]);

  const filteredPatients = processedPatients.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // Safety check for p.name and p.phone
      const name = p.name ? p.name.toLowerCase() : '';
      const phone = p.phone || '';
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    if (typeFilter) {
      if (typeFilter === 'New' && p.type !== 'New') return false;
      if (typeFilter === 'Returning' && p.type !== 'Returning') return false;
      if (typeFilter === 'No Visit' && !(p.lastVisit === '-' || p.lastVisit < sixMonthsAgoStr)) return false;
    }
    if (dateRange.from || dateRange.to) {
      if (p.sortDate === '0000-00-00') return false; 
      if (dateRange.from && p.sortDate < dateRange.from) return false;
      if (dateRange.to && p.sortDate > dateRange.to) return false;
    }
    return true;
  });

  // --- SAFE SORTING LOGIC ---
  // Using || '' ensures we compare strings, never nulls
  const sections = {
    visitingToday: filteredPatients
      .filter(p => p.category === 'visitingToday')
      .sort((a, b) => (a.sortTime || '').localeCompare(b.sortTime || '')),
      
    recent: filteredPatients
      .filter(p => p.category === 'recent')
      .sort((a, b) => (b.sortDate || '').localeCompare(a.sortDate || '')),
      
    noVisit: filteredPatients
      .filter(p => p.category === 'noVisit')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  };

  const renderPatientCard = (p) => (
    <div key={p._id || Math.random()} className="p-3 rounded-xl border border-slate-100 shadow-sm bg-white flex flex-col md:flex-row landscape:flex-row md:items-stretch landscape:items-stretch gap-2 md:gap-3 landscape:gap-3">
      
      <div className="flex-1 min-w-0 flex flex-col justify-start">
        <div className="flex justify-between items-start mb-1">
          <div className="mt-0.5">
            <h3 className="font-bold text-[13px] text-slate-800 leading-tight">{p.name || 'Unknown Name'}</h3>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{p.gender}, {p.age || '?'} Yrs • {p.phone || 'No Phone'}</p>
            {p.category === 'visitingToday' && <p className="text-[10px] font-bold text-teal-600 mt-1">Appt Today: {p.sortTime}</p>}
            {(p.category === 'recent' || p.category === 'noVisit') && <p className="text-[10px] text-slate-400 mt-1">Last Visit: {p.lastVisit || '-'}</p>}
          </div>
          <div className={`h-7 landscape:h-auto md:landscape:h-7 landscape:py-0.5 md:landscape:py-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${p.type === 'New' ? 'text-blue-600' : 'text-purple-600'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${p.type === 'New' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
             {p.type || 'New'}
          </div>
        </div>
      </div>

      <div className="flex flex-row md:flex-col landscape:flex-col gap-1.5 border-t md:border-t-0 landscape:border-t-0 md:border-l landscape:border-l border-slate-100 pt-1.5 mt-1.5 md:pt-0 landscape:pt-0 md:mt-0 landscape:mt-0 md:pl-3 landscape:pl-3 justify-end md:justify-start landscape:justify-start flex-shrink-0 md:w-32 landscape:w-32">
        <button onClick={() => handleEditPatient(p, 'demographics')} className="flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5"><Edit2 size={12} /> Demographics</button>
        <button onClick={() => handleEditPatient(p, 'contact')} className="flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5"><Edit2 size={12} /> Contact</button>
      </div>

    </div>
  );

  const renderAccordionSection = (id, title, icon, colorClass, items) => {
    const isExpanded = expandedSection === id;
    const Icon = icon;
    
    return (
      <div className={`flex flex-col border-b border-slate-100 ${isExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
        <button 
          onClick={() => setExpandedSection(isExpanded ? null : id)}
          className={`flex items-center justify-between px-3 py-2.5 landscape:py-1.5 bg-white hover:bg-slate-50 transition-colors z-10 shadow-sm ${isExpanded ? 'border-b border-slate-100' : ''}`}
        >
          <div className={`flex items-center gap-1.5 ${colorClass}`}>
            <Icon size={14} />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
            {id === 'visitingToday' && <span className="bg-teal-100 text-teal-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1.5">Live</span>}
            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">({items.length})</span>
          </div>
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>
        
        {isExpanded && (
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide">
            {items.length > 0 ? items.map(renderPatientCard) : <div className="text-center py-6 text-slate-400 text-[13px] italic">No patients in this section</div>}
          </div>
        )}
      </div>
    );
  };

  if (loading && (!data.patients || data.patients.length === 0)) {
    return <div className="p-10 text-center font-bold text-teal-600 animate-pulse">Loading Patients...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <ModuleHeader 
        title="Patients" 
        searchVal={searchQuery} 
        onSearch={setSearchQuery} 
        onFilterClick={() => setIsFilterModalOpen(true)} 
        hasFilter={typeFilter !== '' || dateRange.from || dateRange.to} 
      />

      <div className="flex-1 flex flex-col landscape:flex-row min-h-0 p-2 gap-2">
        <div className="flex-none landscape:w-[72px] md:landscape:w-20 landscape:h-full pb-1 landscape:pb-0">
          <div className="flex flex-row landscape:flex-col gap-1.5 landscape:h-full">
            {[
              { label: 'All', val: stats.total, color: 'bg-blue-50 text-blue-700', filterKey: '', isToggle: false },
              { label: 'New', val: stats.new, color: 'bg-green-50 text-green-700', filterKey: 'New', isToggle: true },
              { label: 'Returning', val: stats.returning, color: 'bg-amber-50 text-amber-700', filterKey: 'Returning', isToggle: true },
              { label: 'No Visit', val: stats.noVisit, color: 'bg-red-50 text-red-700', filterKey: 'No Visit', isToggle: true }
            ].map((s, i) => {
              const isActive = typeFilter === s.filterKey && s.isToggle;
              return (
                <button key={i} onClick={() => setTypeFilter(s.filterKey === typeFilter && s.isToggle ? '' : s.filterKey)}
                  className={`flex-1 p-1.5 landscape:p-1 md:landscape:p-1.5 rounded-xl border transition-all duration-200 text-center relative select-none flex flex-col items-center justify-center ${s.color} 
                    ${isActive ? 'border-slate-400 shadow-inner scale-[0.98]' : 'border-slate-100 hover:opacity-90 hover:shadow-sm active:scale-95 active:shadow-inner'}`}>
                  <div className="text-[17px] md:text-[19px] font-bold leading-tight">{s.val}</div>
                  <div className="text-[9px] md:text-[10px] font-semibold uppercase mt-0.5">{s.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {renderAccordionSection('visitingToday', 'Visiting Today', CalendarCheck, 'text-teal-700', sections.visitingToday)}
          {renderAccordionSection('recent', 'Recently Visited', History, 'text-purple-600', sections.recent)}
          {renderAccordionSection('noVisit', 'No Visits (>6mo)', XCircle, 'text-slate-500', sections.noVisit)}
        </div>
      </div>

      <FAB icon={Plus} onClick={() => { setNewPatient(defaultPatientState); setAddPatientTab('demographics'); setIsAddPatientModalOpen(true); }} />

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Patients" footer={
          <div className="flex gap-2">
             <button onClick={() => { setTypeFilter(''); setDateRange({ from: '', to: '' }); setIsFilterModalOpen(false); }} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium">Clear</button>
             <button onClick={() => setIsFilterModalOpen(false)} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Apply</button>
          </div>
        }>
        <div className="space-y-3">
           <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Date Range (Visit Date)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                   <span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">From</span>
                   <input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} />
                </div>
                <div>
                   <span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">To</span>
                   <input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} />
                </div>
              </div>
           </div>
           <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Type</label>
              <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All</option><option value="New">New</option><option value="Returning">Returning</option><option value="No Visit">No Visit (&gt;6mo)</option>
              </select>
           </div>
        </div>
      </Modal>

      {/* Add/Edit Patient Modal */}
      <Modal 
        isOpen={isAddPatientModalOpen} 
        onClose={() => {
          setIsAddPatientModalOpen(false);
          setModalError('');
          setInvalidFields([]);
          setAddPatientTab('demographics');
          setNewPatient(defaultPatientState);
        }} 
        title={newPatient._id ? "Update Patient Profile" : "Add New Patient"} 
        footer={
          <div className="flex gap-2 w-full">
            {addPatientTab === 'demographics' ? (
              <div className="flex-1" />
            ) : (
              <button 
                onClick={() => setAddPatientTab('demographics')} 
                className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white"
              >
                Previous
              </button>
            )}
            
            {addPatientTab === 'contact' ? (
              <button 
                onClick={handleSavePatient} 
                className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium"
              >
                {newPatient._id ? "Update Profile" : "Create Profile"}
              </button>
            ) : (
              <button 
                onClick={() => setAddPatientTab('contact')} 
                className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium"
              >
                Next
              </button>
            )}
          </div>
        }
      >
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
                  <input type="text" placeholder="e.g. John Doe" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('name') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Age <span className="text-red-500">*</span></label>
                    <input type="number" placeholder="Years" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('age') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Gender <span className="text-red-500">*</span></label>
                    <select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                      <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Blood Group</label>
                  <select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.bloodGroup} onChange={e => setNewPatient({...newPatient, bloodGroup: e.target.value})}>
                    <option value="">Unknown</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>
            )}
            
            {addPatientTab === 'contact' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Phone <span className="text-red-500">*</span></label>
                  <input type="tel" placeholder="Mobile number" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Email</label>
                  <input type="email" placeholder="Email address" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Address <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Full residential address" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('address') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.address} onChange={e => setNewPatient({...newPatient, address: e.target.value})} />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Patients;
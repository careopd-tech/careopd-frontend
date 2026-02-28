import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, CalendarCheck, History, Plus, Clock, RefreshCw, ChevronDown, ChevronRight, CalendarDays, CheckCircle, AlertCircle, X } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import TimeSlotPicker from '../components/business/TimeSlotPicker';

const getTodayDate = () => new Date().toISOString().split('T')[0];

const Appointments = ({ data, setData }) => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [doctorFilter, setDoctorFilter] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  const [expandedSection, setExpandedSection] = useState('today');
  const [rebookingApptId, setRebookingApptId] = useState(null);
  const previousListRef = useRef(null);
  
  // Notification State
  const [notification, setNotification] = useState(null);

  const [loading, setLoading] = useState(true);
  const [newAppt, setNewAppt] = useState({ patientId: '', department: '', doctorId: '', time: '', date: getTodayDate() });
  const [newPatientDetails, setNewPatientDetails] = useState({ name: '', phone: '', age: '', gender: 'M', address: '' });
  const [actionAppt, setActionAppt] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);

  // --- 1. DATA FETCHING ---
  useEffect(() => {
    const fetchAllData = async () => {
      const clinicId = localStorage.getItem('clinicId');
      if (!clinicId) return setLoading(false);

      try {
        setLoading(true);
        const [apptsRes, docsRes, patsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/appointments/${clinicId}`),
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}`),
          fetch(`${API_BASE_URL}/api/patients/${clinicId}`)
        ]);

        if (apptsRes.ok && docsRes.ok && patsRes.ok) {
          const [appts, docs, pats] = await Promise.all([apptsRes.json(), docsRes.json(), patsRes.json()]);
          setData(prev => ({ ...prev, appointments: appts, doctors: docs, patients: pats }));
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [setData]);

  // --- 2. NOTIFICATION SYSTEM (FIXED) ---
  const showNotification = (message, type = 'success') => {
    // A. Show the Toast (Visual Pop-up)
    setNotification({ message, type });

    // B. Add to Global History (So it reflects in the panel later)
    setData(prev => ({
      ...prev,
      // Create 'notifications' array if it doesn't exist, add new one to the top
      notifications: [
        {
          id: Date.now(),
          message,
          type,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        },
        ...(prev.notifications || [])
      ]
    }));

    // C. Hide Toast after 3s
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 3. ROBUST HELPERS ---
  const getPatientName = (identifier) => {
    if (!identifier) return 'Unknown';
    if (typeof identifier === 'object' && identifier.name) return identifier.name;
    const idStr = identifier.toString();
    const patient = (data.patients || []).find(p => String(p._id) === idStr || String(p.id) === idStr);
    return patient ? patient.name : 'Unknown Patient';
  };

  const getDoctorName = (identifier) => {
    if (!identifier) return 'Unknown';
    if (typeof identifier === 'object' && identifier.name) return identifier.name;
    const idStr = identifier.toString();
    const doctor = (data.doctors || []).find(d => String(d._id) === idStr || String(d.id) === idStr);
    return doctor ? doctor.name : 'Unknown Doctor';
  };

  const getDoctorById = (id) => {
    if (!id) return null;
    return (data.doctors || []).find(d => String(d._id) === id.toString() || String(d.id) === id.toString());
  };

  // --- 4. VALIDATION LOGIC ---
  const checkPatientConflict = (patientId, date, time, excludeApptId = null) => {
    if (patientId === 'add_new') return false;
    return data.appointments.some(a => 
      String(a.patientId) === String(patientId) &&
      a.date === date &&
      a.time === time &&
      a.status !== 'Cancelled' &&
      a._id !== excludeApptId
    );
  };

  // --- 5. COMPONENT LOGIC ---
  const departments = useMemo(() => [...new Set((data.doctors || []).map(d => d.department))], [data.doctors]);

  const stats = useMemo(() => {
    const appts = data.appointments || [];
    return {
      total: appts.length,
      completed: appts.filter(a => a.status === 'Completed').length,
      pending: appts.filter(a => a.status === 'Pending' || a.status === 'Confirmed').length,
      cancelled: appts.filter(a => a.status === 'Cancelled').length
    };
  }, [data.appointments]);

  const filteredAppointments = useMemo(() => {
    return (data.appointments || []).filter(appt => {
      if (filter === 'Upcoming' && !(appt.status === 'Pending' || appt.status === 'Confirmed')) return false;
      if (filter === 'Completed' && appt.status !== 'Completed') return false;
      if (filter === 'Cancelled' && appt.status !== 'Cancelled') return false;
      
      if (searchQuery) {
        const pName = getPatientName(appt.patientId).toLowerCase();
        const dName = getDoctorName(appt.doctorId).toLowerCase();
        if (!pName.includes(searchQuery.toLowerCase()) && !dName.includes(searchQuery.toLowerCase())) return false;
      }
      if (dateRange.from && appt.date < dateRange.from) return false;
      if (dateRange.to && appt.date > dateRange.to) return false;
      if (doctorFilter && appt.doctorId !== doctorFilter) return false;
      return true;
    });
  }, [data.appointments, filter, searchQuery, dateRange, doctorFilter]);

  const todayStr = getTodayDate();
  const sections = {
    previous: filteredAppointments.filter(a => a.date < todayStr).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), 
    today: filteredAppointments.filter(a => a.date === todayStr).sort((a, b) => (a.time).localeCompare(b.time)),
    upcoming: filteredAppointments.filter(a => a.date > todayStr).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  };

  // --- 6. HANDLERS ---
  const handleStatusChange = (id, newStatus) => {
    const updated = data.appointments.map(a => a._id === id ? { ...a, status: newStatus } : a);
    setData(prev => ({ ...prev, appointments: updated }));
  };

  const handleRebook = (appt) => {
    const doc = getDoctorById(appt.doctorId);
    const today = getTodayDate();
    const isPast = appt.date < today;

    setNewAppt({
      patientId: appt.patientId.toString(),
      department: doc ? doc.department : '',
      doctorId: appt.doctorId.toString(),
      date: today,
      time: ''
    });

    if (isPast) {
      setRebookingApptId(null); // Clone (POST)
    } else {
      setRebookingApptId(appt._id); // Update (PUT)
    }
    
    setIsAddModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!actionAppt) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Cancelled' })
      });
      if (response.ok) {
          handleStatusChange(actionAppt._id, 'Cancelled');
          showNotification('Appointment Cancelled', 'error'); // Trigger Notification
      }
    } catch(e) { console.error(e); }
    setIsCancelModalOpen(false);
    setActionAppt(null);
  };

  const confirmReschedule = async () => {
    setModalError('');
    if (!rescheduleData.date || !rescheduleData.time) return setModalError('Please select both a new date and time.');
    
    if (checkPatientConflict(actionAppt.patientId, rescheduleData.date, rescheduleData.time, actionAppt._id)) {
      return setModalError('This patient already has an appointment at this time!');
    }

    if (actionAppt) {
       try {
         const response = await fetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: rescheduleData.date, time: rescheduleData.time, status: 'Confirmed' })
         });
         if (response.ok) {
             const updatedAppt = await response.json();
             const updatedList = data.appointments.map(a => a._id === actionAppt._id ? updatedAppt : a);
             setData(prev => ({ ...prev, appointments: updatedList }));
             setIsRescheduleModalOpen(false);
             setActionAppt(null);
             showNotification('Rescheduled Successfully');
         }
       } catch (err) { setModalError("Failed to reschedule."); }
    }
  };

  const handleAddAppointment = async () => {
    setModalError('');
    let errors = [];

    if (!newAppt.patientId) errors.push('patientId');
    if (newAppt.patientId === 'add_new') {
      if (!newPatientDetails.name) errors.push('newPatientName');
      if (!newPatientDetails.phone) errors.push('newPatientPhone');
      if (!newPatientDetails.age) errors.push('newPatientAge');
      if (!newPatientDetails.address) errors.push('newPatientAddress');
    }
    if (!newAppt.doctorId) errors.push('doctorId');
    if (!newAppt.date) errors.push('date');
    if (!newAppt.time) errors.push('time');

    if (errors.length > 0) {
      setInvalidFields(errors);
      return setModalError('Please fill all required details marked with *');
    }

    if (checkPatientConflict(newAppt.patientId, newAppt.date, newAppt.time, rebookingApptId)) {
       return setModalError('Conflict: This patient already has an appointment at this time.');
    }

    setInvalidFields([]);
    const clinicId = localStorage.getItem('clinicId');
    
    const appointmentPayload = {
      clinicId,
      patientId: newAppt.patientId, 
      doctorId: newAppt.doctorId,   
      time: newAppt.time,
      date: newAppt.date,
      type: 'Consultation',
      status: 'Pending',
      newPatientData: newAppt.patientId === 'add_new' ? newPatientDetails : null
    };

    try {
      let response;
      let isUpdate = false;

      if (rebookingApptId) {
        isUpdate = true;
        response = await fetch(`${API_BASE_URL}/api/appointments/${rebookingApptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentPayload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentPayload)
        });
      }

      const result = await response.json();

      if (response.ok) {
        setData(prev => {
          let updatedAppts;
          if (isUpdate) {
            updatedAppts = prev.appointments.map(a => a._id === rebookingApptId ? result : a);
          } else {
            updatedAppts = [result.appointment, ...prev.appointments];
          }
          return { 
            ...prev, 
            appointments: updatedAppts,
            patients: result.newPatient ? [result.newPatient, ...prev.patients] : prev.patients
          };
        });

        setIsAddModalOpen(false);
        setRebookingApptId(null);
        setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: getTodayDate() });
        setNewPatientDetails({ name: '', phone: '', age: '', gender: 'M', address: '' });
        showNotification(isUpdate ? 'Appointment Updated' : 'Appointment Booked');
      } else {
        setModalError(result.error || "Failed to save appointment.");
      }
    } catch (err) {
      setModalError("Server error: Could not connect to backend.");
    }
  };

  // --- 7. RENDER ---
  const renderAccordionSection = (id, title, icon, colorClass, items) => {
    const isExpanded = expandedSection === id;
    const Icon = icon;
    return (
      <div className={`flex flex-col border-b border-slate-100 ${isExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
        <button onClick={() => setExpandedSection(isExpanded ? null : id)} className={`flex items-center justify-between px-3 py-2.5 landscape:py-1.5 bg-white hover:bg-slate-50 transition-colors z-10 shadow-sm border-b outline-none ${isExpanded ? 'border-slate-100' : 'border-transparent'}`}>
          <div className={`flex items-center gap-1.5 ${colorClass}`}>
            <Icon size={14} />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
            {id === 'today' && <span className="bg-teal-100 text-teal-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1.5">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">({items.length})</span>
          </div>
          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} className="text-slate-400" /></div>
        </button>
        {isExpanded && (
          <div ref={id === 'previous' ? previousListRef : null} className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide animate-fadeIn">
            {items.length > 0 ? items.map(renderAppointmentCard) : <div className="text-center py-6 text-slate-400 text-[11px] italic">No appointments</div>}
          </div>
        )}
      </div>
    );
  };

  const renderAppointmentCard = (appt) => {
    const isCancelled = appt.status === 'Cancelled';
    const isCompleted = appt.status === 'Completed';
    const isPast = appt.date < todayStr;
    const isNoShow = isPast && (appt.status === 'Pending' || appt.status === 'Confirmed');
    const showActions = !isCompleted && !isCancelled && !isPast;
    
    return (
      <div key={appt._id} className={`p-3 rounded-xl border border-slate-100 shadow-sm relative transition-all flex flex-col md:flex-row landscape:flex-row md:items-stretch landscape:items-stretch gap-2 md:gap-3 landscape:gap-3 ${isCancelled || isNoShow ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
        <div className={`flex-1 min-w-0 ${(isCancelled || isNoShow) ? 'grayscale opacity-75' : ''}`}>
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock size={12} className="text-slate-400" />
              <span className="text-[13px] font-bold text-slate-700">{appt.time}</span>
              <span className="text-[10px] text-slate-400">| {appt.date}</span>
            </div>
            {isNoShow ? <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">No Show</span> : <StatusBadge status={appt.status} />}
          </div>
          <h4 className="font-bold text-[13px] text-slate-800 leading-tight">{getPatientName(appt.patientId)}</h4>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{appt.type || 'Consultation'} with <span className="text-teal-600 font-medium">{getDoctorName(appt.doctorId)}</span></p>
        </div>
        {showActions && (
          <div className="flex flex-row md:flex-col landscape:flex-col gap-1.5 border-t md:border-t-0 landscape:border-t-0 md:border-l landscape:border-l border-slate-100 pt-1.5 mt-1.5 md:pt-0 landscape:pt-0 md:mt-0 landscape:mt-0 md:pl-3 landscape:pl-3 justify-end md:justify-start landscape:justify-start flex-shrink-0 md:w-32 landscape:w-32">
            <button onClick={() => { setActionAppt(appt); setIsCancelModalOpen(true); }} className="flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center whitespace-nowrap">Cancel</button>
            <button onClick={() => { setActionAppt(appt); setRescheduleData({ date: appt.date, time: appt.time }); setIsRescheduleModalOpen(true); }} className="flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap"><CalendarDays size={12} /> Reschedule</button>
          </div>
        )}
        {(isCancelled || isNoShow) && (
          <div className="flex flex-row md:flex-col landscape:flex-col gap-1.5 border-t md:border-t-0 landscape:border-t-0 md:border-l landscape:border-l border-slate-100 pt-1.5 mt-1.5 md:pt-0 landscape:pt-0 md:mt-0 landscape:mt-0 md:pl-3 landscape:pl-3 justify-end md:justify-start landscape:justify-start flex-shrink-0 md:w-32 landscape:w-32">
             <button onClick={() => handleRebook(appt)} className="flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg flex items-center justify-center gap-1 whitespace-nowrap"><RefreshCw size={12} /> ReBook</button>
          </div>
        )}
      </div>
    );
  };

  const clearFilters = () => { setDateRange({ from: '', to: '' }); setDoctorFilter(''); setIsFilterModalOpen(false); };

  if (loading && (!data.appointments || data.appointments.length === 0)) return <div className="h-full flex items-center justify-center"><div className="text-teal-600 font-bold animate-pulse">Loading Appts...</div></div>;

  return (
    
    <div className="h-full flex flex-col relative">
      {/* NOTIFICATION TOAST - FIXED POSITION */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${notification.type === 'success' ? 'bg-white border-l-4 border-teal-500 text-teal-800' : 'bg-white border-l-4 border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="text-[13px] font-bold">{notification.message}</span>
        </div>
      )}
<ModuleHeader 
  title="Appointments" 
  shortTitle="Appts" 
  searchVal={searchQuery} 
  onSearch={setSearchQuery} 
  onFilterClick={() => setIsFilterModalOpen(true)} 
  hasFilter={dateRange.from || dateRange.to || doctorFilter} 
  
  // ✅ ADD THIS LINE:
  notifications={data.notifications || []} 
/>

      
      <div className="flex-1 flex flex-col landscape:flex-row min-h-0 p-2 gap-2">
        <div className="flex-none landscape:w-[72px] md:landscape:w-20 landscape:h-full pb-1 landscape:pb-0">
          <div className="flex flex-row landscape:flex-col gap-1.5 landscape:h-full">
            {[
              { label: 'All', val: stats.total, color: 'bg-blue-50 text-blue-700', filterKey: 'All', isToggle: false },
              { label: 'Done', val: stats.completed, color: 'bg-green-50 text-green-700', filterKey: 'Completed', isToggle: true },
              { label: 'Pending', val: stats.pending, color: stats.pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400', filterKey: 'Upcoming', isToggle: true },
              { label: 'Cancelled', val: stats.cancelled, color: 'bg-red-50 text-red-700', filterKey: 'Cancelled', isToggle: true }
            ].map((s, i) => (
                <button key={i} onClick={() => setFilter(s.filterKey === filter && s.isToggle ? 'All' : s.filterKey)} className={`flex-1 p-1.5 landscape:p-1 md:landscape:p-1.5 rounded-xl border transition-all duration-200 text-center relative select-none flex flex-col items-center justify-center ${s.color} ${filter === s.filterKey && s.isToggle ? 'border-slate-400 shadow-inner' : 'border-slate-100'}`}>
                  <div className="text-[17px] md:text-[19px] font-bold leading-tight">{s.val}</div>
                  <div className="text-[9px] md:text-[10px] font-semibold uppercase mt-0.5">{s.label}</div>
                </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {renderAccordionSection('previous', 'Previous', History, 'text-slate-400', sections.previous)}
          {renderAccordionSection('today', "Today's", CalendarCheck, 'text-teal-700', sections.today)}
          {renderAccordionSection('upcoming', 'Upcoming', Calendar, 'text-blue-600', sections.upcoming)}
        </div>
      </div>
      <FAB icon={Plus} onClick={() => { setRebookingApptId(null); setIsAddModalOpen(true); }} />
      
      {/* FILTER MODAL */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Appointments" footer={<div className="flex gap-2"><button onClick={clearFilters} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium">Clear</button><button onClick={() => setIsFilterModalOpen(false)} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Apply</button></div>}>
        <div className="space-y-3">
           <div><label className="block text-[13px] font-bold text-slate-700 mb-1">Date Range</label><div className="grid grid-cols-2 gap-2"><div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">From</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} /></div><div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">To</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} /></div></div></div>
           <div><label className="block text-[13px] font-bold text-slate-700 mb-1">Doctor</label><select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}><option value="">All Doctors</option>{data.doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
        </div>
      </Modal>
      
      {/* ADD/EDIT MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setRebookingApptId(null); setModalError(''); setInvalidFields([]); setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: getTodayDate() }); setNewPatientDetails({ name: '', phone: '', age: '', gender: 'M', address: '' }); }} title={rebookingApptId ? "ReBook Appointment" : "New Appointment"} footer={<button onClick={handleAddAppointment} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Confirm Booking</button>}>
        <div className="space-y-3">
           <AlertMessage message={modalError} />
           <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Patient <span className="text-red-500">*</span></label><select disabled={!!rebookingApptId} className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 disabled:opacity-70 focus:ring-1 outline-none ${invalidFields.includes('patientId') ? 'border-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newAppt.patientId} onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})}><option value="">Select Patient</option>{!rebookingApptId && <option value="add_new" className="font-bold text-teal-600">+ Add New Patient</option>}{data.patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
           {newAppt.patientId === 'add_new' && (
             <div className="p-3 bg-teal-50 rounded-lg border border-teal-100 space-y-2 animate-fadeIn">
               <input type="text" placeholder="Full Name *" className={`w-full p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientName') ? 'border-red-500' : 'border-teal-200'}`} value={newPatientDetails.name} onChange={(e) => setNewPatientDetails({...newPatientDetails, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-2"><input type="tel" placeholder="Phone *" className={`w-full p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientPhone') ? 'border-red-500' : 'border-teal-200'}`} value={newPatientDetails.phone} onChange={(e) => setNewPatientDetails({...newPatientDetails, phone: e.target.value})} /><div className="flex gap-1.5"><input type="number" placeholder="Age *" className={`w-1/2 p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientAge') ? 'border-red-500' : 'border-teal-200'}`} value={newPatientDetails.age} onChange={(e) => setNewPatientDetails({...newPatientDetails, age: e.target.value})} /><select className="w-1/2 p-1.5 border border-teal-200 rounded text-[13px]" value={newPatientDetails.gender} onChange={(e) => setNewPatientDetails({...newPatientDetails, gender: e.target.value})}><option value="M">M</option><option value="F">F</option><option value="O">O</option></select></div></div><input type="text" placeholder="Address *" className={`w-full p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientAddress') ? 'border-red-500' : 'border-teal-200'}`} value={newPatientDetails.address} onChange={(e) => setNewPatientDetails({...newPatientDetails, address: e.target.value})} />
             </div>
           )}
           <div className="grid grid-cols-2 gap-2"><div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Department</label><select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none" value={newAppt.department} onChange={(e) => setNewAppt({...newAppt, department: e.target.value, doctorId: '', time: ''})}><option value="">All</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Doctor <span className="text-red-500">*</span></label><select className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 disabled:bg-slate-100 outline-none ${invalidFields.includes('doctorId') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.doctorId} onChange={(e) => { const doc = getDoctorById(e.target.value); setNewAppt({...newAppt, doctorId: e.target.value, department: doc ? doc.department : newAppt.department, time: ''}); }}><option value="">Select</option>{data.doctors.filter(d => d.status !== 'Inactive' && (!newAppt.department || d.department === newAppt.department)).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div></div>
           <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Select Date <span className="text-red-500">*</span></label><input type="date" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 outline-none ${invalidFields.includes('date') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.date} onChange={(e) => setNewAppt({...newAppt, date: e.target.value, time: ''})} /></div>
           <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Available Slots <span className="text-red-500">*</span></label><div className={`rounded-lg ${invalidFields.includes('time') ? 'ring-1 ring-red-500 border-red-500' : ''}`}><TimeSlotPicker selectedTime={newAppt.time} onSelect={(t) => setNewAppt({...newAppt, time: t})} doctor={getDoctorById(newAppt.doctorId)} date={newAppt.date} appointments={data.appointments} /></div></div>
        </div>
      </Modal>

      {/* CANCEL MODAL */}
      <Modal isOpen={isCancelModalOpen} onClose={() => { setIsCancelModalOpen(false); setActionAppt(null); }} title="Cancel Appointment" footer={<div className="flex gap-2"><button onClick={() => { setIsCancelModalOpen(false); setActionAppt(null); }} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50">Keep it</button><button onClick={confirmCancel} className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-[15px] font-medium hover:bg-red-700">Yes, Cancel</button></div>}><div className="text-[13px] text-slate-600">Are you sure?</div></Modal>
      
      {/* RESCHEDULE MODAL */}
      <Modal isOpen={isRescheduleModalOpen} onClose={() => { setIsRescheduleModalOpen(false); setModalError(''); setActionAppt(null); }} title="Reschedule" footer={<button onClick={confirmReschedule} disabled={actionAppt && rescheduleData.date === actionAppt.date && rescheduleData.time === actionAppt.time} className={`w-full py-1.5 rounded-lg text-[15px] font-medium transition-colors ${actionAppt && rescheduleData.date === actionAppt.date && rescheduleData.time === actionAppt.time ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>Update Appointment</button>}>
         <div className="space-y-3"><AlertMessage message={modalError} /><div className="bg-teal-50 p-3 rounded-lg border border-teal-100 mb-3 flex-shrink-0"><div className="text-[13px] text-teal-900">{actionAppt && `${getPatientName(actionAppt.patientId)} with ${getDoctorName(actionAppt.doctorId)}`}</div></div><div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">New Date</label><input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50" value={rescheduleData.date} onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value, time: ''})} /></div><div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Available Slots</label><TimeSlotPicker selectedTime={rescheduleData.time} onSelect={(t) => setRescheduleData({...rescheduleData, time: t})} doctor={getDoctorById(actionAppt?.doctorId)} date={rescheduleData.date} appointments={data.appointments} /></div></div>
      </Modal>
    </div>
  );
};

export default Appointments;
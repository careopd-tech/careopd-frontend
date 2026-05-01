import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, CheckCircle, CalendarDays, XCircle, Building2, AlertTriangle, 
  ChevronDown, ChevronRight, Edit2, CheckCircle as CheckIcon, AlertCircle, Loader2 
} from 'lucide-react';
import { TIME_SLOTS } from '../data/constants';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import API_BASE_URL from '../config';

// --- SKELETON LOADER ---
const DoctorSkeleton = () => (
  <div className="space-y-3 p-2 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-3 rounded-xl border border-slate-100 bg-white flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            <div className="h-3 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 w-16 bg-slate-100 rounded-full mt-1"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const Doctors = ({ data, setData, onLogout }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddDoctorModalOpen, setIsAddDoctorModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  
  // --- ADD THESE 4 LINES ---
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 30);
  const maxDateStr = maxDateObj.toISOString().split('T')[0];
  
  // Update this to use the todayStr for cleaner code
  const [calendarDate, setCalendarDate] = useState(todayStr);


  const [addDoctorTab, setAddDoctorTab] = useState('personal');
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [isNewDept, setIsNewDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState(''); // New state for "Others" text box
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [expandedSection, setExpandedSection] = useState('available');
  const [isSavingDoctor, setIsSavingDoctor] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  const [loading, setLoading] = useState(!data.doctors || data.doctors.length === 0);

  // --- NOTIFICATION STATE (PERSISTENT) ---
  // Initialize from LocalStorage to persist across navigation
  const [notification, setNotification] = useState(null);
  const [notificationStack, setNotificationStack] = useState(() => {
      try {
          const saved = localStorage.getItem('doc_notifications');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  // Sync Notification Stack to LocalStorage
  useEffect(() => {
      localStorage.setItem('doc_notifications', JSON.stringify(notificationStack));
  }, [notificationStack]);

  const defaultDoctorState = {
    _id: null,
    // Split Name Fields (UI Only)
    firstName: '', middleName: '', lastName: '',
    name: '', phone: '', email: '', gender: 'M', address: '',
    department: '', qualification: '', experience: '', regNo: '',
    morningStart: '09:00', morningEnd: '13:00', eveningStart: '17:00', eveningEnd: '21:00',
    photoUrl: '', photo: '' 
  };

  const [newDoctor, setNewDoctor] = useState(defaultDoctorState);

  // --- NEW: Handle Name Parts with Validation ---
  const handleDocNameInput = (field, value) => {
    // 1. Strict: Letters and Dot ONLY. No spaces.
    let cleanVal = value.replace(/[^a-zA-Z.]/g, ''); 

    // 2. Strict "One Dot" Rule
    if ((cleanVal.match(/\./g) || []).length > 1) return;

    if (cleanVal.length > 0) {
      cleanVal = cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1).toLowerCase();
    }

    setNewDoctor(prev => ({ ...prev, [field]: cleanVal }));
  };

  // --- NOTIFICATION HELPERS ---
  const showNotification = (shortMessage, type = 'success', detailedMessage = null) => {
    setNotification({ message: shortMessage, type });
    setTimeout(() => setNotification(null), 3000);
    const newNotif = {
        id: Date.now(),
        message: detailedMessage || shortMessage,
        type,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setNotificationStack(prev => [newNotif, ...prev]);
  };

  const handleClearNotifications = () => setNotificationStack([]);
  const handleDismissNotification = (id) => setNotificationStack(prev => prev.filter(n => n.id !== id));

  // --- 1. DATA FETCHING ---
  useEffect(() => {
    const fetchDoctorsAndAppointments = async () => {
      const clinicId = localStorage.getItem('clinicId');
      if (!clinicId) return;

      try {
        const [docsRes, apptsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}?tag=doctors`),
          fetch(`${API_BASE_URL}/api/appointments/${clinicId}?tag=appointments`)
        ]);

        if (docsRes.ok && apptsRes.ok) {
          const docs = await docsRes.json();
          const appts = await apptsRes.json();
          
          setData(prev => ({
            ...prev,
            doctors: docs,
            calendar30: appts
          }));
        }
      } catch (err) {
        console.error("Error fetching doctor data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorsAndAppointments();
    const intervalId = setInterval(fetchDoctorsAndAppointments, 60000);
    return () => clearInterval(intervalId);
  }, [setData]);

  // --- 2. ACTIONS ---
  const toggleStatus = async (doctor) => {
    // SCENARIO: REACTIVATING (Inactive -> Available)
    if (doctor.status === 'Inactive') {
       // Open Modal for Activation Remarks
       setReason('');
       setCustomReason('');
       setActiveModal({ type: 'status_change', subType: 'activate', doctorId: doctor._id, doctorName: doctor.name });
    } 
    // SCENARIO: DEACTIVATING (Available -> Inactive)
    else {
       // STRICT VALIDATION: Check for active appointments (Today or Future)
       const todayStr = new Date().toISOString().split('T')[0];
       const hasAppointments = (data.calendar30 || []).some(a => {
           // Handle Populated vs String ID
           const apptDocId = a.doctorId && typeof a.doctorId === 'object' ? a.doctorId._id : a.doctorId;
           return String(apptDocId) === String(doctor._id) && 
                  a.date >= todayStr && 
                  a.status !== 'Cancelled';
       });

       if (hasAppointments) {
           showNotification(
        'Cannot Deactivate', 
        'error', 
        `${doctor.name} has upcoming appointments. Please cancel them first.`
    );
           return;
       }

       // Open Modal for Deactivation Remarks
       setReason('');
       setCustomReason('');
       setActiveModal({ type: 'status_change', subType: 'deactivate', doctorId: doctor._id, doctorName: doctor.name });
    }
  };

  const confirmStatusChange = async () => {
    setModalError('');
    if (!reason) return setModalError('Please select a reason.');
    if (reason === 'Others' && !customReason.trim()) return setModalError('Please enter remarks.');

    const finalReason = reason === 'Others' ? customReason : reason;
    const targetStatus = activeModal.subType === 'activate' ? 'Available' : 'Inactive';

    try {
      setIsStatusSubmitting(true);
      const clinicId = localStorage.getItem('clinicId');
      const response = await fetch(`${API_BASE_URL}/api/doctors/${activeModal.doctorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, status: targetStatus, reason: finalReason })
      });

      if (response.ok) {
        const updatedDoc = await response.json();
        const updatedList = data.doctors.map(d => d._id === activeModal.doctorId ? updatedDoc : d);
        setData(prev => ({ ...prev, doctors: updatedList }));
        setActiveModal(null); 
        setReason('');
        setCustomReason('');
        
        const actionWord = targetStatus === 'Available' ? 'Activated' : 'Deactivated';
        showNotification(`Doctor ${actionWord}`, 'success', `${activeModal.doctorName} marked as ${targetStatus}.`);
      } else {
        const errData = await response.json().catch(() => ({}));
        setModalError(errData.error || 'Failed to update status.');
      }
    } catch (err) {
      setModalError('Server connection failed.');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const handleEditDoctor = (doc) => {
    // 1. Remove "Dr." prefix and trim
    const rawName = doc.name.replace(/^Dr\.\s*/, '').trim();
    
    // 2. Split by spaces
    const parts = rawName.split(' ');
    
    let fName = '', mName = '', lName = '';

    if (parts.length === 1) {
       fName = parts[0];
    } else if (parts.length === 2) {
       fName = parts[0];
       lName = parts[1];
    } else if (parts.length > 2) {
       fName = parts[0];
       lName = parts[parts.length - 1]; // Last part is Last Name
       mName = parts.slice(1, -1).join(' '); // Everything in between is Middle
    }

    setNewDoctor({
      ...defaultDoctorState,
      ...doc,
      firstName: fName,
      middleName: mName,
      lastName: lName,
      name: rawName // Keep legacy for reference
    });

    setIsNewDept(false);
    setNewDeptName('');
    setInvalidFields([]);
    setModalError('');
    setAddDoctorTab('personal');
    setIsAddDoctorModalOpen(true);
  };

  // --- INPUT HANDLERS ---
  const handleNameInput = (e) => {
      let val = e.target.value.replace(/[^a-zA-Z\s.]/g, '');
      if (val.startsWith(' ')) val = val.trimStart();
      val = val.replace(/\s\s+/g, ' '); 
      setNewDoctor({ ...newDoctor, name: val });
  };

  const handleQualificationInput = (e) => {
      let val = e.target.value.replace(/[^a-zA-Z\s,]/g, '');
      if (val.startsWith(' ')) val = val.trimStart();
      val = val.replace(/\s\s+/g, ' ');
      setNewDoctor({ ...newDoctor, qualification: val });
  };

  const handleExperienceInput = (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 3);
      setNewDoctor({ ...newDoctor, experience: val });
  };

  const handlePhoneInput = (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
      setNewDoctor({ ...newDoctor, phone: val });
  };

  const handlePhotoInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onloadend = () => {
          setNewDoctor(prev => ({
              ...prev,
              photoUrl: url,        
              photo: reader.result  
          }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDoctor = async () => {
    setModalError('');
    let errors = [];
    
    // CONSTRUCT FULL NAME (Merge 3 fields)
    const fullName = [newDoctor.firstName, newDoctor.middleName, newDoctor.lastName]
      .filter(Boolean)
      .join(' ');

    // Validate Photo
    if ((!newDoctor.photo || newDoctor.photo.length < 50) && !newDoctor.photoUrl) {
        errors.push('photo');
    }

    // 2. Validate Name Parts
    if (!newDoctor.firstName) errors.push('firstName');
    if (!newDoctor.lastName) errors.push('lastName');
    // We check the constructed name just in case, but specific fields are better for UI feedback
    if (!fullName) errors.push('name');
    if (!newDoctor.phone || newDoctor.phone.length < 10) errors.push('phone');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newDoctor.email || !emailRegex.test(newDoctor.email)) errors.push('email');
    
    if (!newDoctor.address) errors.push('address');

    const finalDept = isNewDept ? newDeptName : newDoctor.department;
    if (!finalDept) errors.push('department');
    if (!newDoctor.qualification) errors.push('qualification');
    if (newDoctor.experience === '' || newDoctor.experience === null) errors.push('experience');
    if (!newDoctor.regNo) errors.push('regNo');

    if (!newDoctor.morningStart) errors.push('morningStart');
    if (!newDoctor.morningEnd) errors.push('morningEnd');
    if (!newDoctor.eveningStart) errors.push('eveningStart');
    if (!newDoctor.eveningEnd) errors.push('eveningEnd');

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (errors.includes('photo')) setAddDoctorTab('personal');
      else if (['firstName', 'lastName', 'phone', 'email', 'address'].some(f => errors.includes(f))) setAddDoctorTab('personal');
      else if (['department', 'qualification', 'experience', 'regNo'].some(f => errors.includes(f))) setAddDoctorTab('professional');
      else setAddDoctorTab('working_hours');
      
      const msg = errors.includes('photo') ? 'Profile photo is required *' : 'Please fill required fields correctly *';
      return setModalError(msg);
    }
    setInvalidFields([]);

    const clinicId = localStorage.getItem('clinicId');
    const docPayload = {
      clinicId,
      // Add "Dr." prefix automatically to the merged string
      name: `Dr. ${fullName}`,
      phone: newDoctor.phone,
      email: newDoctor.email,
      gender: newDoctor.gender,
      address: newDoctor.address, 
      department: finalDept,
      qualification: newDoctor.qualification,
      experience: newDoctor.experience,
      regNo: newDoctor.regNo,
      morningStart: newDoctor.morningStart,
      morningEnd: newDoctor.morningEnd,
      eveningStart: newDoctor.eveningStart,
      eveningEnd: newDoctor.eveningEnd,
      status: newDoctor.status || 'Available',
      photo: newDoctor.photo || newDoctor.name.charAt(0) 
    };

    try {
      setIsSavingDoctor(true);
      let response;
      if (newDoctor._id) {
        response = await fetch(`${API_BASE_URL}/api/doctors/${newDoctor._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docPayload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/doctors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docPayload)
        });
      }

      if (response.ok) {
        const savedDoc = await response.json();
        
        setData(prev => {
          const isUpdate = prev.doctors.some(d => d._id === savedDoc._id);
          return {
            ...prev,
            doctors: isUpdate 
              ? prev.doctors.map(d => d._id === savedDoc._id ? savedDoc : d) 
              : [...prev.doctors, savedDoc]
          };
        });

        setIsAddDoctorModalOpen(false);
        setNewDoctor(defaultDoctorState);
        setAddDoctorTab('personal');
        setIsNewDept(false);
        setNewDeptName('');
        showNotification(newDoctor._id ? 'Profile Updated' : 'Doctor Added', 'success');
      } else {
        const errData = await response.json();
        setModalError(errData.error || 'Failed to save doctor.');
      }
    } catch (err) {
      setModalError('Server error. Could not save.');
    } finally {
      setIsSavingDoctor(false);
    }
  };

const generateSlots = (doc, dateStr) => {
    const docAppts = (data.calendar30 || []).filter(a => {
      const apptDoctorId = a.doctorId && typeof a.doctorId === 'object' ? a.doctorId._id : a.doctorId;
      return String(apptDoctorId) === String(doc._id) && 
             a.date === dateStr && 
             a.status !== 'Cancelled';
    });
    
    // --- NEW: Helper to convert "02:00 PM" to "14:00" for accurate math ---
    const convertTo24Hour = (timeStr) => {
    if (!timeStr || !timeStr.includes('M')) return timeStr; // Fallback if already 24h
    
    const [time, modifier] = timeStr.split(' ');
    // Convert to numbers immediately for safe math
    let [h, m] = time.split(':').map(Number); 
    
    // The only two rules you ever need for 12-hour to 24-hour conversion:
    if (modifier === 'PM' && h !== 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    
    // Convert back to zero-padded strings (e.g., 9 -> "09")
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

    // --- NEW: Smart Shift Checker (Handles Overnight Shifts) ---
    const checkShift = (slotTime, start, end) => {
      if (!start || !end) return false;
      if (start < end) return slotTime >= start && slotTime < end; // Normal Shift
      if (start > end) return slotTime >= start || slotTime < end; // Overnight Shift
      return false;
    };

    const isWithinShift = (time) => {
      const time24 = convertTo24Hour(time); 
      const isMorning = checkShift(time24, doc.morningStart || '09:00', doc.morningEnd || '13:00');
      const isEvening = checkShift(time24, doc.eveningStart || '17:00', doc.eveningEnd || '21:00');
      return isMorning || isEvening;
    };

    // Filter slots to only show times within the Doctor's shifts
    return TIME_SLOTS.filter(isWithinShift).map(t => {
       const appt = docAppts.find(a => a.time === t);
       return {
         time: t,
         status: appt ? (appt.status === 'Completed' ? 'Completed' : 'Booked') : 'Available'
       };
    });
  };

  const filteredDoctors = (data.doctors || []).filter(doc => {
      if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase()) && !doc.department.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter && doc.status !== statusFilter) return false;
      if (deptFilter && doc.department !== deptFilter) return false;
      return true;
  });

  const sortedDoctors = [...filteredDoctors].sort((a, b) => a.department.localeCompare(b.department));

  const sections = {
    available: sortedDoctors.filter(d => d.status === 'Available'),
    onLeave: sortedDoctors.filter(d => d.status === 'On Leave'),
    inactive: sortedDoctors.filter(d => d.status === 'Inactive')
  };

  const stats = {
    total: (data.doctors || []).length, 
    available: (data.doctors || []).filter(d => d.status === 'Available').length,
    onLeave: (data.doctors || []).filter(d => d.status === 'On Leave').length, 
    inactive: (data.doctors || []).filter(d => d.status === 'Inactive').length
  };
  
  const departments = [...new Set((data.doctors || []).map(d => d.department))];

  const renderDoctorCard = (doc) => {
    const isInactive = doc.status === 'Inactive';
    
    return (
      <div key={doc._id} className={`p-3 rounded-xl border flex flex-col md:flex-row landscape:flex-row md:items-stretch landscape:items-stretch gap-2 md:gap-3 landscape:gap-3 transition-all ${isInactive ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 shadow-sm'}`}>
        
        <div className={`flex-1 min-w-0 flex flex-col ${isInactive ? 'opacity-70' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 mt-0.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-[13px] flex-shrink-0 overflow-hidden">
                {typeof doc.photo === 'string' && doc.photo.length > 50 ? <img src={doc.photo} alt="Doc" className="w-full h-full object-cover"/> : <Building2 size={16} className="text-slate-400" />}
              </div>
              <div>
                <h4 className="font-bold text-[13px] text-slate-800 leading-tight">{doc.name}</h4>
                <p className="text-[10px] text-slate-500 uppercase leading-tight mt-0.5">{doc.department}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-1">Mobile: {doc.phone || 'Not Added'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-bold uppercase transition-colors ${!isInactive ? 'text-teal-600' : 'text-slate-400'}`}>
                {!isInactive ? 'Active' : 'Inactive'}
              </span>
              <button 
                onClick={() => toggleStatus(doc)} 
                className={`w-8 h-4.5 rounded-full p-0.5 transition-all flex-shrink-0 relative ${
                  !isInactive ? 'bg-teal-600' : 'bg-slate-300 ring-2 ring-teal-500/50 ring-offset-1 animate-pulse'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${!isInactive ? 'translate-x-3.5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col landscape:flex-col gap-1.5 border-t md:border-t-0 landscape:border-t-0 md:border-l landscape:border-l border-slate-100 pt-1.5 mt-1.5 md:pt-0 landscape:pt-0 md:mt-0 landscape:mt-0 md:pl-3 landscape:pl-3 items-center md:items-stretch landscape:items-stretch justify-between md:justify-start landscape:justify-start flex-shrink-0 md:w-32 landscape:w-32">
          <button 
            onClick={() => handleEditDoctor(doc)} 
            className={`flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-all ${
              isInactive ? 'opacity-50 cursor-default pointer-events-none' : 'hover:bg-teal-100 active:scale-95'
            }`}
          >
            <Edit2 size={12} /> Edit Profile
          </button>
          <button 
            onClick={() => { setSelectedDoctor(doc); setCalendarDate(new Date().toISOString().split('T')[0]); setIsCalendarModalOpen(true); }} 
            className={`flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-all ${
              isInactive ? 'opacity-50 cursor-default pointer-events-none' : 'hover:bg-blue-100 active:scale-95'
            }`}
          >
            <CalendarDays size={12} /> Calendar
          </button>
        </div>
        
      </div>
    );
  };

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
            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                {(!loading || items.length > 0) ? `(${items.length})` : ''}
            </span>
          </div>
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>
        
        {isExpanded && (
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide relative">
            {loading && items.length === 0 ? (
                <DoctorSkeleton />
            ) : (
                items.length > 0 ? items.map(renderDoctorCard) : <div className="text-center py-6 text-slate-400 text-[11px] italic">No doctors in this section</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckIcon size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="text-[13px] font-bold">{notification.message}</span>
        </div>
      )}

      <ModuleHeader 
        title="Doctors" 
        searchVal={searchQuery} 
        onSearch={setSearchQuery} 
        onFilterClick={() => setIsFilterModalOpen(true)} 
        hasFilter={deptFilter} 
        notifications={notificationStack} 
        onClearAll={handleClearNotifications} 
        onDismiss={handleDismissNotification} 
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col landscape:flex-row min-h-0 p-2 gap-2">
        <div className="flex-none landscape:w-[72px] md:landscape:w-20 landscape:h-full pb-1 landscape:pb-0">
          <div className="flex flex-row landscape:flex-col gap-1.5 landscape:h-full">
            {[
              { label: 'All', val: stats.total, color: 'bg-blue-50 text-blue-700', filterKey: '', isToggle: false },
              { label: 'Available', val: stats.available, color: 'bg-green-50 text-green-700', filterKey: 'Available', isToggle: true },
              { label: 'On Leave', val: stats.onLeave, color: 'bg-amber-50 text-amber-700', filterKey: 'On Leave', isToggle: true },
              { label: 'Inactive', val: stats.inactive, color: 'bg-slate-50 text-slate-500', filterKey: 'Inactive', isToggle: true }
            ].map((s, i) => {
              const isActive = statusFilter === s.filterKey && s.isToggle;
              return (
                <button key={i} onClick={() => setStatusFilter(s.filterKey === statusFilter && s.isToggle ? '' : s.filterKey)}
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
          {renderAccordionSection('available', 'Available', CheckCircle, 'text-green-600', sections.available)}
          {renderAccordionSection('onLeave', 'On Leave', CalendarDays, 'text-amber-600', sections.onLeave)}
          {renderAccordionSection('inactive', 'Inactive', XCircle, 'text-slate-500', sections.inactive)}
        </div>
      </div>

      <FAB icon={Plus} onClick={() => {
        setModalError('');
        setInvalidFields([]);
        setNewDoctor(defaultDoctorState);
        setAddDoctorTab('personal');
        setIsNewDept(false);
        setNewDeptName('');
        setIsAddDoctorModalOpen(true);
      }} />

      {/* FILTER MODAL */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Doctors" footer={
          <div className="flex gap-2">
             <button onClick={() => { setDeptFilter(''); setIsFilterModalOpen(false); }} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white">Clear</button>
             <button onClick={() => setIsFilterModalOpen(false)} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Apply</button>
          </div>
        }>
        <div className="space-y-3">
           <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Department</label>
              <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
           </div>
        </div>
      </Modal>

      {/* ADD/EDIT DOCTOR MODAL */}
      <Modal 
        isOpen={isAddDoctorModalOpen} 
        onClose={() => {
          setIsAddDoctorModalOpen(false);
          setModalError('');
          setInvalidFields([]);
          setIsNewDept(false);
          setNewDeptName('');
          setAddDoctorTab('personal');
          setNewDoctor(defaultDoctorState);
        }} 
        title={newDoctor._id ? "Edit Doctor Profile" : "Add New Doctor"} 
        footer={
          <div className="flex gap-2 w-full">
            {addDoctorTab === 'personal' ? (
              <div className="flex-1" />
            ) : (
              <button 
                onClick={() => setAddDoctorTab(addDoctorTab === 'working_hours' ? 'professional' : 'personal')} 
                className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white"
              >
                Previous
              </button>
            )}
            
            {addDoctorTab === 'working_hours' ? (
              <button 
                onClick={handleSaveDoctor}
                disabled={isSavingDoctor}
                className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingDoctor
                  ? <><Loader2 size={16} className="animate-spin" /> {newDoctor._id ? 'Updating...' : 'Creating...'}</>
                  : newDoctor._id ? "Update Profile" : "Create Profile"}
              </button>
            ) : (
              <button 
                onClick={() => setAddDoctorTab(addDoctorTab === 'personal' ? 'professional' : 'working_hours')} 
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
            <button onClick={() => setAddDoctorTab('personal')} className={`flex-1 py-1.5 text-[11px] uppercase font-bold tracking-wide border-b-2 transition-colors ${addDoctorTab === 'personal' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Personal</button>
            <button onClick={() => setAddDoctorTab('professional')} className={`flex-1 py-1.5 text-[11px] uppercase font-bold tracking-wide border-b-2 transition-colors ${addDoctorTab === 'professional' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Professional</button>
            <button onClick={() => setAddDoctorTab('working_hours')} className={`flex-1 py-1.5 text-[11px] uppercase font-bold tracking-wide border-b-2 transition-colors ${addDoctorTab === 'working_hours' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Hours</button>
          </div>

          <div className="min-h-[160px]">
            {addDoctorTab === 'personal' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div className="flex justify-center mb-1">
                  <label className="relative cursor-pointer group">
                    <div className={`w-14 h-14 rounded-full bg-slate-100 border-2 border-dashed flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors ${invalidFields.includes('photo') ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
                      {newDoctor.photoUrl ? (
                        <img src={newDoctor.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : newDoctor._id && typeof newDoctor.photo === 'string' && newDoctor.photo.length > 50 ? (
                        <img src={newDoctor.photo} alt="Doc" className="w-full h-full object-cover"/>
                      ) : (
                        <div className={`flex flex-col items-center ${invalidFields.includes('photo') ? 'text-red-500' : 'text-slate-400'}`}>
                           <Plus size={16} />
                           <span className="text-[8px] font-bold mt-0.5 uppercase">Photo <span className="text-red-500">*</span></span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handlePhotoInput} 
                    />
                  </label>
                </div>
                <div>
                  {/* NEW: Split Name Inputs */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Full Name <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="text" 
                      placeholder="First *" 
                      className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('firstName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} 
                      value={newDoctor.firstName} 
                      onChange={(e) => handleDocNameInput('firstName', e.target.value)} 
                    />
                    <input 
                      type="text" 
                      placeholder="Middle" 
                      className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" 
                      value={newDoctor.middleName} 
                      onChange={(e) => handleDocNameInput('middleName', e.target.value)} 
                    />
                    <input 
                      type="text" 
                      placeholder="Last *" 
                      className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('lastName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} 
                      value={newDoctor.lastName} 
                      onChange={(e) => handleDocNameInput('lastName', e.target.value)} 
                    />
                  </div>
                </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Phone <span className="text-red-500">*</span></label>
                    <input type="tel" maxLength={10} placeholder="Mobile number" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.phone} onChange={handlePhoneInput} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Gender <span className="text-red-500">*</span></label>
                    <select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newDoctor.gender} onChange={e => setNewDoctor({...newDoctor, gender: e.target.value})}>
                      <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Email <span className="text-red-500">*</span></label>
                  <input type="email" placeholder="Email address" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('email') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.email} onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Address <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Full residential address" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('address') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.address} onChange={e => setNewDoctor({...newDoctor, address: e.target.value})} />
                </div>
              </div>
            )}

            {addDoctorTab === 'professional' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Specialization <span className="text-red-500">*</span></label>
                  <select 
                    className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('department') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                    value={isNewDept ? 'add_new' : newDoctor.department} 
                    onChange={e => {
                      if (e.target.value === 'add_new') {
                        setIsNewDept(true);
                        setNewDoctor({...newDoctor, department: ''});
                      } else {
                        setIsNewDept(false);
                        setNewDoctor({...newDoctor, department: e.target.value});
                      }
                    }}
                  >
                    <option value="">Select Specialization</option>
                    <option value="add_new" className="font-bold text-teal-600">+ Add New Specialization</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {isNewDept && (
                    <input 
                      type="text" 
                      placeholder="Enter New Specialization *" 
                      className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 mt-2 animate-fadeIn outline-none ${invalidFields.includes('department') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                      value={newDeptName} 
                      onChange={e => setNewDeptName(e.target.value)} 
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Qualifications <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. MBBS, MD" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('qualification') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.qualification} onChange={handleQualificationInput} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Experience (Months) <span className="text-red-500">*</span></label>
                    <input type="number" placeholder="Months" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('experience') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.experience} onChange={handleExperienceInput} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase">Reg. Number <span className="text-red-500">*</span></label>
                    <input type="text" maxLength={20} placeholder="Medical Reg No." className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('regNo') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.regNo} onChange={e => setNewDoctor({...newDoctor, regNo: e.target.value})} />
                  </div>
                </div>
              </div>
            )}

            {addDoctorTab === 'working_hours' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 border-b border-slate-100 pb-1">Morning Shift</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Start Time <span className="text-red-500">*</span></label>
                      <input type="time" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('morningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.morningStart} onChange={e => setNewDoctor({...newDoctor, morningStart: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">End Time <span className="text-red-500">*</span></label>
                      <input type="time" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('morningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.morningEnd} onChange={e => setNewDoctor({...newDoctor, morningEnd: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 border-b border-slate-100 pb-1">Evening Shift</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Start Time <span className="text-red-500">*</span></label>
                      <input type="time" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('eveningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.eveningStart} onChange={e => setNewDoctor({...newDoctor, eveningStart: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">End Time <span className="text-red-500">*</span></label>
                      <input type="time" className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('eveningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.eveningEnd} onChange={e => setNewDoctor({...newDoctor, eveningEnd: e.target.value})} />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Working Days <span className="text-red-500">*</span></label>
                  <div className="flex gap-1 flex-wrap">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <label key={day} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[11px] cursor-pointer hover:bg-slate-100">
                        <input type="checkbox" defaultChecked={day !== 'Sun'} className="accent-teal-600" />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* UPDATE STATUS MODAL (REUSED FOR DEACTIVATE / REACTIVATE) */}
      <Modal 
        isOpen={activeModal?.type === 'status_change'} 
        onClose={() => { setActiveModal(null); setModalError(''); setReason(''); setCustomReason(''); }} 
        title={activeModal?.subType === 'activate' ? 'Reactivate Doctor' : 'Deactivate Doctor'} 
        footer={
          <button
            onClick={confirmStatusChange}
            disabled={isStatusSubmitting}
            className={`w-full py-1.5 rounded-lg text-[15px] font-medium text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${activeModal?.subType === 'activate' ? 'bg-teal-600' : 'bg-red-600'}`}
          >
            {isStatusSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Updating...</>
              : activeModal?.subType === 'activate' ? 'Confirm Activation' : 'Confirm Deactivation'}
          </button>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          
          {/* Dynamic Warning Message */}
          <div className={`p-2 rounded-lg flex gap-2 text-[13px] ${activeModal?.subType === 'activate' ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>
             <AlertTriangle size={16} className="shrink-0" />
             <p>{activeModal?.subType === 'activate' ? 'This action will allow new appointments.' : 'This action blocks new appointments.'}</p>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Reason</label>
            <select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select Reason...</option>
              {activeModal?.subType === 'activate' ? (
                  <>
                    <option value="Returned from Leave">Returned from Leave</option>
                    <option value="Re-joined">Re-joined</option>
                    <option value="Others">Others</option>
                  </>
              ) : (
                  <>
                    <option value="Resigned">Resigned</option>
                    <option value="Long Leave">Long Leave</option>
                    <option value="Others">Others</option>
                  </>
              )}
            </select>
          </div>

          {/* Conditional Remarks Box */}
          {reason === 'Others' && (
             <div className="animate-fadeIn">
                <label className="block text-[13px] font-bold text-slate-700 mb-1">Remarks</label>
                <textarea 
                  className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500" 
                  rows="3"
                  placeholder="Enter specific details..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
             </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isCalendarModalOpen} onClose={() => { setIsCalendarModalOpen(false); setSelectedDoctor(null); }} title={selectedDoctor ? `${selectedDoctor.name}'s Calendar` : "Doctor Calendar"}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-bold text-slate-700">Select Date</label>
           <input type="date" min={todayStr} max={maxDateStr} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:ring-1 focus:ring-teal-500" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Available & Booked Slots</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {selectedDoctor && generateSlots(selectedDoctor, calendarDate).map((slot, idx) => (
                <div key={idx} className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center ${
                  slot.status === 'Available' ? 'bg-green-50 border-green-200 text-green-700' :
                  slot.status === 'Completed' ? 'bg-slate-50 border-slate-200 text-slate-500' :
                  slot.status === 'Off-Duty' ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <span className="text-[11px] font-bold">{slot.time}</span>
                  <span className="text-[9px] mt-0.5">{slot.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Doctors;

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, CheckCircle, CalendarDays, XCircle, Building2, AlertTriangle, 
  ChevronDown, ChevronRight, Edit2, CheckCircle as CheckIcon, AlertCircle, Loader2, MoreVertical
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import StatFilterStrip from '../components/ui/StatFilterStrip';
import API_BASE_URL from '../config';
import { getSessionUser } from '../utils/auth';
import { hasPermission } from '../utils/permissions';
import {
  formatTimeLabel,
  generateTimeSlots,
  getClinicSchedule,
  getDoctorShiftWindows,
  isTimeWithinDoctorShift,
  timeToMinutes,
  validateDoctorWorkingHours
} from '../utils/schedule';

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
  const sessionUser = getSessionUser();
  const canManageDoctors = hasPermission(sessionUser.permissions, 'doctors.manage');
  const isSoloWorkspace = data.clinic?.type === 'Solo';
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
  const [openStatusMenuId, setOpenStatusMenuId] = useState('');

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

  const clinicSchedule = useMemo(() => getClinicSchedule(data.clinic || {}), [data.clinic]);
  const clinicHoursForDoctorForm = useMemo(() => ({
    morningStart: clinicSchedule.morningStart,
    morningEnd: clinicSchedule.morningEnd,
    eveningStart: clinicSchedule.eveningStart,
    eveningEnd: clinicSchedule.eveningEnd
  }), [clinicSchedule]);
  const clinicScheduleDisplayLines = useMemo(() => {
    if (clinicSchedule.open24Hours) return ['Open 24 Hours'];

    const lines = [];
    if (clinicSchedule.morningStart && clinicSchedule.morningEnd) {
      lines.push(`${formatTimeLabel(clinicSchedule.morningStart)} - ${formatTimeLabel(clinicSchedule.morningEnd)}`);
    }
    if (clinicSchedule.eveningStart && clinicSchedule.eveningEnd) {
      lines.push(`${formatTimeLabel(clinicSchedule.eveningStart)} - ${formatTimeLabel(clinicSchedule.eveningEnd)}`);
    }

    return lines.length > 0 ? lines : ['Clinic hours not set'];
  }, [clinicSchedule]);
  const editableClinicHoursFallback = useMemo(() => (
    clinicSchedule.open24Hours
      ? {
          morningStart: '',
          morningEnd: '',
          eveningStart: '',
          eveningEnd: ''
        }
      : {
          morningStart: clinicSchedule.morningStart,
          morningEnd: clinicSchedule.morningEnd,
          eveningStart: clinicSchedule.eveningStart,
          eveningEnd: clinicSchedule.eveningEnd
        }
  ), [clinicSchedule]);

  const getWorkspaceDoctorHours = (doctorState = {}, options = {}) => {
    const followsClinicSchedule = isSoloWorkspace
      ? true
      : doctorState.followsClinicSchedule ?? options.defaultFollowsClinicSchedule ?? false;

    if (isSoloWorkspace || followsClinicSchedule) {
      return {
        followsClinicSchedule,
        ...clinicHoursForDoctorForm
      };
    }

    return {
      followsClinicSchedule,
      morningStart: doctorState.morningStart || '',
      morningEnd: doctorState.morningEnd || '',
      eveningStart: doctorState.eveningStart || '',
      eveningEnd: doctorState.eveningEnd || ''
    };
  };

  const getDefaultDoctorState = () => ({
    _id: null,
    firstName: '', middleName: '', lastName: '',
    name: '', phone: '', email: '', gender: 'M', address: '',
    department: '', qualification: '', experience: '', regNo: '',
    ...getWorkspaceDoctorHours({}, { defaultFollowsClinicSchedule: false }),
    photoUrl: '', photo: ''
  });

  // Sync Notification Stack to LocalStorage
  useEffect(() => {
      localStorage.setItem('doc_notifications', JSON.stringify(notificationStack));
  }, [notificationStack]);

  useEffect(() => {
    if (!openStatusMenuId) return;

    const closeMenu = () => setOpenStatusMenuId('');
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openStatusMenuId]);

  const [newDoctor, setNewDoctor] = useState(() => getDefaultDoctorState());

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
        const [docsRes, apptsRes, clinicRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}?tag=doctors`),
          fetch(`${API_BASE_URL}/api/appointments/${clinicId}?tag=appointments`),
          fetch(`${API_BASE_URL}/api/clinics/${clinicId}`)
        ]);

        if (docsRes.ok && apptsRes.ok) {
          const docs = await docsRes.json();
          const appts = await apptsRes.json();
          const clinic = clinicRes.ok ? await clinicRes.json() : null;
          
          setData(prev => ({
            ...prev,
            clinic: clinic || prev.clinic,
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
  const isOwnerDoctor = (doctor) => (
    sessionUser.accountRole === 'super_admin' &&
    String(sessionUser.doctorId || '') === String(doctor?._id || '')
  );

  const getDoctorStatusActions = (doctor) => {
    if (doctor.status === 'Inactive') {
      return [{ label: 'Reactivate', targetStatus: 'Available', tone: 'teal' }];
    }

    const actions = doctor.status === 'On Leave'
      ? [{ label: 'Mark Available', targetStatus: 'Available', tone: 'teal' }]
      : [{ label: 'Mark On Leave', targetStatus: 'On Leave', tone: 'amber' }];

    if (!isOwnerDoctor(doctor)) {
      actions.push({ label: 'Deactivate', targetStatus: 'Inactive', tone: 'red' });
    }

    return actions;
  };

  const openStatusChange = (doctor, targetStatus) => {
    if (targetStatus === 'Inactive' && isOwnerDoctor(doctor)) {
      showNotification(
        'Cannot Deactivate',
        'error',
        'The clinic owner doctor profile must remain active.'
      );
      return;
    }

    if (targetStatus === 'Inactive') {
      const hasAppointments = (data.calendar30 || []).some(a => {
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
    }

    setReason('');
    setCustomReason('');
    setOpenStatusMenuId('');
    setActiveModal({
      type: 'status_change',
      targetStatus,
      doctorId: doctor._id,
      doctorName: doctor.name
    });
  };

  const confirmStatusChange = async () => {
    setModalError('');
    if (!reason) return setModalError('Please select a reason.');
    if (reason === 'Others' && !customReason.trim()) return setModalError('Please enter remarks.');

    const finalReason = reason === 'Others' ? customReason : reason;
    const targetStatus = activeModal.targetStatus || 'Available';

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
        
        const actionWord = targetStatus === 'Inactive'
          ? 'Deactivated'
          : targetStatus === 'On Leave'
            ? 'Marked On Leave'
            : 'Activated';
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

  const handleEditDoctor = async (doc) => {
    const clinicId = localStorage.getItem('clinicId');
    let resolvedDoctor = doc;

    if (clinicId && doc?._id) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/doctors/${clinicId}/${doc._id}`);
        if (response.ok) {
          resolvedDoctor = await response.json();
        }
      } catch (error) {
        console.error('Error fetching doctor detail:', error);
      }
    }

    // 1. Remove "Dr." prefix and trim
    const rawName = resolvedDoctor.name.replace(/^Dr\.\s*/, '').trim();
    
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
      ...getDefaultDoctorState(),
      ...resolvedDoctor,
      ...getWorkspaceDoctorHours(resolvedDoctor),
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

  const handleFollowsClinicScheduleChange = (checked) => {
    setNewDoctor(prev => ({
      ...prev,
      followsClinicSchedule: checked,
      ...(checked
        ? clinicHoursForDoctorForm
        : clinicSchedule.open24Hours
          ? {
              morningStart: '',
              morningEnd: '',
              eveningStart: '',
              eveningEnd: ''
            }
          : {
              morningStart: prev.morningStart,
              morningEnd: prev.morningEnd,
              eveningStart: prev.eveningStart,
              eveningEnd: prev.eveningEnd
            })
    }));

    if (checked) {
      setInvalidFields(prev => prev.filter(field => !['morningStart', 'morningEnd', 'eveningStart', 'eveningEnd'].includes(field)));
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

    const doctorFollowsClinicSchedule = newDoctor.followsClinicSchedule === true;
    if (!isSoloWorkspace && !doctorFollowsClinicSchedule && !newDoctor.morningStart) errors.push('morningStart');
    if (!isSoloWorkspace && !doctorFollowsClinicSchedule && !newDoctor.morningEnd) errors.push('morningEnd');
    if (!isSoloWorkspace && !doctorFollowsClinicSchedule && ((newDoctor.eveningStart && !newDoctor.eveningEnd) || (!newDoctor.eveningStart && newDoctor.eveningEnd))) {
      errors.push('eveningStart', 'eveningEnd');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (errors.includes('photo')) setAddDoctorTab('personal');
      else if (['firstName', 'lastName', 'phone', 'email', 'address'].some(f => errors.includes(f))) setAddDoctorTab('personal');
      else if (['department', 'qualification', 'experience', 'regNo'].some(f => errors.includes(f))) setAddDoctorTab('professional');
      else setAddDoctorTab(isSoloWorkspace ? 'professional' : 'working_hours');
      
      const msg = errors.includes('photo') ? 'Profile photo is required *' : 'Please fill required fields correctly *';
      return setModalError(msg);
    }

    const resolvedDoctorHours = getWorkspaceDoctorHours(newDoctor);
    const doctorHoursError = validateDoctorWorkingHours({
      ...resolvedDoctorHours,
      followsClinicSchedule: doctorFollowsClinicSchedule,
      clinic: data.clinic || {}
    });

    if (doctorHoursError) {
      setInvalidFields(['morningStart', 'morningEnd', 'eveningStart', 'eveningEnd']);
      setAddDoctorTab('working_hours');
      return setModalError(doctorHoursError);
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
      ...resolvedDoctorHours,
      followsClinicSchedule: doctorFollowsClinicSchedule,
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
        setNewDoctor(getDefaultDoctorState());
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

    const doctorShifts = getDoctorShiftWindows(doc, data.clinic || {});
    const slotTimes = [...new Set([
      ...generateTimeSlots(clinicSchedule.appointmentWindowMinutes),
      ...docAppts.map((appt) => appt.time)
    ])]
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    return slotTimes
      .filter((time) => isTimeWithinDoctorShift(time, doctorShifts))
      .map(t => {
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
  const statsConfig = [
    { key: 'all', label: 'All', val: stats.total, color: 'bg-blue-50 text-blue-700', filterKey: '', isToggle: false },
    { key: 'available', label: 'Available', val: stats.available, color: 'bg-green-50 text-green-700', filterKey: 'Available', isToggle: true },
    { key: 'on-leave', label: 'On Leave', val: stats.onLeave, color: 'bg-amber-50 text-amber-700', filterKey: 'On Leave', isToggle: true },
    { key: 'inactive', label: 'Inactive', val: stats.inactive, color: 'bg-slate-50 text-slate-500', filterKey: 'Inactive', isToggle: true }
  ];
  
  const departments = [...new Set((data.doctors || []).map(d => d.department))];

  const renderDoctorCard = (doc) => {
    const isInactive = doc.status === 'Inactive';
    const isOwnerDoctorProfile = isOwnerDoctor(doc);
    const statusActions = getDoctorStatusActions(doc);

    return (
      <div key={doc._id} className={`p-3 rounded-xl border flex flex-col md:flex-row landscape:flex-row md:items-stretch landscape:items-stretch gap-2 md:gap-3 landscape:gap-3 transition-all relative ${isInactive ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 shadow-sm'}`}>
        
        <div className={`flex-1 min-w-0 flex flex-col ${isInactive ? 'opacity-70' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 mt-0.5">
              <div className="type-card-title w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0 overflow-hidden">
                {typeof doc.photo === 'string' && doc.photo.length > 50 ? <img src={doc.photo} alt="Doc" className="w-full h-full object-cover"/> : <Building2 size={16} className="text-slate-400" />}
              </div>
              <div>
                <h4 className="type-card-title text-slate-800 leading-tight">{doc.name}</h4>
                <p className="type-utility uppercase text-slate-500 leading-tight mt-0.5">{doc.department}</p>
                <p className="type-label text-slate-400 leading-tight mt-1">Mobile: {doc.phone || 'Not Added'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1 relative">
              {canManageDoctors && (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenStatusMenuId(prev => prev === doc._id ? '' : doc._id);
                  }}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:bg-teal-50 flex items-center justify-center"
                  aria-label="Doctor status actions"
                >
                  <MoreVertical size={14} />
                </button>
              )}
              {openStatusMenuId === doc._id && (
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-slate-200 bg-white shadow-lg py-1"
                >
                  {statusActions.map((action) => (
                    <button
                      key={action.targetStatus}
                      type="button"
                      onClick={() => openStatusChange(doc, action.targetStatus)}
                      className={`type-label w-full px-3 py-2 text-left hover:bg-slate-50 ${
                        action.tone === 'red'
                          ? 'text-red-600'
                          : action.tone === 'amber'
                            ? 'text-amber-700'
                            : 'text-teal-700'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col landscape:flex-col gap-1.5 border-t md:border-t-0 landscape:border-t-0 md:border-l landscape:border-l border-slate-100 pt-1.5 mt-1.5 md:pt-0 landscape:pt-0 md:mt-0 landscape:mt-0 md:pl-3 landscape:pl-3 items-center md:items-stretch landscape:items-stretch justify-between md:justify-start landscape:justify-start flex-shrink-0 md:w-32 landscape:w-32">
          <button 
            onClick={() => handleEditDoctor(doc)} 
            className={`type-label flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-teal-600 bg-teal-50 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-all ${
              isInactive ? 'opacity-50 cursor-default pointer-events-none' : 'hover:bg-teal-100 active:scale-95'
            }`}
          >
            <Edit2 size={12} /> Edit Profile
          </button>
          <button 
            onClick={() => { setSelectedDoctor(doc); setCalendarDate(new Date().toISOString().split('T')[0]); setIsCalendarModalOpen(true); }} 
            className={`type-label flex-1 md:flex-none landscape:flex-none w-full h-7 landscape:h-auto md:landscape:h-7 landscape:py-1 md:landscape:py-0 px-3 text-blue-600 bg-blue-50 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-all ${
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
            <h3 className="type-section-title">{title}</h3>
            <span className="type-label ml-1.5 text-slate-400 font-normal">
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
                items.length > 0 ? items.map(renderDoctorCard) : <div className="type-secondary text-center py-6 text-slate-400 italic">No doctors in this section</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const statusTarget = activeModal?.targetStatus || 'Available';
  const statusModalTitle = statusTarget === 'Inactive'
    ? 'Deactivate Doctor'
    : statusTarget === 'On Leave'
      ? 'Mark Doctor On Leave'
      : 'Mark Doctor Available';
  const statusModalTone = statusTarget === 'Inactive'
    ? 'red'
    : statusTarget === 'On Leave'
      ? 'amber'
      : 'teal';
  const statusModalMessage = statusTarget === 'Inactive'
    ? 'This action deactivates the doctor profile and blocks new appointments.'
    : statusTarget === 'On Leave'
      ? 'This action pauses new appointments while keeping the doctor profile active.'
      : 'This action allows new appointments again.';
  const statusConfirmLabel = statusTarget === 'Inactive'
    ? 'Confirm Deactivation'
    : statusTarget === 'On Leave'
      ? 'Confirm Leave'
      : 'Confirm Availability';

  return (
    <div className="h-full flex flex-col relative">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckIcon size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="type-body">{notification.message}</span>
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

      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
        <StatFilterStrip
          items={statsConfig}
          isActive={(item) => item.isToggle && statusFilter === item.filterKey}
          onSelect={(item) => setStatusFilter(item.isToggle && item.filterKey === statusFilter ? '' : item.filterKey)}
        />

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {renderAccordionSection('available', 'Available', CheckCircle, 'text-green-600', sections.available)}
          {renderAccordionSection('onLeave', 'On Leave', CalendarDays, 'text-amber-600', sections.onLeave)}
          {renderAccordionSection('inactive', 'Inactive', XCircle, 'text-slate-500', sections.inactive)}
        </div>
      </div>

      {canManageDoctors && <FAB icon={Plus} onClick={() => {
        setModalError('');
        setInvalidFields([]);
        setNewDoctor(getDefaultDoctorState());
        setAddDoctorTab('personal');
        setIsNewDept(false);
        setNewDeptName('');
        setIsAddDoctorModalOpen(true);
      }} />}

      {/* FILTER MODAL */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Doctors" footer={
          <div className="flex gap-2">
             <button onClick={() => { setDeptFilter(''); setIsFilterModalOpen(false); }} className="type-section-title flex-1 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white">Clear</button>
             <button onClick={() => setIsFilterModalOpen(false)} className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg">Apply</button>
          </div>
        }>
        <div className="space-y-3">
           <div>
              <label className="type-body block text-slate-700 mb-1">Department</label>
              <select className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
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
          setNewDoctor(getDefaultDoctorState());
        }} 
        title={newDoctor._id ? "Edit Doctor Profile" : "Add New Doctor"} 
        footer={
          <div className="flex gap-2 w-full">
            {addDoctorTab === 'personal' ? (
              <div className="flex-1" />
            ) : (
              <button 
                onClick={() => setAddDoctorTab(addDoctorTab === 'working_hours' ? 'professional' : 'personal')} 
                className="type-section-title flex-1 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white"
              >
                Previous
              </button>
            )}
            
            {(addDoctorTab === 'working_hours' || (isSoloWorkspace && addDoctorTab === 'professional')) ? (
              <button 
                onClick={handleSaveDoctor}
                disabled={isSavingDoctor}
                className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingDoctor
                  ? <><Loader2 size={16} className="animate-spin" /> {newDoctor._id ? 'Updating...' : 'Creating...'}</>
                  : newDoctor._id ? "Update Profile" : "Create Profile"}
              </button>
            ) : (
              <button 
                onClick={() => setAddDoctorTab(addDoctorTab === 'personal' ? 'professional' : 'working_hours')} 
                className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg"
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
            <button onClick={() => setAddDoctorTab('personal')} className={`type-utility flex-1 py-1.5 uppercase border-b-2 transition-colors ${addDoctorTab === 'personal' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Personal</button>
            <button onClick={() => setAddDoctorTab('professional')} className={`type-utility flex-1 py-1.5 uppercase border-b-2 transition-colors ${addDoctorTab === 'professional' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Professional</button>
            {!isSoloWorkspace && (
              <button onClick={() => setAddDoctorTab('working_hours')} className={`type-utility flex-1 py-1.5 uppercase border-b-2 transition-colors ${addDoctorTab === 'working_hours' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Hours</button>
            )}
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
                           <span className="type-utility mt-0.5 uppercase">Photo <span className="text-red-500">*</span></span>
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
                  <label className="type-label block text-slate-500 mb-0.5 uppercase">Full Name <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="text" 
                      placeholder="First *" 
                      className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('firstName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} 
                      value={newDoctor.firstName} 
                      onChange={(e) => handleDocNameInput('firstName', e.target.value)} 
                    />
                    <input 
                      type="text" 
                      placeholder="Middle" 
                      className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" 
                      value={newDoctor.middleName} 
                      onChange={(e) => handleDocNameInput('middleName', e.target.value)} 
                    />
                    <input 
                      type="text" 
                      placeholder="Last *" 
                      className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('lastName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} 
                      value={newDoctor.lastName} 
                      onChange={(e) => handleDocNameInput('lastName', e.target.value)} 
                    />
                  </div>
                </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="type-label block text-slate-500 mb-0.5 uppercase">Phone <span className="text-red-500">*</span></label>
                    <input type="tel" maxLength={10} placeholder="Mobile number" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.phone} onChange={handlePhoneInput} />
                  </div>
                  <div>
                    <label className="type-label block text-slate-500 mb-0.5 uppercase">Gender <span className="text-red-500">*</span></label>
                    <select className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newDoctor.gender} onChange={e => setNewDoctor({...newDoctor, gender: e.target.value})}>
                      <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="type-label block text-slate-500 mb-0.5 uppercase">Email <span className="text-red-500">*</span></label>
                  <input type="email" placeholder="Email address" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('email') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.email} onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} />
                </div>
                <div>
                  <label className="type-label block text-slate-500 mb-0.5 uppercase">Address <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Full residential address" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('address') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.address} onChange={e => setNewDoctor({...newDoctor, address: e.target.value})} />
                </div>
              </div>
            )}

            {addDoctorTab === 'professional' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div>
                  <label className="type-label block text-slate-500 mb-0.5 uppercase">Specialization <span className="text-red-500">*</span></label>
                  <select 
                    className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('department') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
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
                      className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 mt-2 animate-fadeIn outline-none ${invalidFields.includes('department') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                      value={newDeptName} 
                      onChange={e => setNewDeptName(e.target.value)} 
                    />
                  )}
                </div>
                <div>
                  <label className="type-label block text-slate-500 mb-0.5 uppercase">Qualifications <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. MBBS, MD" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('qualification') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.qualification} onChange={handleQualificationInput} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="type-label block text-slate-500 mb-0.5 uppercase">Experience (Months) <span className="text-red-500">*</span></label>
                    <input type="number" placeholder="Months" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('experience') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.experience} onChange={handleExperienceInput} />
                  </div>
                  <div>
                    <label className="type-label block text-slate-500 mb-0.5 uppercase">Reg. Number <span className="text-red-500">*</span></label>
                    <input type="text" maxLength={20} placeholder="Medical Reg No." className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('regNo') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.regNo} onChange={e => setNewDoctor({...newDoctor, regNo: e.target.value})} />
                  </div>
                </div>
              </div>
            )}

            {addDoctorTab === 'working_hours' && !isSoloWorkspace && (
              <div className="space-y-4 animate-fadeIn">
                <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="type-utility uppercase text-teal-700">Clinic Schedule</p>
                      <div className="mt-0.5 space-y-0.5">
                        {clinicScheduleDisplayLines.map(line => (
                          <p key={line} className="type-secondary text-teal-900">{line}</p>
                        ))}
                      </div>
                    </div>
                    <label className="type-label flex shrink-0 items-center gap-1.5 rounded-md border border-teal-200 bg-white px-2.5 py-1 text-teal-700">
                      <input
                        type="checkbox"
                        checked={newDoctor.followsClinicSchedule === true}
                        onChange={e => handleFollowsClinicScheduleChange(e.target.checked)}
                        className="accent-teal-600"
                      />
                      <span>Same as clinic</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="type-utility uppercase text-slate-700 mb-1 border-b border-slate-100 pb-1">Morning Shift</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="type-label block text-slate-500 mb-0.5 uppercase">Start Time <span className="text-red-500">*</span></label>
                      <input type="time" disabled={newDoctor.followsClinicSchedule === true} min={editableClinicHoursFallback.morningStart} max={editableClinicHoursFallback.morningEnd} className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('morningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.morningStart} onChange={e => setNewDoctor({...newDoctor, morningStart: e.target.value})} />
                    </div>
                    <div>
                      <label className="type-label block text-slate-500 mb-0.5 uppercase">End Time <span className="text-red-500">*</span></label>
                      <input type="time" disabled={newDoctor.followsClinicSchedule === true} min={editableClinicHoursFallback.morningStart} max={editableClinicHoursFallback.morningEnd} className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('morningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.morningEnd} onChange={e => setNewDoctor({...newDoctor, morningEnd: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-1">
                    <h4 className="type-utility uppercase text-slate-700">Evening Shift</h4>
                    <button
                      type="button"
                      disabled={newDoctor.followsClinicSchedule === true}
                      onClick={() => setNewDoctor(prev => ({ ...prev, eveningStart: '', eveningEnd: '' }))}
                      className="type-utility uppercase text-slate-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="type-label block text-slate-500 mb-0.5 uppercase">Start Time</label>
                      <input type="time" disabled={newDoctor.followsClinicSchedule === true} min={editableClinicHoursFallback.eveningStart || editableClinicHoursFallback.morningStart} max={editableClinicHoursFallback.eveningEnd || editableClinicHoursFallback.morningEnd} className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('eveningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.eveningStart} onChange={e => setNewDoctor({...newDoctor, eveningStart: e.target.value})} />
                    </div>
                    <div>
                      <label className="type-label block text-slate-500 mb-0.5 uppercase">End Time</label>
                      <input type="time" disabled={newDoctor.followsClinicSchedule === true} min={editableClinicHoursFallback.eveningStart || editableClinicHoursFallback.morningStart} max={editableClinicHoursFallback.eveningEnd || editableClinicHoursFallback.morningEnd} className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('eveningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newDoctor.eveningEnd} onChange={e => setNewDoctor({...newDoctor, eveningEnd: e.target.value})} />
                    </div>
                  </div>
                  <p className="type-label mt-1 text-slate-400">Optional. Leave this blank if the doctor follows a single continuous shift.</p>
                </div>
                
                <div>
                  <label className="type-label block text-slate-500 mb-1.5 uppercase">Working Days <span className="text-red-500">*</span></label>
                  <div className="flex gap-1 flex-wrap">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <label key={day} className="type-label flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-100">
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
        title={statusModalTitle} 
        footer={
          <button
            onClick={confirmStatusChange}
            disabled={isStatusSubmitting}
            className={`type-section-title w-full py-1.5 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
              statusModalTone === 'red'
                ? 'bg-red-600'
                : statusModalTone === 'amber'
                  ? 'bg-amber-600'
                  : 'bg-teal-600'
            }`}
          >
            {isStatusSubmitting
              ? <><Loader2 size={16} className="animate-spin" /> Updating...</>
              : statusConfirmLabel}
          </button>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          
          {/* Dynamic Warning Message */}
          <div className={`type-body p-2 rounded-lg flex gap-2 ${
            statusModalTone === 'teal'
              ? 'bg-teal-50 text-teal-800'
              : statusModalTone === 'amber'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-800'
          }`}>
             <AlertTriangle size={16} className="shrink-0" />
             <p>{statusModalMessage}</p>
          </div>

          <div>
            <label className="type-body block text-slate-700 mb-1">Reason</label>
            <select className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select Reason...</option>
              {statusTarget === 'Available' ? (
                  <>
                    <option value="Returned from Leave">Returned from Leave</option>
                    <option value="Re-joined">Re-joined</option>
                    <option value="Others">Others</option>
                  </>
              ) : statusTarget === 'On Leave' ? (
                  <>
                    <option value="Short Leave">Short Leave</option>
                    <option value="Long Leave">Long Leave</option>
                    <option value="Personal Leave">Personal Leave</option>
                    <option value="Others">Others</option>
                  </>
              ) : (
                  <>
                    <option value="Resigned">Resigned</option>
                    <option value="No longer associated">No longer associated</option>
                    <option value="Others">Others</option>
                  </>
              )}
            </select>
          </div>

          {/* Conditional Remarks Box */}
          {reason === 'Others' && (
             <div className="animate-fadeIn">
                <label className="type-body block text-slate-700 mb-1">Remarks</label>
                <textarea 
                  className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500" 
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
            <label className="type-body text-slate-700">Select Date</label>
           <input type="date" min={todayStr} max={maxDateStr} className="type-body p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} />
          </div>
          <div>
            <h4 className="type-utility uppercase text-slate-500 mb-2">Available & Booked Slots</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {selectedDoctor && generateSlots(selectedDoctor, calendarDate).map((slot, idx) => (
                <div key={idx} className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center ${
                  slot.status === 'Available' ? 'bg-green-50 border-green-200 text-green-700' :
                  slot.status === 'Completed' ? 'bg-slate-50 border-slate-200 text-slate-500' :
                  slot.status === 'Off-Duty' ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <span className="type-label">{slot.time}</span>
                  <span className="type-label mt-0.5">{slot.status}</span>
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

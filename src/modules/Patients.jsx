import React, { useState, useRef, useEffect } from 'react';
import PatientHistoryList, { filterValidHistory } from '../components/ui/PatientHistoryList';
import { 
  Plus, ChevronDown, Edit2, Loader2, CheckCircle, AlertCircle, Users, X, History, Clock,
  Activity, FileText, Pill, FlaskConical, Phone, Mail, MapPin, Droplet, CalendarDays, Wallet, Save, MoreVertical, VenusAndMars, ReceiptText
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import StatFilterStrip from '../components/ui/StatFilterStrip';
import BillingPaymentModal from '../components/billing/BillingPaymentModal';
import { useGlobalDate } from '../context/DateContext';
import { getLocalDateString } from '../utils/dateUtils';
import { printReceiptDocument } from '../utils/postConsultPrint';
import {
  formatBillingCurrency,
  getAppointmentBillingAmounts,
  getBillingStatus,
  getBillingStatusClass,
  hasBillingRecord
} from '../utils/billingUtils';
import API_BASE_URL from '../config';
import { authFetch, getSessionUser } from '../utils/auth';
import { hasPermission } from '../utils/permissions';





  

// Note: I included data & setData in the props so App.jsx stays perfectly happy
const Patients = ({ data, setData, onLogout, onBookAppointment, bookingNotification, onBookingNotificationConsumed }) => {
  const dateContext = useGlobalDate();
  const safeCurrentDate = dateContext?.currentDate || getLocalDateString();
  const clinicId = localStorage.getItem('clinicId');
  const userRole = localStorage.getItem('userRole') || 'admin';
  const doctorId = localStorage.getItem('doctorId') || '';
  const sessionUser = getSessionUser();
  const canManagePatients = hasPermission(sessionUser.permissions, 'patients.create_edit');
  const canManageAppointments = hasPermission(sessionUser.permissions, 'appointments.manage');

  const rbacQuery = `&userRole=${userRole}&doctorId=${doctorId}`;

  // --- STATE MANAGEMENT ---
  const [patients, setPatients] = useState(() => data.cachedPatients || []);
  const [totalPatients, setTotalPatients] = useState(() => data.cachedPatientTotal || data.cachedPatientStats?.total || 0);
  const [page, setPage] = useState(() => data.cachedPatientPage || 1);
  const [stats, setStats] = useState(() => data.cachedPatientStats || { total: 0, new: 0, returning: 0, noVisit: 0 });
  
  const [loading, setLoading] = useState(() => !(data.cachedPatients && data.cachedPatients.length > 0));
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [openPatientMenuId, setOpenPatientMenuId] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);
  const [activePatientTab, setActivePatientTab] = useState('profile');
  const [editingProfileField, setEditingProfileField] = useState('');
  const [profileDraftValue, setProfileDraftValue] = useState('');
  const [profileNameDraft, setProfileNameDraft] = useState({ firstName: '', middleName: '', lastName: '' });
  const [savingProfileField, setSavingProfileField] = useState('');
  const [profileInlineError, setProfileInlineError] = useState('');
  const hasActiveFilters = typeFilter !== '' || dateRange.from || dateRange.to || searchQuery !== '';
  const statsConfig = [
    { key: 'all', label: 'All', val: stats?.total || 0, color: 'bg-blue-50 text-blue-700', filterKey: '', isToggle: false },
    { key: 'new', label: 'New', val: stats?.new || 0, color: 'bg-green-50 text-green-700', filterKey: 'New', isToggle: true },
    { key: 'returning', label: 'Returning', val: stats?.returning || 0, color: 'bg-amber-50 text-amber-700', filterKey: 'Returning', isToggle: true },
    { key: 'follow-up', label: 'Follow-Up', val: '-', color: 'bg-red-50 text-red-700', filterKey: '', isToggle: false }
  ];

  // Notifications
  const [notification, setNotification] = useState(null);
  const [notificationStack, setNotificationStack] = useState(() => {
    try { const saved = localStorage.getItem('pat_notifications'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  useEffect(() => { localStorage.setItem('pat_notifications', JSON.stringify(notificationStack)); }, [notificationStack]);

  useEffect(() => {
    if (!openPatientMenuId) return undefined;

    const dismissMenu = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-patient-actions-menu]')) {
        setOpenPatientMenuId('');
      }
    };

    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') setOpenPatientMenuId('');
    };

    document.addEventListener('pointerdown', dismissMenu);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissMenu);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [openPatientMenuId]);

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
  const [detailVisitHistory, setDetailVisitHistory] = useState([]);
  const [isDetailVisitLoading, setIsDetailVisitLoading] = useState(false);
  const [detailVisitError, setDetailVisitError] = useState('');
  const [detailVisitPatientId, setDetailVisitPatientId] = useState('');
  const [isBillingPaymentModalOpen, setIsBillingPaymentModalOpen] = useState(false);
  const [billingPaymentContext, setBillingPaymentContext] = useState(null);
  const [openingBillingAppointmentId, setOpeningBillingAppointmentId] = useState('');

  const defaultPatientState = { 
    _id: null, firstName: '', middleName: '', lastName: '', name: '', 
    phone: '', age: '', gender: 'M', bloodGroup: '', email: '', address: '', type: 'New', lastVisit: null 
  };
  const [newPatient, setNewPatient] = useState(defaultPatientState);

  // Refs for debouncing
  const searchTimeoutRef = useRef(null);
  const queryRef = useRef(searchQuery);
  const typeRef = useRef(typeFilter);
  const pageRef = useRef(page);

  useEffect(() => { queryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { typeRef.current = typeFilter; }, [typeFilter]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // --- NOTIFICATION HELPERS ---
  const showNotification = (shortMessage, type = 'success', detailedMessage = null) => {
    setNotification({ message: shortMessage, type });
    setTimeout(() => setNotification(null), 3000);
    const newNotif = { id: Date.now(), message: detailedMessage || shortMessage, type, timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    setNotificationStack(prev => [newNotif, ...prev]);
  };

  const handleClearNotifications = () => setNotificationStack([]);
  const handleDismissNotification = (id) => setNotificationStack(prev => prev.filter(n => n.id !== id));

  useEffect(() => {
    if (!bookingNotification) return;
    showNotification(
      bookingNotification.shortMessage || 'Appointment Booked',
      bookingNotification.type || 'success',
      bookingNotification.detailedMessage
    );
    onBookingNotificationConsumed?.();
  }, [bookingNotification, onBookingNotificationConsumed]);

  // --- DATA FETCHING ---
  const fetchPatientData = async (targetPage = 1, isBackgroundSync = false) => {
    if (!clinicId) return;
    const isDefaultView = !queryRef.current && !typeRef.current && !dateRange.from && !dateRange.to;
    
    if (targetPage === 1 && !isBackgroundSync) {
       if (queryRef.current) setIsSearching(true);
       else setLoading(true);
    }

    try {
      const promises = [];
      
      // 1. Fetch Stats (Snapshot) - WITH FAILSAFES
      promises.push(
        fetch(`${API_BASE_URL}/api/patients/${clinicId}?mode=snapshot&date=${safeCurrentDate}${rbacQuery}`)
          .then(res => res.json())
          .then(resData => {
             if (resData && resData.stats) {
                 setStats(resData.stats);
                 if (isDefaultView && setData) {
                   setData(prev => ({ ...prev, cachedPatientStats: resData.stats }));
                 }
             }
          })
          .catch(() => console.log("Stats fetch failed quietly"))
      );

      // 2. Fetch List
      let url = `${API_BASE_URL}/api/patients/${clinicId}?mode=list&page=${targetPage}&limit=20&date=${safeCurrentDate}${rbacQuery}`;
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
              if (isDefaultView && setData) {
                setData(prev => ({
                  ...prev,
                  cachedPatients: incomingPatients,
                  cachedPatientPage: 1,
                  cachedPatientTotal: resData.total || 0
                }));
              }
            } else {
              setPatients(prev => {
                const existingIds = new Set(prev.map(p => p._id));
                const uniqueNew = incomingPatients.filter(p => !existingIds.has(p._id));
                const nextPatients = [...prev, ...uniqueNew];
                if (isDefaultView && setData) {
                  setData(dataPrev => ({
                    ...dataPrev,
                    cachedPatients: nextPatients,
                    cachedPatientPage: targetPage,
                    cachedPatientTotal: resData.total || 0
                  }));
                }
                return nextPatients;
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
    const interval = setInterval(() => fetchPatientData(pageRef.current, true), 60000);
    return () => clearInterval(interval);
  }, [typeFilter, dateRange.from, dateRange.to, safeCurrentDate]); 

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

  const fetchPatientHistory = async (patientId) => {
    const res = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=history&patientId=${patientId}${rbacQuery}`);
    const data = await res.json().catch(() => ([]));
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch history');
    return filterValidHistory(data);
  };

  const openHistoryModal = async (p) => {
    setSelectedHistoryPatient(p);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      setPatientHistory(await fetchPatientHistory(p._id));
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

  const formatGender = (gender) => ({ M: 'Male', F: 'Female', O: 'Other' }[gender] || gender || '-');
  const getPatientInitial = (patient) => (patient?.name || '?').trim().charAt(0).toUpperCase() || '?';
  const getShortEntityId = (prefix, entity) => {
    const id = typeof entity === 'string' ? entity : entity?._id;
    return id ? `${prefix}-${String(id).slice(-6).toUpperCase()}` : '';
  };
  const isBillingAvailableForAppointment = (appt) => (
    ['Checked In', 'In Consultation', 'Draft', 'Completed', 'Awaiting Reports', 'Walked Out'].includes(appt?.status)
  );
  const getPatientAppointmentBillingAmounts = (appt) => (
    isBillingAvailableForAppointment(appt) || hasBillingRecord(appt)
      ? getAppointmentBillingAmounts(appt, data.clinic)
      : { total: 0, paid: 0, balance: 0 }
  );
  const getPatientAppointmentBillingStatus = (appt) => (
    isBillingAvailableForAppointment(appt) || hasBillingRecord(appt)
      ? getBillingStatus(appt, data.clinic)
      : 'Unbilled'
  );
  const getBillingTotals = (appointments = []) => appointments.reduce((totals, appt) => {
    const { total, paid, balance } = getPatientAppointmentBillingAmounts(appt);
    totals.total += total;
    totals.paid += paid;
    totals.balance += balance;
    if (hasBillingRecord(appt)) totals.receipts += 1;
    return totals;
  }, { total: 0, paid: 0, balance: 0, receipts: 0 });
  const getPatientNameParts = (patient = {}) => {
    const parts = String(patient.name || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
      lastName: parts.length > 1 ? parts[parts.length - 1] : ''
    };
  };

  const openPatientDetail = (patient) => {
    setSelectedPatientDetail(patient);
    setActivePatientTab('profile');
    setEditingProfileField('');
    setProfileDraftValue('');
    setProfileNameDraft({ firstName: '', middleName: '', lastName: '' });
    setProfileInlineError('');
    setDetailVisitHistory([]);
    setDetailVisitError('');
    setDetailVisitPatientId('');
  };

  const loadPatientDetailVisits = async (patient = selectedPatientDetail, force = false) => {
    if (!patient?._id || isDetailVisitLoading) return;
    if (!force && detailVisitPatientId === patient._id) return;

    setIsDetailVisitLoading(true);
    setDetailVisitError('');
    setDetailVisitPatientId(patient._id);
    try {
      setDetailVisitHistory(await fetchPatientHistory(patient._id));
    } catch (err) {
      setDetailVisitHistory([]);
      setDetailVisitError('Failed to load visit history.');
    } finally {
      setIsDetailVisitLoading(false);
    }
  };

  const handlePatientDetailTabChange = (tabId) => {
    setActivePatientTab(tabId);
    if (tabId === 'visits' || tabId === 'billing') {
      loadPatientDetailVisits();
    }
  };

  const loadBillingContext = async (appt) => {
    const fallbackContext = {
      appointment: appt,
      patient: appt?.patientId || selectedPatientDetail || {},
      doctor: appt?.doctorId || {}
    };

    if (!appt?._id || !clinicId) return fallbackContext;

    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/visit/${appt._id}/post-consult?clinicId=${clinicId}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return fallbackContext;
      return {
        appointment: result.appointment || fallbackContext.appointment,
        patient: result.patient || fallbackContext.patient,
        doctor: result.doctor || fallbackContext.doctor
      };
    } catch (err) {
      return fallbackContext;
    }
  };

  const openBillingPayment = async (appt) => {
    if (!appt?._id || openingBillingAppointmentId) return;
    setOpeningBillingAppointmentId(appt._id);
    try {
      const context = await loadBillingContext(appt);
      if (context.appointment?._id) {
        setDetailVisitHistory(prev => prev.map(item => item._id === context.appointment._id ? { ...item, ...context.appointment } : item));
      }
      setBillingPaymentContext(context);
      setIsBillingPaymentModalOpen(true);
    } finally {
      setOpeningBillingAppointmentId('');
    }
  };

  const handlePrintReceipt = async (appt) => {
    try {
      const context = await loadBillingContext(appt);
      const didPrint = printReceiptDocument({
        clinic: data.clinic,
        appointment: context.appointment,
        patient: context.patient,
        doctor: context.doctor
      });

      if (!didPrint) {
        showNotification('No billing receipt found for this visit.', 'error');
      }
    } catch (err) {
      showNotification('Failed to print receipt.', 'error');
    }
  };

  const handleBillingSaved = (updatedAppointment) => {
    if (updatedAppointment?._id) {
      setDetailVisitHistory(prev => prev.map(appt => appt._id === updatedAppointment._id ? { ...appt, ...updatedAppointment } : appt));
    }
    showNotification('Billing Updated', 'success', 'Payment details have been saved and receipt generated.');
  };

  const updatePatientLocally = (updatedPatient) => {
    setSelectedPatientDetail(updatedPatient);
    setPatients(prev => prev.map(patient => patient._id === updatedPatient._id ? { ...patient, ...updatedPatient } : patient));
    if (setData) {
      setData(prev => ({
        ...prev,
        patients: (prev.patients || []).map(patient => patient._id === updatedPatient._id ? { ...patient, ...updatedPatient } : patient),
        cachedPatients: (prev.cachedPatients || []).map(patient => patient._id === updatedPatient._id ? { ...patient, ...updatedPatient } : patient)
      }));
    }
  };

  const normalizeNameDraft = (value) => {
    const trimmed = String(value || '').trim();
    const cleanVal = trimmed.replace(/[^a-zA-Z.]/g, '');
    if (!cleanVal) return '';
    return cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1).toLowerCase();
  };

  const normalizeProfileDraft = (field, value) => {
    const trimmed = String(value || '').trim();
    if (['firstName', 'middleName', 'lastName'].includes(field)) {
      return normalizeNameDraft(trimmed);
    }
    if (field === 'age') return trimmed.replace(/\D/g, '').slice(0, 3);
    if (field === 'phone') return trimmed.replace(/\D/g, '').slice(0, 10);
    return trimmed;
  };

  const openProfileNameEditor = () => {
    setEditingProfileField('name');
    setProfileNameDraft(getPatientNameParts(selectedPatientDetail));
    setProfileDraftValue('');
    setProfileInlineError('');
  };

  const openProfileFieldEditor = (field, value) => {
    setEditingProfileField(field);
    setProfileDraftValue(String(value || ''));
    setProfileNameDraft({ firstName: '', middleName: '', lastName: '' });
    setProfileInlineError('');
  };

  const cancelProfileFieldEdit = () => {
    setEditingProfileField('');
    setProfileDraftValue('');
    setProfileNameDraft({ firstName: '', middleName: '', lastName: '' });
    setProfileInlineError('');
  };

  const handleProfileDraftChange = (field, value) => {
    setProfileDraftValue(normalizeProfileDraft(field, value));
  };

  const handleProfileNameDraftChange = (field, value) => {
    setProfileNameDraft(prev => ({
      ...prev,
      [field]: normalizeNameDraft(value)
    }));
  };

  const saveProfileField = async (field) => {
    if (!selectedPatientDetail || savingProfileField) return;
    const nextValue = normalizeProfileDraft(field, profileDraftValue);
    const requiredFields = ['age', 'phone', 'address'];

    if (requiredFields.includes(field) && !nextValue) {
      return setProfileInlineError('This field is required.');
    }
    if (field === 'name' && !normalizeNameDraft(profileNameDraft.firstName)) {
      return setProfileInlineError('First name is required.');
    }
    if (field === 'phone' && nextValue.length !== 10) {
      return setProfileInlineError('Enter a valid 10-digit mobile number.');
    }

    const payload = { clinicId };

    if (field === 'name') {
      const nextNameParts = {
        firstName: normalizeNameDraft(profileNameDraft.firstName),
        middleName: normalizeNameDraft(profileNameDraft.middleName),
        lastName: normalizeNameDraft(profileNameDraft.lastName)
      };
      payload.name = [nextNameParts.firstName, nextNameParts.middleName, nextNameParts.lastName]
        .filter(Boolean)
        .join(' ');
    } else {
      payload[field] = nextValue;
    }

    try {
      setSavingProfileField(field);
      setProfileInlineError('');
      const response = await fetch(`${API_BASE_URL}/api/patients/${selectedPatientDetail._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return setProfileInlineError(errorData.error || 'Failed to update profile.');
      }

      const updatedPatient = await response.json();
      updatePatientLocally(updatedPatient);
      cancelProfileFieldEdit();
      showNotification('Profile Updated', 'success', `${selectedPatientDetail.name || 'Patient'} profile updated.`);
    } catch (err) {
      setProfileInlineError('Server connection failed.');
    } finally {
      setSavingProfileField('');
    }
  };

  const profileFieldConfigs = [
    { field: 'age', label: 'Age', icon: CalendarDays, type: 'tel', display: (value) => value ? `${value} years` : '-' },
    { field: 'gender', label: 'Gender', icon: VenusAndMars, type: 'select', options: [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }], display: formatGender },
    { field: 'bloodGroup', label: 'Blood Group', icon: Droplet, type: 'select', options: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => ({ value, label: value || 'Unknown' })), display: (value) => value || 'Unknown' },
    { field: 'phone', label: 'Mobile Number', icon: Phone, type: 'tel' },
    { field: 'email', label: 'Email', icon: Mail, type: 'email' },
    { field: 'address', label: 'Address', icon: MapPin, type: 'text' }
  ];

  const renderInlineProfileNameGroup = () => {
    const nameParts = getPatientNameParts(selectedPatientDetail);
    const isEditing = editingProfileField === 'name';
    const isSaving = savingProfileField === 'name';
    const actionButtonClass = 'h-8 w-8 rounded-md transition-colors inline-flex items-center justify-center flex-shrink-0';
    const profileLabelClass = 'type-label text-[12px] leading-none text-slate-600 uppercase inline-flex items-center gap-1.5';
    const nameFields = [
      { field: 'firstName', label: 'First Name', required: true },
      { field: 'middleName', label: 'Middle' },
      { field: 'lastName', label: 'Last' }
    ];

    return (
      <div>
        <div className="flex items-center gap-4 mb-0.5">
          <label className={profileLabelClass}>
            <Users size={14} className="shrink-0" />
            Full Name
          </label>
          <div className="flex items-center gap-1">
            {canManagePatients && (
              <button
                type="button"
                onClick={() => (isEditing ? saveProfileField('name') : openProfileNameEditor())}
                disabled={isSaving || Boolean(savingProfileField && savingProfileField !== 'name')}
                aria-label={isEditing ? 'Save name' : 'Edit name'}
                title={isEditing ? 'Save' : 'Edit'}
                className={`${actionButtonClass} ${isEditing ? 'text-teal-700 hover:bg-teal-50' : 'text-blue-700 hover:bg-blue-50'} disabled:opacity-60`}
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : isEditing ? <Save size={13} /> : <Edit2 size={13} />}
              </button>
            )}

            {canManagePatients && isEditing && (
              <button
                type="button"
                onClick={cancelProfileFieldEdit}
                disabled={isSaving}
                aria-label="Cancel name edit"
                title="Cancel"
                className={`${actionButtonClass} text-slate-600 hover:bg-slate-100 disabled:opacity-60`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {nameFields.map(item => (
            <input
              key={item.field}
              type="text"
              value={isEditing ? profileNameDraft[item.field] : nameParts[item.field] || ''}
              placeholder={item.label}
              onChange={(event) => handleProfileNameDraftChange(item.field, event.target.value)}
              disabled={!isEditing || isSaving || !canManagePatients}
              className={`type-body w-full min-w-0 p-2 border rounded-lg outline-none transition-colors disabled:opacity-100 ${
                isEditing
                  ? 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-1 focus:ring-teal-500'
                  : 'border-slate-200 bg-slate-50 text-slate-800 cursor-default'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderInlineProfileField = (config) => {
    const patient = selectedPatientDetail || {};
    const Icon = config.icon;
    const value = config.getValue ? config.getValue(patient) : patient[config.field] || '';
    const isEditing = editingProfileField === config.field;
    const isSaving = savingProfileField === config.field;
    const displayValue = config.display ? config.display(value) : value || '-';
    const actionButtonClass = 'h-8 w-8 rounded-md transition-colors inline-flex items-center justify-center flex-shrink-0';
    const profileLabelClass = 'type-label text-[12px] leading-none text-slate-600 uppercase inline-flex items-center gap-1.5';

    return (
      <div key={config.field}>
        <div className="flex items-center gap-4 mb-0.5">
          <label className={config.field === 'gender' ? 'type-label text-[12px] leading-none text-slate-600 uppercase inline-flex items-center gap-1.5' : profileLabelClass}>
            {Icon ? <Icon size={14} className="shrink-0" /> : <span className="w-3.5 shrink-0" />}
            {config.label}
          </label>
          <div className="flex items-center gap-1">
            {canManagePatients && (
              <button
                type="button"
                onClick={() => (isEditing ? saveProfileField(config.field) : openProfileFieldEditor(config.field, value))}
                disabled={isSaving || Boolean(savingProfileField && savingProfileField !== config.field)}
                aria-label={isEditing ? `Save ${config.label}` : `Edit ${config.label}`}
                title={isEditing ? 'Save' : 'Edit'}
                className={`${actionButtonClass} ${isEditing ? 'text-teal-700 hover:bg-teal-50' : 'text-blue-700 hover:bg-blue-50'} disabled:opacity-60`}
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : isEditing ? <Save size={13} /> : <Edit2 size={13} />}
              </button>
            )}

            {canManagePatients && isEditing && (
              <button
                type="button"
                onClick={cancelProfileFieldEdit}
                disabled={isSaving}
                aria-label={`Cancel ${config.label} edit`}
                title="Cancel"
                className={`${actionButtonClass} text-slate-600 hover:bg-slate-100 disabled:opacity-60`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        {config.type === 'select' ? (
          <select
            value={isEditing ? profileDraftValue : value}
            onChange={(event) => handleProfileDraftChange(config.field, event.target.value)}
            disabled={!isEditing || isSaving || !canManagePatients}
            className={`type-body w-full min-w-0 p-2 border rounded-lg outline-none transition-colors disabled:opacity-100 ${
              isEditing
                ? 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-1 focus:ring-teal-500'
                : 'border-slate-200 bg-slate-50 text-slate-800 cursor-default'
            }`}
          >
            {config.options.map(option => (
              <option key={option.value || 'blank'} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={config.type || 'text'}
            value={isEditing ? profileDraftValue : displayValue}
            onChange={(event) => handleProfileDraftChange(config.field, event.target.value)}
            disabled={!isEditing || isSaving || !canManagePatients}
            className={`type-body w-full min-w-0 p-2 border rounded-lg outline-none transition-colors disabled:opacity-100 ${
              isEditing
                ? 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-1 focus:ring-teal-500'
                : 'border-slate-200 bg-slate-50 text-slate-800 cursor-default'
            }`}
          />
        )}
      </div>
    );
  };

  const patientDetailTabs = [
    { id: 'profile', label: 'Profile', icon: Users },
    { id: 'visits', label: 'Visits', icon: History },
    { id: 'billing', label: 'Billing', icon: Wallet },
    { id: 'followUps', label: 'Follow-Ups', icon: CalendarDays }
  ];

  const renderPatientBillingTab = (patient) => {
    const billingTotals = getBillingTotals(detailVisitHistory);
    const summaryCards = [
      { label: 'Billed', value: formatBillingCurrency(billingTotals.total), className: 'bg-blue-50 text-blue-700 border-blue-100' },
      { label: 'Paid', value: formatBillingCurrency(billingTotals.paid), className: 'bg-teal-50 text-teal-700 border-teal-100' },
      { label: 'Balance', value: formatBillingCurrency(billingTotals.balance), className: billingTotals.balance > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200' }
    ];

    if (detailVisitError) {
      return (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
          <div className="type-section-title text-red-700">{detailVisitError}</div>
          <button
            type="button"
            onClick={() => loadPatientDetailVisits(patient, true)}
            className="type-label mt-3 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (isDetailVisitLoading) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white p-6 text-slate-500">
          <Loader2 size={18} className="animate-spin text-teal-600" />
          <span className="type-secondary">Loading billing history...</span>
        </div>
      );
    }

    return (
      <div className="space-y-2.5 animate-fadeIn">
        <div className="grid grid-cols-3 gap-2">
          {summaryCards.map(card => (
            <div key={card.label} className={`rounded-xl border p-3 ${card.className}`}>
              <div className="type-utility uppercase">{card.label}</div>
              <div className="type-section-title mt-1">{card.value}</div>
            </div>
          ))}
        </div>

        {detailVisitHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <div className="type-section-title text-slate-700">No Billing Records</div>
            <p className="type-secondary mt-1 text-slate-400">Billing will appear here after appointments are created for this patient.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {detailVisitHistory.map(appt => {
              const appointmentDisplayId = getShortEntityId('APT', appt);
              const billingStatus = getPatientAppointmentBillingStatus(appt);
              const billingStatusClass = getBillingStatusClass(billingStatus);
              const { total, paid, balance } = getPatientAppointmentBillingAmounts(appt);
              const billing = appt.billing || {};
              const hasReceipt = hasBillingRecord(appt);
              const doctorName = appt.doctorId?.name || appt.doctorName || 'Doctor not assigned';
              const paymentLabel = paid > 0 && balance > 0 ? 'Collect Balance' : 'Collect Payment';
              const canOpenBilling = canManageAppointments && isBillingAvailableForAppointment(appt);
              const hasPendingPayment = canOpenBilling && balance > 0 && billingStatus !== 'Fully Paid';
              const isOpeningBilling = openingBillingAppointmentId === appt._id;

              return (
                <div key={appt._id || `${appt.date}-${appt.time}`} className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="type-utility text-slate-500 uppercase">{appointmentDisplayId || 'APT ID'}</div>
                        <div className="type-card-title mt-1 text-slate-800 truncate">{appt.time || '--'} | {appt.date || '--'}</div>
                      </div>
                      <span className={`type-utility rounded border px-2 py-1 uppercase whitespace-nowrap ${billingStatusClass}`}>
                        {billingStatus}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {billing.receiptNumber && (
                        <span className="type-utility rounded border border-slate-200 bg-slate-50 px-2 py-1 uppercase text-slate-500">
                          {billing.receiptNumber}
                        </span>
                      )}
                      <span className="type-secondary min-w-0 truncate text-slate-500">with {doctorName}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <div className="type-utility uppercase text-slate-500">Total</div>
                        <div className="type-label mt-1 text-slate-800">{formatBillingCurrency(total)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <div className="type-utility uppercase text-slate-500">Paid</div>
                        <div className="type-label mt-1 text-teal-700">{formatBillingCurrency(paid)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <div className="type-utility uppercase text-slate-500">Balance</div>
                        <div className={`type-label mt-1 ${balance > 0 ? 'text-red-700' : 'text-slate-800'}`}>{formatBillingCurrency(balance)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 p-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(appt)}
                      disabled={!hasReceipt}
                      className="type-label h-8 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center gap-1.5"
                    >
                      <ReceiptText size={13} /> Print Receipt
                    </button>
                    {canManageAppointments && hasPendingPayment && (
                      <button
                        type="button"
                        onClick={() => openBillingPayment(appt)}
                        disabled={isOpeningBilling}
                        className="type-label h-8 min-w-[10rem] rounded-lg bg-teal-600 px-3 text-white hover:bg-teal-700 disabled:opacity-70 flex items-center justify-center gap-1.5"
                      >
                        {isOpeningBilling ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                        {isOpeningBilling ? 'Loading...' : paymentLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPatientDetailTab = () => {
    const patient = selectedPatientDetail;
    if (!patient) return null;

    if (activePatientTab === 'visits') {
      return (
        <div className="animate-fadeIn">
          {detailVisitError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
              <div className="type-section-title text-red-700">{detailVisitError}</div>
              <button
                type="button"
                onClick={() => loadPatientDetailVisits(patient, true)}
                className="type-label mt-3 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50"
              >
                Try Again
              </button>
            </div>
          ) : (
            <PatientHistoryList
              historyData={detailVisitHistory}
              isLoading={isDetailVisitLoading}
              layout="vertical"
              embeddedMarker
            />
          )}
        </div>
      );
    }

    if (activePatientTab === 'billing') {
      return renderPatientBillingTab(patient);
    }

    if (activePatientTab !== 'profile') {
      const tabLabel = patientDetailTabs.find(tab => tab.id === activePatientTab)?.label || 'This tab';
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <div className="type-section-title text-slate-700">{tabLabel}</div>
          <p className="type-secondary mt-1 text-slate-400">This section will be implemented next so we can test one tab at a time.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5 animate-fadeIn">
        {profileInlineError && (
          <div className="type-label rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-700">
            {profileInlineError}
          </div>
        )}
        <section className="space-y-2.5">
          <h4 className="type-utility uppercase text-teal-700 border-b border-teal-100 pb-1">Demographics</h4>
          {renderInlineProfileNameGroup()}
          <div className="grid grid-cols-2 gap-2">
            {renderInlineProfileField(profileFieldConfigs[0])}
            {renderInlineProfileField(profileFieldConfigs[1])}
          </div>
          {renderInlineProfileField(profileFieldConfigs[2])}
        </section>
        <section className="space-y-2.5 pt-1">
          <h4 className="type-utility uppercase text-teal-700 border-b border-teal-100 pb-1">Contact</h4>
          {renderInlineProfileField(profileFieldConfigs[3])}
          {renderInlineProfileField(profileFieldConfigs[4])}
          {renderInlineProfileField(profileFieldConfigs[5])}
        </section>
      </div>
    );
  };

const renderPatientCard = (p) => {
    if (!p) return null; // Failsafe
    const patientType = p.todayType || p.type || 'New';
    const isMenuOpen = openPatientMenuId === p._id;
    const patientDisplayId = p._id ? `PAT-${String(p._id).slice(-6).toUpperCase()}` : '';
    return (
      <div
        key={p._id}
        role="button"
        tabIndex={0}
        onClick={() => openPatientDetail(p)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPatientDetail(p);
          }
        }}
        className="rounded-xl border border-slate-100 shadow-sm relative bg-white hover:border-teal-200 hover:shadow-md transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-teal-500/20 overflow-visible"
      >
        <div className="relative px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <h3 className="type-card-title text-slate-800 leading-tight truncate">{p.name || 'Unknown Name'}</h3>
            </div>
            <div className={`type-utility ml-auto px-2 py-0.5 rounded flex items-center gap-1.5 uppercase flex-shrink-0 ${patientType === 'New' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${patientType === 'New' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
              {patientType}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
            <div className="min-w-0 space-y-1">
              <p className="mt-1.5 text-[12px] leading-4 text-slate-600 truncate">{p.gender || '?'}, {p.age || '?'} Yrs &bull; {p.phone || 'No Phone'}</p>
              <p className="text-[12px] leading-4 text-teal-700 truncate">Last Visit: {formatDate(p.lastVisit)}</p>
            </div>
            <div className="relative self-end" data-patient-actions-menu>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenPatientMenuId(isMenuOpen ? '' : p._id);
                }}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center transition-colors flex-shrink-0"
                aria-label={`More actions for ${p.name || 'patient'}`}
                aria-expanded={isMenuOpen}
              >
                <MoreVertical size={15} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl animate-scaleIn"
                  onClick={(event) => event.stopPropagation()}
                >
                  {canManageAppointments && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPatientMenuId('');
                        onBookAppointment?.(p);
                      }}
                      className="type-label flex w-full items-center gap-2 px-3 py-2 text-left text-teal-700 hover:bg-teal-50"
                    >
                      <CalendarDays size={13} /> Book Appointment
                    </button>
                  )}
                  {canManagePatients && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPatientMenuId('');
                        openEditModal(p, 'demographics');
                      }}
                      className="type-label flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 size={13} /> Edit Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 p-2 flex items-center justify-between gap-2">
          {patientDisplayId ? (
            <span className="type-utility text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 uppercase whitespace-nowrap">
              {patientDisplayId}
            </span>
          ) : <span />}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); openHistoryModal(p); }}
            className="type-label h-8 min-w-[10rem] text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition-colors px-3"
          >
            <Clock size={12} /> View History
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="type-body">{notification.message}</span>
        </div>
      )}

      <ModuleHeader 
        title={selectedPatientDetail ? "Patient Details" : "Patients"} 
        searchVal={selectedPatientDetail ? '' : searchQuery} 
        onSearch={selectedPatientDetail ? undefined : handleSearchInput} 
        onFilterClick={selectedPatientDetail ? undefined : () => setIsFilterModalOpen(true)} 
        hasFilter={!selectedPatientDetail && hasActiveFilters} 
        notifications={notificationStack} 
        onClearAll={handleClearNotifications} 
        onDismiss={handleDismissNotification} 
        onLogout={onLogout}
      />

      {selectedPatientDetail ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 p-2 md:p-3 animate-fadeIn">
          <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
            <div className="relative p-3 border-b border-slate-100 bg-white flex-none">
              <button
                type="button"
                onClick={() => setSelectedPatientDetail(null)}
                className="absolute right-3 top-3 h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex items-center justify-center"
                aria-label="Close patient details"
              >
                <X size={16} />
              </button>

              <div className="flex items-start gap-3 pr-10">
                <div className="type-page-title h-12 w-12 rounded-full bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center flex-shrink-0">
                  {getPatientInitial(selectedPatientDetail)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="type-page-title text-slate-800 truncate">{selectedPatientDetail.name || 'Unknown Patient'}</h2>
                  <p className="type-secondary text-slate-600 mt-0.5">
                    {formatGender(selectedPatientDetail.gender)} • {selectedPatientDetail.age || '?'} yrs • {selectedPatientDetail.phone || 'No phone'}
                  </p>
                  {selectedPatientDetail._id && (
                    <p className="type-utility text-slate-500 mt-1">
                      PAT-{String(selectedPatientDetail._id).slice(-6).toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-none overflow-x-auto border-b border-slate-100 bg-white scrollbar-hide">
              <div className="flex min-w-max px-2">
                {patientDetailTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activePatientTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handlePatientDetailTabChange(tab.id)}
                      className={`type-utility flex items-center gap-1.5 px-3 py-2.5 uppercase border-b-2 transition-colors ${
                        isActive
                          ? 'border-teal-600 text-teal-700'
                          : 'border-transparent text-slate-600 hover:text-slate-700'
                      }`}
                    >
                      <Icon size={13} /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 p-2 scrollbar-hide">
              {renderPatientDetailTab()}
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
        <StatFilterStrip
          items={statsConfig}
          isActive={(item) => item.isToggle && typeFilter === item.filterKey}
          onSelect={(item) => {
            if (item.isToggle) {
              setTypeFilter(typeFilter === item.filterKey ? '' : item.filterKey);
            } else {
              setTypeFilter('');
            }
          }}
        />

        {/* Main List Area */}
        {/* Main List Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            
            {/* MATCHED APPOINTMENTS SEARCH HEADER */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 shadow-sm flex-none">
                 <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-teal-700" />
                    <h3 className="type-section-title text-teal-700">
                      Patients {hasActiveFilters && <span className="type-label text-red-500 ml-1.5">(Filtered)</span>}
                    </h3>
                    <span className="type-label ml-1.5 text-slate-400 font-normal">
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
                   <span className="type-secondary">Searching directory...</span>
                 </div>
              ) : patients && patients.length > 0 ? (
                 <div className="space-y-1.5">
                   {patients.map(renderPatientCard)}
                   
                   {/* MATCHED APPOINTMENTS LOAD MORE BUTTON */}
                   {patients.length < totalPatients && (
                      <button 
                        onClick={handleLoadMore} 
                        disabled={isFetchingMore} 
                        className="type-label w-full py-2 mt-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5"
                      >
                         {isFetchingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                         {isFetchingMore ? 'Loading...' : 'Load More Results'}
                      </button>
                   )}
                 </div>
              ) : (
                 <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-2">
                   <span className="type-secondary">
                     {hasActiveFilters ? "No patients match your active filters." : "No patients found."}
                   </span>
                 </div>
              )}
            </div>
        </div>
      </div>
      )}

      {canManagePatients && !selectedPatientDetail && (
        <FAB icon={Plus} onClick={() => { setNewPatient(defaultPatientState); setAddPatientTab('demographics'); setIsAddPatientModalOpen(true); }} />
      )}

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Advanced Filters" footer={<div className="flex gap-2"><button onClick={() => { setDateRange({ from: '', to: '' }); setIsFilterModalOpen(false); }} className="type-section-title flex-1 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white">Clear</button><button onClick={() => setIsFilterModalOpen(false)} className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg">Apply Filters</button></div>}>
        <div className="space-y-3">
           <div>
              <label className="type-body block text-slate-700 mb-1">Date Range (Last Visit)</label>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="type-utility uppercase text-teal-700 block mb-1">From</span><input type="date" className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} /></div>
                <div><span className="type-utility uppercase text-teal-700 block mb-1">To</span><input type="date" className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} /></div>
              </div>
           </div>
        </div>
      </Modal>

      <Modal isOpen={isAddPatientModalOpen} onClose={() => { setIsAddPatientModalOpen(false); setModalError(''); setInvalidFields([]); setAddPatientTab('demographics'); setNewPatient(defaultPatientState); }} title={newPatient._id ? "Update Patient Profile" : "Add New Patient"} footer={<div className="flex gap-2 w-full">{addPatientTab === 'demographics' ? <div className="flex-1" /> : <button onClick={() => setAddPatientTab('demographics')} className="type-section-title flex-1 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white">Previous</button>} {addPatientTab === 'contact' ? <button onClick={handleSavePatient} disabled={isSubmitting} className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70">{isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : newPatient._id ? "Update Profile" : "Create Profile"}</button> : <button onClick={() => setAddPatientTab('contact')} className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg">Next</button>}</div>}>
        <div className="space-y-4">
          <AlertMessage message={modalError} />
          <div className="flex border-b border-slate-200">
            <button onClick={() => setAddPatientTab('demographics')} className={`type-utility flex-1 py-1.5 uppercase border-b-2 transition-colors ${addPatientTab === 'demographics' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Demographics</button>
            <button onClick={() => setAddPatientTab('contact')} className={`type-utility flex-1 py-1.5 uppercase border-b-2 transition-colors ${addPatientTab === 'contact' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Contact</button>
          </div>
          <div className="min-h-[160px]">
            {addPatientTab === 'demographics' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div>
                  <label className="type-label block text-slate-600 mb-0.5 uppercase">Full Name <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="First Name *" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('firstName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.firstName} onChange={(e) => handlePatientNameInput('firstName', e.target.value)} />
                    <input type="text" placeholder="Middle" className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.middleName} onChange={(e) => handlePatientNameInput('middleName', e.target.value)} />
                    <input type="text" placeholder="Last Name" className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none" value={newPatient.lastName} onChange={(e) => handlePatientNameInput('lastName', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Age <span className="text-red-500">*</span></label><input type="tel" placeholder="Years" maxLength={3} className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('age') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value.replace(/\D/g, '')})} /></div>
                  <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Gender <span className="text-red-500">*</span></label><select className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></div>
                </div>
                <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Blood Group</label><select className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none" value={newPatient.bloodGroup} onChange={e => setNewPatient({...newPatient, bloodGroup: e.target.value})}><option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}</select></div>
              </div>
            )}
            {addPatientTab === 'contact' && (
              <div className="space-y-2.5 animate-fadeIn">
                <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Phone <span className="text-red-500">*</span></label><input type="tel" maxLength={10} placeholder="Mobile number" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value.replace(/\D/g, '')})} /></div>
                <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Email</label><input type="email" placeholder="Email address" className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} /></div>
                <div><label className="type-label block text-slate-600 mb-0.5 uppercase">Address <span className="text-red-500">*</span></label><input type="text" placeholder="Full residential address" className={`type-body w-full p-2 border rounded-lg bg-slate-50 focus:ring-1 outline-none ${invalidFields.includes('address') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={newPatient.address} onChange={e => setNewPatient({...newPatient, address: e.target.value})} /></div>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal 
        isOpen={isHistoryModalOpen} 
        onClose={() => { setIsHistoryModalOpen(false); setPatientHistory([]); setSelectedHistoryPatient(null); }} 
        title={`Patient History - ${selectedHistoryPatient?.name || ''}`}
        panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
        bodyClassName="p-2 overflow-y-auto flex-1 overscroll-contain"
      >
        <PatientHistoryList
          historyData={patientHistory}
          isLoading={isHistoryLoading}
          layout="vertical"
          embeddedMarker
        />
      </Modal>
      <BillingPaymentModal
        isOpen={isBillingPaymentModalOpen}
        onClose={() => {
          setIsBillingPaymentModalOpen(false);
          setBillingPaymentContext(null);
        }}
        clinic={data.clinic}
        context={billingPaymentContext}
        onSaved={handleBillingSaved}
      />
    </div>
  );
};

export default Patients;

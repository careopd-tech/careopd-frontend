import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, CalendarCheck, History, Plus, Clock, RefreshCw,
  ChevronDown, CalendarDays, CheckCircle, AlertCircle, Loader2, X, Search, Activity, FlaskConical,
  MoreVertical, UserCheck, Bell, XCircle, Phone, Printer, ReceiptText, Wallet
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import StatFilterStrip from '../components/ui/StatFilterStrip';
import TimeSlotPicker from '../components/business/TimeSlotPicker';
import { useGlobalDate } from '../context/DateContext';
import API_BASE_URL from '../config';
import { authFetch, getSessionUser } from '../utils/auth';
import { hasPermission } from '../utils/permissions';
import { getClinicSchedule, timeToMinutes } from '../utils/schedule';
import { getAppointmentUiStatus, hasActiveConsultation as hasAppointmentActiveConsultation, hasVisitProgress as hasAppointmentVisitProgress } from '../utils/appointmentStatus';
import { printLabOrderDocument, printPrescriptionDocument, printReceiptDocument } from '../utils/postConsultPrint';

// --- ADDED: IMPORT THE EMR PAD ---
import ConsultationPad from '../components/doctor/ConsultationPad';
import PatientHistoryList, { filterValidHistory } from '../components/ui/PatientHistoryList';
import BillingPaymentModal from '../components/billing/BillingPaymentModal';

const Appointments = ({ data, setData, onLogout }) => {
  // --- 1. CONTEXT & BASICS ---
  const dateContext = useGlobalDate();
  const safeCurrentDate = dateContext?.currentDate || new Date().toISOString().split('T')[0];
  const clinicId = localStorage.getItem('clinicId');
  const userRole = localStorage.getItem('userRole') || 'admin';
  const doctorId = localStorage.getItem('doctorId') || '';
  const sessionUser = getSessionUser();
  const rbacQuery = `&userRole=${userRole}&doctorId=${doctorId}`;
  
  // --- ADDED: RBAC HELPER ---
  const canManageAppointments = hasPermission(sessionUser.permissions, 'appointments.manage');
  const canViewAllAppointments = hasPermission(sessionUser.permissions, 'appointments.view_all') || canManageAppointments;
  const isAdmin = canManageAppointments;

  // --- NEW: 30-Day Window Boundary ---
  const maxDateObj = new Date(safeCurrentDate);
  maxDateObj.setDate(maxDateObj.getDate() + 30);
  const maxDateStr = maxDateObj.toISOString().split('T')[0];

  // --- 2. STATE MANAGEMENT ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const searchTimeoutRef = useRef(null);
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState(false);

  // Initialize Data
  const [sections, setSections] = useState(() => {
    const cachedAppts = data.appointments || [];

    let initialSections = {
      today: cachedAppts.filter(a => a.date === safeCurrentDate),
      upcoming: cachedAppts.filter(a => a.date > safeCurrentDate),
      previous: cachedAppts.filter(a => a.date < safeCurrentDate)
    };

    if (data.cachedSections) {
      initialSections = { ...data.cachedSections };
      // Ensure Previous is sorted Oldest -> Newest (Chat Style)
      if (initialSections.previous && initialSections.previous.length > 0) {
        initialSections.previous = [...initialSections.previous].sort((a, b) => {
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        });
      }
    }
    return initialSections;
  });

  const [metaCounts, setMetaCounts] = useState(data.counts || { upcoming: 0, previous: 0 });
  const [pages, setPages] = useState(data.cachedPages || { upcoming: 1, previous: 1 });

  // UI States
  const [batchLoading, setBatchLoading] = useState({ upcoming: false, previous: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consultationSubmitAction, setConsultationSubmitAction] = useState('');
  const [loading, setLoading] = useState(() => {
    if (data.cachedSections) return false;
    return !data.appointments || data.appointments.length === 0;
  });
  const [loadError, setLoadError] = useState('');

  const [activeFilters, setActiveFilters] = useState({ dateFrom: '', dateTo: '', doctorId: '', status: [] });
  const [tempFilters, setTempFilters] = useState(activeFilters);

  // Modals & Action State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isLeftEarlyModalOpen, setIsLeftEarlyModalOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isViewVitalsModalOpen, setIsViewVitalsModalOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState('today');
  const [rebookingApptId, setRebookingApptId] = useState(null);
  const [isFollowUpBooking, setIsFollowUpBooking] = useState(false);
  const [followUpSourceApptId, setFollowUpSourceApptId] = useState('');
  const [notification, setNotification] = useState(null);
  const [actionAppt, setActionAppt] = useState(null);
  const [contactAppt, setContactAppt] = useState(null);
  const [previewAppt, setPreviewAppt] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState('');
  const [openActionMenuPosition, setOpenActionMenuPosition] = useState(null);
  const [processingAppointmentId, setProcessingAppointmentId] = useState('');

  // --- ADDED: EMR FULL SCREEN MODAL STATE ---
  const [isConsultationPadOpen, setIsConsultationPadOpen] = useState(false);
  const [activeConsultationAppt, setActiveConsultationAppt] = useState(null);
  const [isExitConsultationModalOpen, setIsExitConsultationModalOpen] = useState(false);
  const [consultationDraft, setConsultationDraft] = useState(null);
  const [exitConsultationAction, setExitConsultationAction] = useState('');
  const [isBillingPaymentModalOpen, setIsBillingPaymentModalOpen] = useState(false);
  const [billingPaymentContext, setBillingPaymentContext] = useState(null);

  // --- NOTIFICATION STATE (PERSISTENT) ---
  const [notificationStack, setNotificationStack] = useState(() => {
    try {
      const saved = localStorage.getItem('appt_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // Sync Notification Stack to LocalStorage
  useEffect(() => {
    localStorage.setItem('appt_notifications', JSON.stringify(notificationStack));
  }, [notificationStack]);

  // Forms
  const defaultNewPatientDetails = { firstName: '', middleName: '', lastName: '', phone: '', age: '', gender: 'M', address: '' };
  const [newAppt, setNewAppt] = useState({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate });
  const [newPatientDetails, setNewPatientDetails] = useState(defaultNewPatientDetails);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [leftEarlyReason, setLeftEarlyReason] = useState('');
  const [vitalsData, setVitalsData] = useState({ bp: '', temp: '', weight: '' });
  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // Refs
  const previousListRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const sectionsRef = useRef(sections);
  const metaCountsRef = useRef(metaCounts);
  const expandedSectionRef = useRef(expandedSection);
  const searchQueryRef = useRef(searchQuery);
  const searchPageRef = useRef(searchPage);
  const hasSnappedToBottomRef = useRef(false);
  const consultationDraftSaveTimeoutRef = useRef(null);
  const initialConsultationDraftSnapshotRef = useRef('');
  const initialConsultationHadDraftRef = useRef(false);

  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { metaCountsRef.current = metaCounts; }, [metaCounts]);
  useEffect(() => { expandedSectionRef.current = expandedSection; }, [expandedSection]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { searchPageRef.current = searchPage; }, [searchPage]);
  useEffect(() => () => {
    if (consultationDraftSaveTimeoutRef.current) {
      window.clearTimeout(consultationDraftSaveTimeoutRef.current);
    }
  }, []);

  // Force Expand Today on landing
  useEffect(() => {
    if (!searchQuery) {
      setExpandedSection('today');
    }
  }, [searchQuery]);

  // Reset the snap flag when the user leaves the 'previous' section
  useEffect(() => {
    if (expandedSection !== 'previous') {
      hasSnappedToBottomRef.current = false;
    }
  }, [expandedSection]);

  useEffect(() => {
    if (!openActionMenuId) return undefined;

    const dismissOnOutsidePress = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-appointment-actions-menu]')) {
        setOpenActionMenuId('');
        setOpenActionMenuPosition(null);
      }
    };

    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionMenuId('');
        setOpenActionMenuPosition(null);
      }
    };

    const dismissOnViewportMove = () => {
      setOpenActionMenuId('');
      setOpenActionMenuPosition(null);
    };

    document.addEventListener('pointerdown', dismissOnOutsidePress);
    document.addEventListener('keydown', dismissOnEscape);
    document.addEventListener('scroll', dismissOnViewportMove, true);
    window.addEventListener('resize', dismissOnViewportMove);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePress);
      document.removeEventListener('keydown', dismissOnEscape);
      document.removeEventListener('scroll', dismissOnViewportMove, true);
      window.removeEventListener('resize', dismissOnViewportMove);
    };
  }, [openActionMenuId]);

  // --- 3. LOGIC HELPERS ---
  const hasActiveConsultation = (appt) => hasAppointmentActiveConsultation(appt);
  const hasVisitProgress = (appt) => hasAppointmentVisitProgress(appt);
  const getUiStatus = (appt) => getAppointmentUiStatus(appt, safeCurrentDate);

  const getEntityId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
  };

  const getPatientDetails = (patientRef) => {
    const patientId = getEntityId(patientRef);
    const cachedPatient = (data.patients || []).find(p => getEntityId(p) === patientId);
    if (patientRef && typeof patientRef === 'object') {
      return { ...(cachedPatient || {}), ...patientRef };
    }
    return cachedPatient || null;
  };

  const getPatientName = (patientRef) => {
    return getPatientDetails(patientRef)?.name || 'Unknown Patient';
  };

  const getPatientPhone = (patientRef) => {
    return getPatientDetails(patientRef)?.phone || '';
  };

  const getDoctorName = (doctorRef) => {
    if (doctorRef && typeof doctorRef === 'object') {
      return doctorRef.name || 'Unknown Doctor';
    }
    const doctorId = getEntityId(doctorRef);
    const doctor = (data.doctors || []).find(d => getEntityId(d) === doctorId);
    return doctor?.name || 'Unknown Doctor';
  };

  const getDoctorById = (doctorRef) => {
    const doctorId = getEntityId(doctorRef);
    return (data.doctors || []).find(d => getEntityId(d) === doctorId);
  };

  const buildConsultationDraftPayload = useCallback((appointment = {}, draftOverride = null) => {
    const sourceDraft = draftOverride && typeof draftOverride === 'object'
      ? draftOverride
      : (appointment?.consultationDraft || appointment?.followUpPrefill || {});
    const sanitizeText = (value) => String(value || '').trim();
    const normalizeMedicine = (medicine = {}) => ({
      name: sanitizeText(medicine.name),
      route: sanitizeText(medicine.route),
      quantity: sanitizeText(medicine.quantity),
      frequency: sanitizeText(medicine.frequency),
      timing: sanitizeText(medicine.timing),
      duration: sanitizeText(medicine.duration),
      instructions: sanitizeText(medicine.instructions)
    });

    return {
      vitals: {
        bp: sanitizeText(sourceDraft.vitals?.bp ?? appointment?.vitals?.bp),
        temp: sanitizeText(sourceDraft.vitals?.temp ?? appointment?.vitals?.temp),
        weight: sanitizeText(sourceDraft.vitals?.weight ?? appointment?.vitals?.weight)
      },
      complaintsList: Array.isArray(sourceDraft.complaintsList)
        ? sourceDraft.complaintsList.map(sanitizeText).filter(Boolean)
        : [],
      complaintInputText: sanitizeText(sourceDraft.complaintInputText),
      clinicalNotes: {
        diagnosis: sanitizeText(sourceDraft.clinicalNotes?.diagnosis),
        advice: sanitizeText(sourceDraft.clinicalNotes?.advice)
      },
      medicines: Array.isArray(sourceDraft.medicines)
        ? sourceDraft.medicines.map(normalizeMedicine).filter((medicine) => Object.values(medicine).some(Boolean))
        : [],
      currentMed: normalizeMedicine(sourceDraft.currentMed || {}),
      isCustomRegimen: sourceDraft.isCustomRegimen === true,
      isMedSelected: sourceDraft.isMedSelected === true,
      labTests: Array.isArray(sourceDraft.labTests)
        ? sourceDraft.labTests
          .map((test) => ({ name: sanitizeText(typeof test === 'string' ? test : test?.name) }))
          .filter((test) => test.name)
        : [],
      labInputText: sanitizeText(sourceDraft.labInputText)
    };
  }, []);

  const serializeConsultationDraft = useCallback((appointment = {}, draftOverride = null) => (
    JSON.stringify(buildConsultationDraftPayload(appointment, draftOverride))
  ), [buildConsultationDraftPayload]);

  const buildConsultationAppointment = useCallback((appt, overrides = {}) => {
    const appointmentId = getEntityId(appt?._id || overrides?._id);
    const latestKnownAppointments = [
      ...(sectionsRef.current.today || []),
      ...(sectionsRef.current.upcoming || []),
      ...(sectionsRef.current.previous || []),
      ...searchResults
    ];
    const latestAppt = latestKnownAppointments.find(item => getEntityId(item) === appointmentId);
    const mergedAppt = { ...(appt || {}), ...(latestAppt || {}), ...(overrides || {}) };
    const patientRef = mergedAppt.patientId && typeof mergedAppt.patientId === 'object'
      ? mergedAppt.patientId
      : (data.patients || []).find(p => getEntityId(p) === getEntityId(mergedAppt.patientId));

    return {
      ...mergedAppt,
      patientId: patientRef || mergedAppt.patientId || { name: 'Unknown Patient' }
    };
  }, [data.patients, searchResults]);

  const getTodayAppointmentPhase = (appt) => {
    if (appt.date !== safeCurrentDate || appt.checkedInAt) return '';

    const appointmentMinutes = timeToMinutes(appt.time);
    if (!Number.isFinite(appointmentMinutes)) return '';

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const windowMinutes = getClinicSchedule(data.clinic || {}).appointmentWindowMinutes;

    if (currentMinutes < appointmentMinutes - windowMinutes) return 'before-arrival';
    // Window covers early arrival plus the booked slot and one post-slot grace period.
    if (currentMinutes <= appointmentMinutes + (windowMinutes * 2)) return 'arrival-window';
    return 'delayed';
  };

  const getCardStatus = (appt) => {
    const uiStatus = getUiStatus(appt);
    if (uiStatus !== 'Scheduled' || appt.date !== safeCurrentDate) return uiStatus;
    return getTodayAppointmentPhase(appt) === 'delayed' ? 'Delayed' : 'Scheduled';
  };

  const isAssignedClinician = (appt) => (
    Boolean(doctorId) &&
    getEntityId(appt.doctorId) === String(doctorId) &&
    hasPermission(sessionUser.permissions, 'appointments.consult_own')
  );

  const hasPreConsultVitalsWorkflow = (
    data.clinic?.type === 'Clinic' &&
    data.clinic?.preConsultVitalsEnabled === true
  );

  const departments = useMemo(() => [...new Set((data.doctors || []).map(d => d.department))], [data.doctors]);

  const validateFutureDate = (inputDate, inputTime) => {
    const today = new Date().toISOString().split('T')[0];
    if (inputDate < today) return false;
    if (inputDate === today && inputTime) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const [inputH, inputM] = inputTime.split(':').map(Number);
      if (inputH < currentHours) return false;
      if (inputH === currentHours && inputM < currentMinutes) return false;
    }
    return true;
  };

  // --- 4. NOTIFICATION LOGIC ---
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

  // --- 5. FILTERING ENGINE ---
  const applyFilters = (items) => (items || []).filter(appt => {
    const uiStatus = getUiStatus(appt);
    const hasAdvancedFilters = activeFilters.dateFrom || activeFilters.dateTo || activeFilters.doctorId || activeFilters.status.length > 0;

    if (hasAdvancedFilters) {
      if (activeFilters.dateFrom && appt.date < activeFilters.dateFrom) return false;
      if (activeFilters.dateTo && appt.date > activeFilters.dateTo) return false;
      if (activeFilters.doctorId && getEntityId(appt.doctorId) !== getEntityId(activeFilters.doctorId)) return false;
      if (activeFilters.status.length > 0 && !activeFilters.status.includes(uiStatus)) return false;
    }
    return true;
  });

  // --- 6. DATA FETCHING ---
  const fetchAllData = async (forceSync = false, overrideQuery = undefined, resetLazySections = false) => {
    if (!clinicId) return;
    setLoadError('');
    const isNewSearch = overrideQuery !== undefined;
    const currentQuery = isNewSearch ? overrideQuery : searchQueryRef.current;
    const isSearchMode = !!currentQuery && currentQuery.trim().length > 0;

    try {
      const promises = [];
      const dashboardRequests = [
        { key: 'appointments snapshot', url: `${API_BASE_URL}/api/appointments/${clinicId}?mode=snapshot&date=${safeCurrentDate}${rbacQuery}` },
        { key: 'doctors', url: `${API_BASE_URL}/api/doctors/${clinicId}` },
        { key: 'patients', url: `${API_BASE_URL}/api/patients/${clinicId}` },
        { key: 'appointments calendar', url: `${API_BASE_URL}/api/appointments/${clinicId}?tag=appointments&date=${safeCurrentDate}${rbacQuery}` }
      ];

      const dashboardPromise = Promise.all(dashboardRequests.map(req => fetch(req.url))).then(async ([snapshotRes, docsRes, patsRes, calRes]) => {
        const dashboardResponses = [snapshotRes, docsRes, patsRes, calRes];
        const failedIndex = dashboardResponses.findIndex(res => !res.ok);

        if (failedIndex !== -1) {
          const failedRequest = dashboardRequests[failedIndex];
          const failedResponse = dashboardResponses[failedIndex];
          const body = await failedResponse.text().catch(() => '');
          console.error('Dashboard API failed:', {
            endpoint: failedRequest.key,
            url: failedRequest.url,
            status: failedResponse.status,
            body
          });
          setLoadError(`${failedRequest.key} failed (${failedResponse.status}). ${body}`);
          return;
        }

        {
          const [snapshot, docs, pats, calendar30, clinic] = await Promise.all([
            snapshotRes.json(),
            docsRes.json(),
            patsRes.json(),
            calRes.json(),
            fetch(`${API_BASE_URL}/api/clinics/${clinicId}`)
              .then(async (response) => (response.ok ? response.json() : null))
              .catch(() => null)
          ]);

          const activeSection = expandedSectionRef.current;

          const syncGroup = async (group, serverCount) => {
            if (resetLazySections) return [];
            if (activeSection !== group) return sectionsRef.current[group];

            const currentList = sectionsRef.current[group];
            const needsSync = serverCount !== currentList.length || forceSync;

            if (needsSync) {
              if (serverCount === 0) return [];

              const currentPages = Math.ceil((currentList.length || 1) / 20);
              const limit = Math.max(currentPages * 20, 20);

              const res = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=batch&group=${group}&page=1&limit=${limit}&date=${safeCurrentDate}${rbacQuery}`);
              if (res.ok) {
                let list = await res.json();
                if (group === 'previous') {
                  list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
                }
                return list;
              }
            }
            return currentList;
          };

          const newUpcoming = await syncGroup('upcoming', snapshot.counts?.upcoming || 0);
          const newPrevious = await syncGroup('previous', snapshot.counts?.previous || 0);

          const updatedToday = snapshot.today || [];

          const finalSections = {
            today: updatedToday,
            upcoming: newUpcoming,
            previous: newPrevious
          };

          setSections(finalSections);
          setMetaCounts({ previous: snapshot.counts?.previous || 0, upcoming: snapshot.counts?.upcoming || 0 });
          setData(prev => ({
            ...prev, clinic: clinic || prev.clinic, doctors: docs, patients: pats, appointments: updatedToday, counts: snapshot.counts, cachedSections: finalSections, calendar30: calendar30
          }));
        }
      });
      promises.push(dashboardPromise);

      if (isSearchMode) {
        if (!forceSync) setIsSearching(true);
        const currentPagesLoaded = isNewSearch ? 1 : searchPageRef.current;
        const limitToFetch = Math.max(20, currentPagesLoaded * 20);

        const searchPromise = fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=search&query=${currentQuery}&page=1&limit=${limitToFetch}${rbacQuery}`)
          .then(res => res.json())
          .then(data => {
            const results = Array.isArray(data) ? data : (data.data || []);
            const count = Array.isArray(data) ? data.length : (data.total || 0);
            setSearchResults(results);
            setSearchTotal(count);
            if (isNewSearch) { setSearchPage(1); }
          });
        promises.push(searchPromise);
      }
      await Promise.all(promises);

    } catch (err) {
      console.error("Fetch Error:", err);
      setLoadError(err.message || 'Failed to load appointment data.');
    }
    finally { setLoading(false); setIsSearching(false); }
  };

  useEffect(() => {
    // Refresh today's cards and section counts, but leave historical/future
    // card data lazy-loaded only when the user opens those accordions.
    setExpandedSection('today');
    fetchAllData(true, undefined, true);
    const intervalId = setInterval(() => fetchAllData(true), 60000);
    return () => clearInterval(intervalId);
  }, [safeCurrentDate]);

  useEffect(() => {
    if (expandedSection === 'previous' || expandedSection === 'upcoming') {
      fetchAllData(true);
    }
  }, [expandedSection]);

  // --- SCROLL MANAGEMENT ---
  useLayoutEffect(() => {
    if (expandedSection === 'previous' && previousListRef.current) {
      if (previousScrollHeightRef.current > 0) {
        const newScrollHeight = previousListRef.current.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeightRef.current;
        previousListRef.current.scrollTop += heightDifference;
        previousScrollHeightRef.current = 0;
      }
      else if (!hasSnappedToBottomRef.current && sections.previous.length > 0) {
        previousListRef.current.scrollTop = previousListRef.current.scrollHeight;
        hasSnappedToBottomRef.current = true;
      }
    }
  }, [sections.previous, expandedSection]);

  const handleSearchInput = (val) => {
    const wasSearching = !!searchQuery;
    const isNowSearching = !!val;

    if (wasSearching !== isNowSearching) {
      const resetState = { dateFrom: '', dateTo: '', doctorId: '', status: [] };
      setActiveFilters(resetState);
      setTempFilters(resetState);
    }

    setSearchQuery(val);

    if (val) {
      setExpandedSection('today');
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val) {
      fetchAllData(false, '');
    } else {
      searchTimeoutRef.current = setTimeout(() => fetchAllData(false, val), 500);
    }
  };

  const fetchBatch = async (group) => {
    if (!clinicId || batchLoading[group]) return;

    if (group === 'previous' && previousListRef.current) {
      previousScrollHeightRef.current = previousListRef.current.scrollHeight;
    }

    setBatchLoading(prev => ({ ...prev, [group]: true }));
    try {
      const currentList = sectionsRef.current[group];
      const currentLen = currentList.length;
      let pageToFetch, limitToFetch;

      if (currentLen % 20 !== 0) {
        pageToFetch = 1;
        limitToFetch = Math.ceil(currentLen / 20) * 20;
      } else {
        pageToFetch = (currentLen / 20) + 1;
        limitToFetch = 20;
      }

      const response = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=batch&group=${group}&page=${pageToFetch}&limit=${limitToFetch}&date=${safeCurrentDate}${rbacQuery}`);
      if (response.ok) {
        const newItems = await response.json();

        if (pageToFetch === 1 && limitToFetch >= 20) {
          if (group === 'previous') {
            newItems.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          }
          const nextSections = {
            ...sectionsRef.current,
            [group]: newItems
          };
          setSections(nextSections);
          setData(d => ({ ...d, cachedSections: nextSections }));
          setPages(prev => ({ ...prev, [group]: Math.ceil(newItems.length / 20) + 1 }));
        }
        else if (newItems.length > 0) {
          if (group === 'previous') {
            newItems.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          }

          const existingIds = new Set(sectionsRef.current[group].map(item => item._id));
          const uniqueNewItems = newItems.filter(item => !existingIds.has(item._id));

          const nextSections = {
            ...sectionsRef.current,
            [group]: group === 'previous'
              ? [...uniqueNewItems, ...sectionsRef.current.previous] 
              : [...sectionsRef.current.upcoming, ...uniqueNewItems] 
          };
          setSections(nextSections);
          setData(d => ({ ...d, cachedSections: nextSections }));
          setPages(prev => ({ ...prev, [group]: prev[group] + 1 }));
        }
      }
    } catch (err) { console.error(err); } finally { setBatchLoading(prev => ({ ...prev, [group]: false })); }
  };

  const fetchSearchMore = async () => {
    if (!clinicId || isSearchLoadingMore) return;
    setIsSearchLoadingMore(true);
    try {
      const nextPage = searchPage + 1;
      const response = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=search&query=${searchQuery}&page=${nextPage}&limit=20${rbacQuery}`);
      const data = await response.json();
      const newItems = Array.isArray(data) ? data : (data.data || []);

      if (newItems.length > 0) {
        setSearchResults(prev => {
          const existingIds = new Set(prev.map(item => item._id));
          const uniqueNewItems = newItems.filter(item => !existingIds.has(item._id));
          return [...prev, ...uniqueNewItems];
        });
        setSearchPage(nextPage);
      }
    } catch (err) { console.error("Search Error:", err); }
    finally { setIsSearchLoadingMore(false); }
  };

  const handleToggleSection = (id) => {
    if (expandedSection === id) setExpandedSection(null);
    else {
      setExpandedSection(id);
      if (id === 'previous' && sections.previous.length === 0 && metaCounts.previous > 0) fetchBatch(id);
      if (id === 'upcoming' && sections.upcoming.length === 0 && metaCounts.upcoming > 0) fetchBatch(id);
    }
  };

  // --- 7. DYNAMIC STATS ---
  const statsConfig = useMemo(() => {
    let sourceData = searchQuery
      ? searchResults
      : [...(sections.previous || []), ...(sections.today || []), ...(sections.upcoming || [])];

    if (activeFilters.dateFrom || activeFilters.dateTo || activeFilters.doctorId) {
      sourceData = sourceData.filter(appt => {
        if (activeFilters.dateFrom && appt.date < activeFilters.dateFrom) return false;
        if (activeFilters.dateTo && appt.date > activeFilters.dateTo) return false;
        if (activeFilters.doctorId && getEntityId(appt.doctorId) !== getEntityId(activeFilters.doctorId)) return false;
        return true;
      });
    }

    const scheduled = sourceData.filter(a => getUiStatus(a) === 'Scheduled').length;
    const completed = sourceData.filter(a => getUiStatus(a) === 'Completed').length;
    const awaitingReports = sourceData.filter(a => getUiStatus(a) === 'Awaiting Reports').length;
    const cancelled = sourceData.filter(a => getUiStatus(a) === 'Cancelled').length;
    const noShow = sourceData.filter(a => getUiStatus(a) === 'No-Show').length;

    return [
      { key: 'Scheduled', label: 'Scheduled', val: scheduled, color: 'bg-amber-50 text-amber-700' },
      { key: 'Completed', label: 'Completed', val: completed, color: 'bg-green-50 text-green-700' },
      { key: 'Awaiting Reports', label: 'Awaiting', val: awaitingReports, color: 'bg-cyan-50 text-cyan-700' },
      { key: 'Cancelled', label: 'Cancelled', val: cancelled, color: 'bg-red-50 text-red-700' },
      { key: 'No-Show', label: 'No Show', val: noShow, color: 'bg-slate-100 text-slate-600' }
    ];
  }, [sections, searchResults, searchQuery, activeFilters]);

  const handleStatsClick = (key) => {
    let newStatusList = [...activeFilters.status];
    if (newStatusList.includes(key)) {
      newStatusList = newStatusList.filter(s => s !== key);
    } else {
      newStatusList.push(key);
    }
    if (['Scheduled', 'Completed', 'Awaiting Reports', 'Cancelled', 'No-Show'].every(s => newStatusList.includes(s))) {
      newStatusList = [];
    }
    setActiveFilters({ ...activeFilters, status: newStatusList });
  };

  const openFilterModal = () => { setTempFilters(activeFilters); setIsFilterModalOpen(true); };
  const applyActiveFilters = () => { setActiveFilters(tempFilters); setIsFilterModalOpen(false); };
  const clearFilters = () => { setActiveFilters({ dateFrom: '', dateTo: '', doctorId: '', status: [] }); setTempFilters({ dateFrom: '', dateTo: '', doctorId: '', status: [] }); setIsFilterModalOpen(false); };
  const hasActiveFilters = activeFilters.dateFrom !== '' || activeFilters.dateTo !== '' || activeFilters.doctorId !== '' || activeFilters.status.length > 0;

  // --- INPUT HANDLERS ---
  const handlePatientNameInput = (field, value) => {
    let cleanVal = value.replace(/[^a-zA-Z.]/g, '');
    if ((cleanVal.match(/\./g) || []).length > 1) {
      return;
    }

    if (cleanVal.length > 0) {
      cleanVal = cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1).toLowerCase();
    }
    setNewPatientDetails(prev => ({ ...prev, [field]: cleanVal }));
  };

  const handlePatientPhoneInput = (value) => {
    const cleanVal = value.replace(/\D/g, '').slice(0, 10);
    setNewPatientDetails(prev => ({ ...prev, phone: cleanVal }));
  };

  const handlePatientAgeInput = (value) => {
    let cleanVal = value.replace(/\D/g, '').slice(0, 3);
    if (cleanVal.startsWith('0')) {
      cleanVal = cleanVal.replace(/^0+/, '');
    }
    setNewPatientDetails(prev => ({ ...prev, age: cleanVal }));
  };

  const handlePatientAddressInput = (value) => {
    let cleanVal = value
      .replace(/[^a-zA-Z0-9\s.\-_,#\/&']/g, '')
      .replace(/^\s+/g, '')
      .replace(/\s\s+/g, ' ')
      .replace(/([.,_#\-\/])\1+/g, '$1');

    setNewPatientDetails(prev => ({ ...prev, address: cleanVal }));
  };

  const hasLocalPatientConflict = (patientId, date, time, excludeAppointmentId = null) => {
    if (!patientId || patientId === 'add_new' || !date || !time) return false;

    const loadedAppointments = [
      ...(sections.today || []),
      ...(sections.upcoming || []),
      ...(sections.previous || [])
    ];

    return loadedAppointments.some(appt =>
      getEntityId(appt.patientId) === getEntityId(patientId) &&
      appt.date === date &&
      appt.time === time &&
      !['Cancelled', 'Left Early'].includes(appt.status) &&
      appt._id !== excludeAppointmentId
    );
  };

  // --- ACTIONS ---
  const handleAddAppointment = async () => {
    setModalError('');
    let errors = [];
    if (!newAppt.patientId) errors.push('patientId');
    if (newAppt.patientId === 'add_new') {
      if (!newPatientDetails.firstName) errors.push('newPatientName'); 
      if (!newPatientDetails.phone || newPatientDetails.phone.length < 10) errors.push('newPatientPhone');
      if (!newPatientDetails.age) errors.push('newPatientAge');
      if (!newPatientDetails.address) errors.push('newPatientAddress');
    }
    if (!newAppt.doctorId) errors.push('doctorId');
    if (!newAppt.date) errors.push('date');
    if (!newAppt.time) errors.push('time');

    if (errors.length > 0) { setInvalidFields(errors); return setModalError('Please fill required fields *'); }
    if (!validateFutureDate(newAppt.date, newAppt.time)) return setModalError('Cannot book in the past.');
    if (hasLocalPatientConflict(newAppt.patientId, newAppt.date, newAppt.time, rebookingApptId)) {
      return setModalError('Selected Patient has an existing appointment at the same time.');
    }

    setInvalidFields([]);
    setIsSubmitting(true);
    const fullName = newAppt.patientId === 'add_new'
      ? [newPatientDetails.firstName, newPatientDetails.middleName, newPatientDetails.lastName]
        .filter(Boolean) 
        .join(' ')      
      : '';

    const payload = {
      clinicId: localStorage.getItem('clinicId'),
      patientId: newAppt.patientId, doctorId: newAppt.doctorId, time: newAppt.time, date: newAppt.date, type: isFollowUpBooking ? 'Follow-Up' : 'Consultation',
      followUpOfAppointmentId: isFollowUpBooking ? followUpSourceApptId : null,
      status: 'Scheduled', newPatientData: newAppt.patientId === 'add_new' ? {
        ...newPatientDetails,
        name: fullName 
      } : null
    };

    const isRebookFlow = Boolean(rebookingApptId || isFollowUpBooking);
    try {
      const url = rebookingApptId ? `${API_BASE_URL}/api/appointments/${rebookingApptId}` : `${API_BASE_URL}/api/appointments`;
      const method = rebookingApptId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();

      if (res.ok) {
        await fetchAllData(true);
        setIsAddModalOpen(false); setRebookingApptId(null); setIsFollowUpBooking(false); setFollowUpSourceApptId('');
        setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate });
        setNewPatientDetails(defaultNewPatientDetails);

        const pName = newAppt.patientId === 'add_new' ? fullName : getPatientName(newAppt.patientId);
        showNotification(
          isRebookFlow ? 'Appointment Rebooked' : 'Appointment Booked',
          'success',
          `Appointment ${isRebookFlow ? 'Rebooked' : 'Booked'} for ${pName} on ${newAppt.date}  at ${newAppt.time}`
        );
      } else {
        if (result.errorCode === 'ERR_APPOINTMENT_CONFLICT') {
          return setModalError('Selected Patient has an existing appointment at the same time.');
        }
        if (result.errorCode === 'ERR_PATIENT_DUPLICATE') {
          setInvalidFields(prev => [...prev, 'newPatientPhone']);
        }
        setModalError(result.errorMessage || result.error || "Failed to save appointment.");
      }
    } catch (e) { setModalError("Server error."); }
    finally { setIsSubmitting(false); }
  };

  const confirmCancel = async () => {
    if (!actionAppt) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to cancel appointment.', 'error');
      }
      await fetchAllData(true);
      setIsCancelModalOpen(false);
      showNotification('Appointment Cancelled', 'error', `Appointment Cancelled for ${getPatientName(actionAppt.patientId)} scheduled on ${actionAppt.date} at ${actionAppt.time}`);
      setActionAppt(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmLeftEarly = async () => {
    if (!actionAppt) return;
    setIsSubmitting(true);
    setModalError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}/left-early`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, reason: leftEarlyReason })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setModalError(result.error || 'Failed to mark patient as walked out.');
      }

      await fetchAllData(true);
      setIsLeftEarlyModalOpen(false);
      setLeftEarlyReason('');
      showNotification('Patient Walked Out', 'success', `${getPatientName(actionAppt.patientId)} left before consultation.`);
      setActionAppt(null);
    } catch (err) {
      setModalError('Failed to mark patient as walked out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleData.date || !rescheduleData.time) return setModalError('Select date & time');
    if (!validateFutureDate(rescheduleData.date, rescheduleData.time)) return setModalError('Cannot reschedule to the past.');
    if (hasLocalPatientConflict(getEntityId(actionAppt?.patientId), rescheduleData.date, rescheduleData.time, actionAppt?._id)) {
      return setModalError('Selected Patient has an existing appointment at the same time.');
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, date: rescheduleData.date, time: rescheduleData.time, status: 'Scheduled' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setModalError(result.errorCode === 'ERR_APPOINTMENT_CONFLICT'
          ? 'Selected Patient has an existing appointment at the same time.'
          : (result.error || 'Failed to reschedule appointment.'));
      }
      await fetchAllData(true);
      setIsRescheduleModalOpen(false);
      showNotification('Appointment Rescheduled', 'success', `Appointment Rescheduled for ${getPatientName(actionAppt.patientId)} to ${rescheduleData.date} at ${rescheduleData.time}`);
      setActionAppt(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRebook = (appt) => {
    const doc = getDoctorById(appt.doctorId);
    setNewAppt({
      patientId: getEntityId(appt.patientId),
      department: doc ? doc.department : '',
      doctorId: getEntityId(appt.doctorId),
      date: safeCurrentDate,
      time: ''
    });
    const preserveVisitRecord = appt.status === 'Left Early';
    setRebookingApptId(preserveVisitRecord || appt.date < safeCurrentDate ? null : appt._id);
    setIsFollowUpBooking(preserveVisitRecord);
    setIsAddModalOpen(true);
  };

  const openConsultation = (appt) => {
    if (consultationDraftSaveTimeoutRef.current) {
      window.clearTimeout(consultationDraftSaveTimeoutRef.current);
    }
    const resolvedAppointment = buildConsultationAppointment(appt);
    initialConsultationDraftSnapshotRef.current = serializeConsultationDraft(resolvedAppointment, resolvedAppointment.consultationDraft);
    initialConsultationHadDraftRef.current = Boolean(resolvedAppointment.consultationDraft);
    setActiveConsultationAppt(resolvedAppointment);
    setConsultationDraft(resolvedAppointment.consultationDraft || null);
    setIsConsultationPadOpen(true);
    setOpenActionMenuId('');
  };

  const persistConsultationDraft = useCallback(async (appointmentId, draft) => {
    const response = await authFetch(`${API_BASE_URL}/api/appointments/${appointmentId}/consultation-draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, draft })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save consultation draft.');
    }
    return result.appointment;
  }, [clinicId]);

  const handleConsultationDraftChange = useCallback((draft) => {
    setConsultationDraft(draft);
    if (!isConsultationPadOpen || !activeConsultationAppt?._id) return;

    if (consultationDraftSaveTimeoutRef.current) {
      window.clearTimeout(consultationDraftSaveTimeoutRef.current);
    }
    consultationDraftSaveTimeoutRef.current = window.setTimeout(() => {
      persistConsultationDraft(activeConsultationAppt._id, draft).catch(() => {
        // Explicit save on exit surfaces an error; background autosave should not interrupt care entry.
      });
    }, 400);
  }, [activeConsultationAppt?._id, isConsultationPadOpen, persistConsultationDraft]);

  const handleStartConsultation = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/start-consultation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to start consultation.', 'error');
      }

      openConsultation(buildConsultationAppointment(appt, result.appointment));
      await fetchAllData(true);
    } catch (err) {
      showNotification('Failed to start consultation.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handleStartAddendum = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/start-addendum`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to open follow-up note.', 'error');
      }

      openConsultation(buildConsultationAppointment(appt, result.appointment));
      await fetchAllData(true);
    } catch (err) {
      showNotification('Failed to open follow-up note.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handleReportsReady = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/reports-ready`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to mark reports ready.', 'error');
      }

      await fetchAllData(true);
      showNotification('Reports Ready', 'success', `${getPatientName(appt.patientId)} is ready for doctor review.`);
    } catch (err) {
      showNotification('Failed to mark reports ready.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const getAutoFollowUpTime = (sourceAppt) => {
    const slotMinutes = getClinicSchedule(data.clinic || {}).appointmentWindowMinutes || 15;
    const now = new Date();
    let minutes = Math.ceil(((now.getHours() * 60) + now.getMinutes()) / slotMinutes) * slotMinutes;
    if (minutes >= 24 * 60) minutes = (24 * 60) - slotMinutes;

    for (let attempt = 0; attempt < 24 * 12; attempt += 1) {
      const candidateMinutes = (minutes + (attempt * slotMinutes)) % (24 * 60);
      const hours = String(Math.floor(candidateMinutes / 60)).padStart(2, '0');
      const mins = String(candidateMinutes % 60).padStart(2, '0');
      const candidateTime = `${hours}:${mins}`;
      if (!hasLocalPatientConflict(getEntityId(sourceAppt.patientId), safeCurrentDate, candidateTime, null)) {
        return candidateTime;
      }
    }

    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const handleCreateFollowUp = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    const doctorRef = getDoctorById(appt.doctorId);
    const followUpTime = getAutoFollowUpTime(appt);
    const payload = {
      clinicId,
      patientId: getEntityId(appt.patientId),
      doctorId: getEntityId(appt.doctorId),
      time: followUpTime,
      date: safeCurrentDate,
      type: 'Follow-Up',
      followUpOfAppointmentId: getEntityId(appt._id)
    };

    try {
      const createResponse = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const createResult = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !createResult.appointmentId) {
        return showNotification(createResult.error || 'Failed to create follow-up visit.', 'error');
      }

      const followUpAppointmentId = createResult.appointmentId;

      if (canManageAppointments) {
        const checkInResponse = await authFetch(`${API_BASE_URL}/api/appointments/${followUpAppointmentId}/check-in`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId })
        });
        if (!checkInResponse.ok) {
          const checkInResult = await checkInResponse.json().catch(() => ({}));
          return showNotification(checkInResult.error || 'Follow-up created, but check-in failed.', 'error');
        }
      }

      const provisionalFollowUpAppt = {
        _id: followUpAppointmentId,
        clinicId,
        patientId: getPatientDetails(appt.patientId) || appt.patientId,
        doctorId: doctorRef || appt.doctorId,
        time: followUpTime,
        date: safeCurrentDate,
        type: 'Follow-Up',
        status: 'Scheduled',
        checkedInAt: canManageAppointments ? new Date().toISOString() : null,
        followUpOfAppointmentId: getEntityId(appt._id)
      };

      if (isAssignedClinician(provisionalFollowUpAppt)) {
        const startResponse = await authFetch(`${API_BASE_URL}/api/appointments/${followUpAppointmentId}/start-consultation`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId })
        });
        const startResult = await startResponse.json().catch(() => ({}));
        if (!startResponse.ok) {
          return showNotification(startResult.error || 'Follow-up created, but consultation could not be opened.', 'error');
        }

        const followUpAppointment = buildConsultationAppointment(provisionalFollowUpAppt, startResult.appointment || {});
        openConsultation(followUpAppointment);
      } else {
        showNotification('Follow-Up Checked In', 'success', `${getPatientName(appt.patientId)} is ready for follow-up consultation.`);
      }

      await fetchAllData(true);
    } catch (err) {
      showNotification('Failed to start follow-up workflow.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const closeConsultationPadLocally = (message = '') => {
    setIsExitConsultationModalOpen(false);
    setIsConsultationPadOpen(false);
    setActiveConsultationAppt(null);
    setConsultationDraft(null);
    setModalError('');
    setExitConsultationAction('');
    if (message) {
      showNotification(message, 'success');
    }
  };

  const closeUnchangedDraftQuietly = async () => {
    if (!activeConsultationAppt?._id) {
      closeConsultationPadLocally();
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${activeConsultationAppt._id}/exit-consultation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, keepDraft: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to close consultation.', 'error');
      }

      await fetchAllData(true);
      closeConsultationPadLocally();
    } catch (err) {
      showNotification('Failed to close consultation.', 'error');
    }
  };

  const openExitConsultationConfirmation = async () => {
    if (!activeConsultationAppt) return;
    const currentDraftSnapshot = serializeConsultationDraft(
      activeConsultationAppt,
      consultationDraft || buildConsultationDraftPayload(activeConsultationAppt)
    );
    const hasConsultationChanges = currentDraftSnapshot !== initialConsultationDraftSnapshotRef.current;

    if (!hasConsultationChanges) {
      if (initialConsultationHadDraftRef.current) {
        await closeUnchangedDraftQuietly();
        return;
      }
      await handleDiscardConsultation();
      return;
    }

    setModalError('');
    setExitConsultationAction('');
    setIsExitConsultationModalOpen(true);
  };

  const closeExitConsultationModal = () => {
    if (isSubmitting) return;
    setModalError('');
    setExitConsultationAction('');
    setIsExitConsultationModalOpen(false);
  };

  const handleSaveDraftAndExit = async () => {
    if (!activeConsultationAppt) return;

    if (consultationDraftSaveTimeoutRef.current) {
      window.clearTimeout(consultationDraftSaveTimeoutRef.current);
    }
    setExitConsultationAction('save');
    setIsSubmitting(true);
    setModalError('');
    try {
      await persistConsultationDraft(
        activeConsultationAppt._id,
        consultationDraft || activeConsultationAppt.consultationDraft || {}
      );
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${activeConsultationAppt._id}/exit-consultation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, keepDraft: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setModalError(result.error || 'Failed to close consultation after saving draft.');
      }
      await fetchAllData(true);
      closeConsultationPadLocally();
      showNotification(
        'Draft Saved',
        'success',
        activeConsultationAppt.activeConsultationMode === 'Addendum'
          ? 'Follow-up note draft can be resumed from this appointment.'
          : 'Consultation can be resumed from the appointment card.'
      );
    } catch (err) {
      setModalError(err.message || 'Failed to save consultation draft.');
    } finally {
      setExitConsultationAction('');
      setIsSubmitting(false);
    }
  };

  const handleDiscardConsultation = async () => {
    if (!activeConsultationAppt) return;

    if (consultationDraftSaveTimeoutRef.current) {
      window.clearTimeout(consultationDraftSaveTimeoutRef.current);
    }
    setExitConsultationAction('discard');
    setIsSubmitting(true);
    setModalError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${activeConsultationAppt._id}/exit-consultation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setModalError(result.error || 'Failed to leave consultation.');
      }

      await fetchAllData(true);
      closeConsultationPadLocally();
      showNotification(
        'Draft Discarded',
        'success',
        activeConsultationAppt.activeConsultationMode === 'Addendum'
          ? 'Follow-up note draft was discarded.'
          : 'Patient returned to the consultation queue.'
      );
    } catch (err) {
      setModalError('Failed to leave consultation.');
    } finally {
      setExitConsultationAction('');
      setIsSubmitting(false);
    }
  };

  const openReschedule = (appt) => {
    setActionAppt(appt);
    setRescheduleData({ date: appt.date, time: appt.time });
    setIsRescheduleModalOpen(true);
    setOpenActionMenuId('');
  };

  const openContact = (appt) => {
    setContactAppt(appt);
    setIsContactModalOpen(true);
    setOpenActionMenuId('');
  };

  const openLeftEarly = (appt) => {
    setActionAppt(appt);
    setLeftEarlyReason('');
    setModalError('');
    setIsLeftEarlyModalOpen(true);
    setOpenActionMenuId('');
  };

  const openVitals = (appt) => {
    setActionAppt(appt);
    setVitalsData({
      bp: appt.vitals?.bp || '',
      temp: appt.vitals?.temp || '',
      weight: appt.vitals?.weight || ''
    });
    setModalError('');
    setIsVitalsModalOpen(true);
    setOpenActionMenuId('');
  };

  const openViewVitals = (appt) => {
    setPreviewAppt(appt);
    setIsViewVitalsModalOpen(true);
    setOpenActionMenuId('');
  };

  const openHistory = async (appt) => {
    setPreviewAppt(appt);
    setHistoryData([]);
    setHistoryError('');
    setIsHistoryLoading(true);
    setIsHistoryModalOpen(true);
    setOpenActionMenuId('');

    try {
      const patientId = getEntityId(appt.patientId);
      const response = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=history&patientId=${patientId}${rbacQuery}`);
      const result = await response.json().catch(() => ([]));
      if (!response.ok) {
        return setHistoryError('Failed to load patient history.');
      }
      setHistoryData(filterValidHistory(result));
    } catch (err) {
      setHistoryError('Failed to load patient history.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadPostConsultContext = async (appt) => {
    const fallbackContext = {
      appointment: appt,
      patient: getPatientDetails(appt.patientId) || appt.patientId || {},
      doctor: getDoctorById(appt.doctorId) || appt.doctorId || {},
      prescription: {
        medicines: Array.isArray(appt.medicines) ? appt.medicines : [],
        labTests: Array.isArray(appt.labTests) ? appt.labTests : [],
        complaints: appt.complaints || '',
        diagnosis: appt.diagnosis || '',
        advice: appt.advice || ''
      }
    };

    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/visit/${appt._id}/post-consult?clinicId=${clinicId}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return fallbackContext;
      }

      return {
        appointment: result.appointment || fallbackContext.appointment,
        patient: result.patient || fallbackContext.patient,
        doctor: result.doctor || fallbackContext.doctor,
        prescription: result.prescription || fallbackContext.prescription
      };
    } catch (err) {
      return fallbackContext;
    }
  };

  const handlePrintPrescription = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const context = await loadPostConsultContext(appt);
      const didPrint = printPrescriptionDocument({
        clinic: data.clinic,
        appointment: context.appointment,
        patient: context.patient,
        doctor: context.doctor,
        prescription: context.prescription
      });

      if (!didPrint) {
        showNotification('No prescription to print.', 'error');
        return;
      }

      const trackResponse = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/prescription-printed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const trackResult = await trackResponse.json().catch(() => ({}));
      if (!trackResponse.ok) {
        showNotification(trackResult.error || 'Prescription was printed, but print tracking failed.', 'error');
        return;
      }
      await fetchAllData(true);
    } catch (err) {
      showNotification('Failed to print prescription.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handlePrintLabOrder = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const context = await loadPostConsultContext(appt);
      const didPrint = printLabOrderDocument({
        clinic: data.clinic,
        appointment: context.appointment,
        patient: context.patient,
        doctor: context.doctor,
        prescription: context.prescription
      });

      if (!didPrint) {
        showNotification('No lab order to print.', 'error');
      }
    } catch (err) {
      showNotification('Failed to print lab order.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handlePrintReceipt = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const context = await loadPostConsultContext(appt);
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
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const openBillingPayment = async (appt) => {
    setOpenActionMenuId('');
    const context = await loadPostConsultContext(appt);
    setBillingPaymentContext(context);
    setIsBillingPaymentModalOpen(true);
  };

  const handleCheckIn = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/check-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to check in patient.', 'error');
      }

      await fetchAllData(true);
      showNotification('Patient Checked In', 'success', `${getPatientName(appt.patientId)} is ready for consultation.`);
    } catch (err) {
      showNotification('Failed to check in patient.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handleSendReminder = async (appt) => {
    setProcessingAppointmentId(appt._id);
    setOpenActionMenuId('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${appt._id}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return showNotification(result.error || 'Failed to send reminder.', 'error');
      }

      await fetchAllData(true);
      showNotification('Reminder Sent', 'success', `WhatsApp reminder sent to ${getPatientName(appt.patientId)}.`);
    } catch (err) {
      showNotification('Failed to send reminder.', 'error');
    } finally {
      setProcessingAppointmentId('');
    }
  };

  const handleSaveVitals = async () => {
    if (!actionAppt) return;

    setIsSubmitting(true);
    setModalError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}/vitals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, vitals: vitalsData })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        return setModalError(result.error || 'Failed to save vitals.');
      }

      await fetchAllData(true);
      setIsVitalsModalOpen(false);
      setActionAppt(null);
      showNotification('Vitals Saved', 'success', 'Pre-consult vitals recorded successfully.');
    } catch (err) {
      setModalError('Server connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ADDED: EMR SAVE HANDLER ---
  const handleCompleteConsultation = async (apptId, prescriptionData, finalStatus) => {
    setConsultationSubmitAction(finalStatus);
    setIsSubmitting(true);
    try {
      const sourceAppointment = buildConsultationAppointment(activeConsultationAppt);
      const payload = {
        clinicId: clinicId,
        appointmentId: apptId,
        patientId: sourceAppointment.patientId?._id || sourceAppointment.patientId,
        doctorId: sourceAppointment.doctorId?._id || sourceAppointment.doctorId,
        status: finalStatus,
        consultationMode: sourceAppointment.activeConsultationMode || 'Consultation',
        parentConsultationId: sourceAppointment.parentConsultationId || sourceAppointment.activeAddendumParentConsultationId || null,
        prescriptionData: prescriptionData 
      };

      const res = await authFetch(`${API_BASE_URL}/api/prescriptions/complete-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (consultationDraftSaveTimeoutRef.current) {
          window.clearTimeout(consultationDraftSaveTimeoutRef.current);
        }
        setIsExitConsultationModalOpen(false);
        setIsConsultationPadOpen(false);
        setActiveConsultationAppt(null);
        setConsultationDraft(null);
        fetchAllData(true);
        const shortMessage = finalStatus === 'Awaiting Reports' ? 'Awaiting Reports' : 'Consultation Saved';
        showNotification(shortMessage, 'success', `Status updated to ${finalStatus}.`);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Error saving consultation", err);
    } finally {
      setConsultationSubmitAction('');
      setIsSubmitting(false);
    }
  };

  // --- RENDER HELPERS ---
  const renderAppointmentCard = (appt) => {
    const uiStatus = getUiStatus(appt);
    const isCancelled = uiStatus === 'Cancelled';
    const isCompleted = uiStatus === 'Completed';
    const isTestRecommended = uiStatus === 'Test Recommended';
    const isNoShow = uiStatus === 'No-Show';
    const isDraft = uiStatus === 'Draft';
    const isWalkedOut = uiStatus === 'Walked Out';
    const showActions = !isCancelled && !isCompleted && !isNoShow && !isWalkedOut;
    const isToday = appt.date === safeCurrentDate;
    const isFuture = appt.date > safeCurrentDate;
    const isPast = appt.date < safeCurrentDate;
    const isCheckedIn = Boolean(appt.checkedInAt);
    const isInConsultation = hasActiveConsultation(appt);
    const isCarryoverVisit = isPast && showActions && hasVisitProgress(appt);
    const isTreatingPhysician = isAssignedClinician(appt);
    const canConsultWithoutCheckIn = data.clinic?.type === 'Solo' && isTreatingPhysician;
    const todayPhase = getTodayAppointmentPhase(appt);
    const cardStatus = getCardStatus(appt);
    const isProcessing = processingAppointmentId === appt._id;
    const hasPrescription = Array.isArray(appt.medicines) && appt.medicines.length > 0;
    const hasLabOrder = Array.isArray(appt.labTests) && appt.labTests.length > 0;
    const hasPrintedPrescription = Boolean(appt.prescriptionPrintedAt || Number(appt.prescriptionPrintCount || 0) > 0);
    const hasReceipt = Boolean(
      appt.billing?.receiptNumber ||
      Number(appt.billing?.consultationFee || 0) > 0 ||
      (Array.isArray(appt.billing?.payments) && appt.billing.payments.length > 0)
    );

    const actions = {
      cancel: {
        label: 'Cancel',
        icon: XCircle,
        onClick: () => {
          setActionAppt(appt);
          setIsCancelModalOpen(true);
          setOpenActionMenuId('');
        }
      },
      checkIn: { label: 'Check In', icon: UserCheck, onClick: () => handleCheckIn(appt) },
      consult: {
        label: appt.activeConsultationMode === 'Addendum'
          ? 'Resume Follow-Up Note'
          : appt.type === 'Follow-Up'
          ? 'Add Follow-Up Note'
          : ((isInConsultation || isDraft || (uiStatus === 'Awaiting Reports' && Boolean(appt.reportsReadyAt))) ? 'Resume Consult' : 'Consult'),
        icon: Activity,
        onClick: () => handleStartConsultation(appt)
      },
      reportsReady: { label: 'Reports Ready', icon: FlaskConical, onClick: () => handleReportsReady(appt) },
      followUp: { label: (isInConsultation || isDraft || appt.consultationDraftSavedAt) ? 'Resume Follow-Up Note' : 'Add Follow-Up Note', icon: CalendarDays, onClick: () => handleStartAddendum(appt) },
      reminder: { label: 'Send Reminder', icon: Bell, onClick: () => handleSendReminder(appt) },
      contact: { label: 'Contact Patient', icon: Phone, onClick: () => openContact(appt) },
      leftEarly: { label: 'Patient Left', icon: XCircle, onClick: () => openLeftEarly(appt) },
      reschedule: { label: 'Reschedule', icon: CalendarDays, onClick: () => openReschedule(appt) },
      vitals: { label: 'Add Vitals', icon: Activity, onClick: () => openVitals(appt) },
      history: { label: 'View History', icon: History, onClick: () => openHistory(appt) },
      viewVitals: { label: 'View Vitals', icon: Activity, onClick: () => openViewVitals(appt) },
      printPrescription: { label: 'Print Prescription', icon: Printer, onClick: () => handlePrintPrescription(appt) },
      printLabOrder: { label: 'Print Lab Order', icon: FlaskConical, onClick: () => handlePrintLabOrder(appt) },
      generateInvoice: { label: 'Generate Invoice', icon: Wallet, onClick: () => openBillingPayment(appt) },
      printReceipt: { label: 'Print Receipt', icon: ReceiptText, onClick: () => handlePrintReceipt(appt) }
    };

    let primaryAction = null;
    let overflowActions = [];
    const clinicianOverflowActions = [
      ...(data.clinic?.type === 'Clinic' ? [actions.viewVitals] : []),
      actions.vitals
    ];
    const testRecommendedOverflowActions = [
      hasPrescription ? actions.printPrescription : null,
      hasLabOrder ? actions.printLabOrder : null,
      (hasPrintedPrescription || !hasPrescription) ? actions.generateInvoice : null,
      hasReceipt ? actions.printReceipt : null
    ].filter(Boolean);
    const completedOverflowActions = [
      (hasPrintedPrescription || !hasPrescription) ? actions.generateInvoice : null,
      hasLabOrder ? actions.printLabOrder : null,
      hasReceipt ? actions.printReceipt : null
    ].filter(Boolean);

    if (isTestRecommended) {
      if (isTreatingPhysician) {
        primaryAction = actions.followUp;
        overflowActions = testRecommendedOverflowActions;
      } else {
        overflowActions = testRecommendedOverflowActions;
      }
    } else if (isCompleted) {
      primaryAction = hasPrescription ? actions.printPrescription : actions.generateInvoice;
      overflowActions = completedOverflowActions;
    } else if (showActions && (isToday || isCarryoverVisit)) {
      if (uiStatus === 'Awaiting Reports') {
        if (isTreatingPhysician && appt.reportsReadyAt) {
          primaryAction = actions.consult;
          overflowActions = clinicianOverflowActions;
        } else if (canManageAppointments && !appt.reportsReadyAt) {
          primaryAction = actions.reportsReady;
          overflowActions = [];
        }
      } else if (isInConsultation && isTreatingPhysician) {
        primaryAction = actions.consult;
        overflowActions = clinicianOverflowActions;
      } else if (isCheckedIn || isCarryoverVisit) {
        if (isTreatingPhysician) {
          primaryAction = actions.consult;
          overflowActions = isCheckedIn ? [...clinicianOverflowActions, actions.leftEarly] : clinicianOverflowActions;
        } else if (canManageAppointments && hasPreConsultVitalsWorkflow && isCheckedIn) {
          primaryAction = actions.vitals;
          overflowActions = [actions.leftEarly];
        } else if (canManageAppointments && isCheckedIn) {
          overflowActions = [actions.leftEarly];
        }
      } else if (isToday && canManageAppointments) {
        if (todayPhase === 'arrival-window') {
          primaryAction = actions.checkIn;
          overflowActions = [actions.reschedule, actions.cancel, actions.reminder];
        } else if (todayPhase === 'delayed') {
          primaryAction = actions.contact;
          overflowActions = [actions.checkIn, actions.reschedule, actions.cancel];
        } else {
          primaryAction = actions.reschedule;
          overflowActions = [actions.checkIn, actions.cancel, actions.reminder];
        }
        if (canConsultWithoutCheckIn) {
          overflowActions = [...overflowActions, actions.consult];
        }
      }
    }

    if (showActions && isFuture && canManageAppointments) {
      primaryAction = actions.reschedule;
      overflowActions = [actions.reminder, actions.cancel];
    }

    const hasPrimaryInlineAction = (showActions || isTestRecommended || isCompleted) && Boolean(primaryAction);
    const hasArchivedInlineAction = (isCancelled || isNoShow || isWalkedOut) && isAdmin;
    const cardOverflowActions = ((showActions || isTestRecommended || isCompleted) && (isToday || isCarryoverVisit || isTestRecommended || isCompleted || (isFuture && canManageAppointments)))
      ? overflowActions
      : [];

    const renderActionButton = (action, isPrimary = false) => {
      if (!action) return null;
      const Icon = action.icon;
      return (
        <button
          type="button"
          onClick={action.onClick}
          disabled={isProcessing}
          className={`type-label h-8 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-70 ${
            isPrimary
              ? 'justify-center px-3 text-white bg-teal-600 hover:bg-teal-700 shadow-sm'
              : 'justify-start w-full px-3 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isPrimary && isProcessing ? <Loader2 size={13} className="animate-spin" /> : Icon ? <Icon size={13} /> : null}
          {action.label}
        </button>
      );
    };

    const renderOverflowMenu = (menuActions) => {
      if (!menuActions.length) return null;
      const menuWidth = 176;
      const menuHeight = (menuActions.length * 32) + 8;
      const gap = 8;

      const toggleMenu = (event) => {
        if (openActionMenuId === appt._id) {
          setOpenActionMenuId('');
          setOpenActionMenuPosition(null);
          return;
        }

        const triggerRect = event.currentTarget.getBoundingClientRect();
        const preferredTop = triggerRect.top - menuHeight - gap;
        const top = preferredTop >= gap
          ? preferredTop
          : Math.min(triggerRect.bottom + gap, window.innerHeight - menuHeight - gap);
        const left = Math.max(gap, Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - gap));

        setOpenActionMenuPosition({ top: Math.max(gap, top), left });
        setOpenActionMenuId(appt._id);
      };

      return (
        <div className="relative" data-appointment-actions-menu>
          <button
            type="button"
            onClick={toggleMenu}
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
            aria-label="More appointment actions"
          >
            <MoreVertical size={15} />
          </button>
          {openActionMenuId === appt._id && openActionMenuPosition && createPortal(
            <div
              data-appointment-actions-menu
              className="fixed z-[70] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
              style={{ top: openActionMenuPosition.top, left: openActionMenuPosition.left }}
            >
              {menuActions.map((action) => (
                <React.Fragment key={action.label}>{renderActionButton(action)}</React.Fragment>
              ))}
            </div>,
            document.body
          )}
        </div>
      );
    };

    return (
      <div key={appt._id} className={`p-3 rounded-xl border border-slate-100 shadow-sm relative flex flex-col md:flex-row gap-2 ${isCancelled || isNoShow || isWalkedOut ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
        <div className={`flex-1 min-w-0 ${(isCancelled || isNoShow || isWalkedOut) ? 'grayscale opacity-75' : ''}`}>
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock size={12} className="text-slate-400" />
              <span className="type-body text-slate-700">{appt.time}</span>
              <span className="type-label text-slate-400">| {appt.date}</span>
            </div>
            {isNoShow ? <span className="type-utility bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">No Show</span> : <StatusBadge status={cardStatus} />}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2">
            <h4 className="type-card-title text-slate-800 leading-tight min-w-0">{getPatientName(appt.patientId)}</h4>
            <div className="col-start-2 row-start-1 row-span-2 self-end">
              {renderOverflowMenu(cardOverflowActions)}
            </div>
            <div className="col-start-1 row-start-2 min-w-0 mt-0.5">
              <p className="type-label text-slate-500 leading-tight min-w-0">with <span className="text-teal-600 font-medium">{getDoctorName(appt.doctorId)}</span></p>
            </div>
          </div>
        </div>
        {hasPrimaryInlineAction && (
          <div className="flex items-center justify-end gap-1.5 border-t md:border-t-0 md:border-l border-slate-100 pt-2 md:pt-0 md:pl-3 flex-shrink-0">
            {renderActionButton(primaryAction, true)}
          </div>
        )}
        {hasArchivedInlineAction && (
          <div className="flex flex-row md:flex-col gap-1.5 border-t md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-3 justify-end flex-shrink-0 md:w-32">
            {isAdmin && (
              <button onClick={() => handleRebook(appt)} className="type-label flex-1 md:flex-none w-full h-7 text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg flex items-center justify-center gap-1 whitespace-nowrap"><RefreshCw size={12} /> ReBook</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAccordionSection = (id, title, icon, colorClass, items) => {
    const isToday = id === 'today';
    const isExpanded = expandedSection === id;
    const Icon = icon;
    const isHistory = id === 'previous';

    const visibleItems = applyFilters(items);
    const loadedCount = visibleItems.length;
    const isFiltering = hasActiveFilters;
    const displayCount = isFiltering ? loadedCount : (id === 'today' ? loadedCount : Math.max(items.length, metaCounts[id] || 0));
    const isSectionLoading = (id === 'today') ? loading : batchLoading[id];

    return (
      <div className={`flex flex-col border-b border-slate-100 ${isExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
        <button onClick={() => handleToggleSection(id)} className={`flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 transition-colors z-10 shadow-sm border-b outline-none ${isExpanded ? 'border-slate-100' : 'border-transparent'}`}>
          <div className={`flex items-center gap-1.5 ${colorClass}`}>
            <Icon size={14} />
            <h3 className="type-section-title">
              {title}
              {isFiltering && <span className="type-label text-red-500 ml-1.5">(Filtered)</span>}
            </h3>
            {id === 'today' && <span className="type-label bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full ml-1.5">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            <span className="type-label ml-1.5 text-slate-400 font-normal">{(!loading || items.length > 0) ? `(${displayCount})` : ''}</span>
          </div>
          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} className="text-slate-400" /></div>
        </button>

        {isExpanded && (
          <div ref={id === 'previous' ? previousListRef : null} className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide animate-fadeIn relative">
            {isSectionLoading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 size={24} className="animate-spin text-teal-600 mb-2" />
                <span className="type-label">Loading records...</span>
              </div>
            )}

            {id === 'previous' && items.length > 0 && items.length < metaCounts.previous && (
              <button onClick={() => fetchBatch(id)} disabled={isSectionLoading} className="type-label w-full py-1.5 mb-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5 flex-shrink-0">
                {isSectionLoading ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown className="rotate-180" size={12} />}
                {isSectionLoading ? 'Loading...' : 'Load Older'}
              </button>
            )}

            {visibleItems.length > 0 && visibleItems.map(renderAppointmentCard)}

            {!isSectionLoading && visibleItems.length === 0 && <div className="type-secondary text-center py-6 text-slate-400 italic">No appointments</div>}

            {id !== 'previous' && id !== 'today' && items.length > 0 && items.length < metaCounts.upcoming && (
              <button onClick={() => fetchBatch(id)} disabled={isSectionLoading} className="type-label w-full py-1.5 mt-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5 flex-shrink-0">
                {isSectionLoading ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                {isSectionLoading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const allFilteredResults = applyFilters(searchResults);
  const visibleSearchResults = allFilteredResults;
  const contactPhone = getPatientPhone(contactAppt?.patientId);
  const dialableContactPhone = String(contactPhone || '').replace(/[^\d+]/g, '');
  const vitalsPatient = getPatientDetails(actionAppt?.patientId);
  const vitalsPatientGender = { M: 'Male', F: 'Female', O: 'Other' }[vitalsPatient?.gender] || vitalsPatient?.gender || 'Gender Unknown';

  return (
    <div className="h-full flex flex-col relative">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="type-body">{notification.message}</span>
        </div>
      )}

      {/* ADDED: DYNAMIC TITLE BASED ON ROLE */}
      <ModuleHeader
        title={canViewAllAppointments ? "Appointments" : "Queue & Schedule"}
        shortTitle={canViewAllAppointments ? "Appts" : "Queue"}
        searchVal={searchQuery}
        onSearch={handleSearchInput}
        onFilterClick={openFilterModal}
        hasFilter={hasActiveFilters}
        notifications={notificationStack}
        onClearAll={handleClearNotifications}
        onDismiss={handleDismissNotification}
        onLogout={onLogout}
      />
      {loadError && (
        <div className="px-2 pt-2">
          <AlertMessage message={loadError} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
        <StatFilterStrip
          items={statsConfig}
          isActive={(item) => activeFilters.status.includes(item.key)}
          onSelect={(item) => handleStatsClick(item.key)}
        />
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {searchQuery ? (
            <div className="flex-1 flex flex-col min-h-0 animate-fadeIn bg-white">
              <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 shadow-sm flex-none">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-teal-700" />
                  <h3 className="type-section-title text-teal-700">Search Results {hasActiveFilters && <span className="type-label text-red-500 ml-1.5">(Filtered)</span>}</h3>
                  <span className="type-label ml-1.5 text-slate-400 font-normal">
                    Showing {visibleSearchResults.length} of {searchTotal}
                  </span>
                </div>
                <button onClick={() => handleSearchInput('')} className="p-0 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50 scrollbar-hide">
                {isSearching ? (
                  <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-teal-600" /><span className="type-secondary">Searching database...</span></div>
                ) : visibleSearchResults.length > 0 ? (
                  <>
                    {visibleSearchResults.map(renderAppointmentCard)}

                    {searchResults.length < searchTotal && (
                      <button
                        onClick={fetchSearchMore}
                        disabled={isSearchLoadingMore}
                        className="type-label w-full py-2 mt-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5"
                      >
                        {isSearchLoadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                        {isSearchLoadingMore ? 'Loading...' : 'Load More Results'}
                      </button>
                    )}
                  </>
                ) : (<div className="type-secondary py-10 text-center text-slate-400">{searchResults.length > 0 ? "No results match your active filters." : `No records found for "${searchQuery}"`}</div>)}
              </div>
            </div>
          ) : (
            <>
              {renderAccordionSection('previous', 'Previous', History, 'text-slate-400', sections.previous)}
              {renderAccordionSection('today', "Today's", CalendarCheck, 'text-teal-700', sections.today)}
              {renderAccordionSection('upcoming', 'Upcoming', Calendar, 'text-blue-600', sections.upcoming)}
            </>
          )}
        </div>
      </div>

      {/* ADDED: ADMIN SECURITY LOCK FOR CREATING APPOINTMENTS */}
      {isAdmin && (
        <FAB icon={Plus} onClick={() => { setRebookingApptId(null); setIsFollowUpBooking(false); setIsAddModalOpen(true); }} />
      )}

      {/* --- ADDED: EMR FULL-SCREEN OVERLAY --- */}
      {isConsultationPadOpen && activeConsultationAppt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center md:p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-50 w-full h-full md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-6xl mx-auto border border-slate-200">
             
             {/* EMR Header */}
             <div className="px-3 md:px-5 h-14 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10 flex-shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="type-section-title w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">
                       {activeConsultationAppt.patientId?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="type-section-title text-slate-800 leading-tight">
                         {activeConsultationAppt.patientId?.name || 'Unknown Patient'}
                      </h2>
                      <p className="type-label text-slate-500">
                         {activeConsultationAppt.patientId?.gender || 'U'} • {activeConsultationAppt.patientId?.age ? `${activeConsultationAppt.patientId.age} Yrs` : 'Age Unknown'} 
                         <span className="mx-2 text-slate-300">|</span> 
                         {activeConsultationAppt.time}
                      </p>
                    </div>
                 </div>
                 
                 <button 
                    type="button"
                    onClick={openExitConsultationConfirmation}
                    disabled={isSubmitting}
                    className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    <span className="type-label hidden md:inline">Close</span>
                    <X size={18} />
                 </button>
             </div>
             
             {/* EMR Body */}
             <div className="flex-1 overflow-hidden relative">
                 <ConsultationPad 
                    activeAppt={activeConsultationAppt} 
                    onComplete={handleCompleteConsultation}
                    onDraftChange={handleConsultationDraftChange}
                    isSubmitting={isSubmitting}
                    submittingAction={consultationSubmitAction}
                    clinicalCatalog={data.clinicalCatalog}
                 />
             </div>
          </div>
        </div>
      )}

      {isExitConsultationModalOpen && activeConsultationAppt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 bg-slate-950/55 backdrop-blur-sm animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="exit-consultation-title">
          <div className="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-scaleIn">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <h3 id="exit-consultation-title" className="font-bold text-slate-800 text-[15px]">Leave Consultation?</h3>
              <button
                type="button"
                onClick={closeExitConsultationModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent disabled:opacity-50"
                aria-label="Stay on consultation pad"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <AlertMessage message={modalError} />
              <p className="type-body text-slate-700">Save as draft to easily resume this consultation later, or discard the progress and return the patient to the waiting room.</p>
              <p className="type-secondary text-slate-500"></p>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={handleDiscardConsultation}
                disabled={isSubmitting}
                className="type-section-title flex-1 h-8 text-red-600 border border-red-200 rounded-lg bg-white disabled:opacity-50 flex justify-center items-center gap-1.5"
              >
                {exitConsultationAction === 'discard' ? <Loader2 size={14} className="animate-spin" /> : null}
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={handleSaveDraftAndExit}
                disabled={isSubmitting}
                className="type-section-title flex-1 h-8 bg-teal-600 text-white rounded-lg flex justify-center items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {exitConsultationAction === 'save' ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Appointments" footer={<div className="flex gap-2"><button onClick={clearFilters} className="type-section-title flex-1 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white">Clear</button><button onClick={applyActiveFilters} className="type-section-title flex-1 bg-teal-600 text-white py-1.5 rounded-lg">Apply</button></div>}>
        <div className="space-y-4">
          <div><h4 className="type-utility text-slate-400 uppercase mb-2">Date Range</h4><div className="grid grid-cols-2 gap-2"><div><span className="type-utility text-teal-700 uppercase block mb-1">From</span><input type="date" className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" value={tempFilters.dateFrom} onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })} /></div><div><span className="type-utility text-teal-700 uppercase block mb-1">To</span><input type="date" className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" value={tempFilters.dateTo} onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })} /></div></div></div>
          <div><h4 className="type-utility text-slate-400 uppercase mb-2">Doctor</h4><select className="type-body w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" value={tempFilters.doctorId} onChange={(e) => setTempFilters({ ...tempFilters, doctorId: e.target.value })}><option value="">All Doctors</option>{data.doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
          {/* <div><h4 className="text-[12px] font-bold text-slate-400 uppercase mb-2">Status</h4><div className="flex flex-wrap gap-2">{['Scheduled', 'Completed', 'Cancelled', 'No-Show'].map(status => { const isSelected = tempFilters.status.includes(status); return (<button key={status} onClick={() => { let newStatus = isSelected ? tempFilters.status.filter(s => s !== status) : [...tempFilters.status, status]; if (['Scheduled', 'Completed', 'Cancelled', 'No-Show'].every(s => newStatus.includes(s))) { newStatus = []; } setTempFilters({...tempFilters, status: newStatus}); }} className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${isSelected ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{status}</button>); })}</div></div> */}
        </div>
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setRebookingApptId(null); setIsFollowUpBooking(false); setFollowUpSourceApptId(''); setModalError(''); setInvalidFields([]); setPatientSearchQuery(''); setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate }); setNewPatientDetails(defaultNewPatientDetails); }} title={rebookingApptId ? "ReBook Appointment" : (isFollowUpBooking ? "Follow-Up Appointment" : "New Appointment")}
        footer={
          <button
            onClick={handleAddAppointment}
            disabled={isSubmitting}
            className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Confirming...</> : 'Confirm Booking'}
          </button>
        }>
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          <div>
            <label className="type-label block text-slate-500 mb-1 uppercase">Patient <span className="text-red-500">*</span></label>
            {newAppt.patientId ? (
               <div className={`flex items-center justify-between p-2.5 border rounded-lg bg-slate-50 shadow-inner ${invalidFields.includes('patientId') ? 'border-red-500' : 'border-slate-200'}`}>
                  {/* --- SELECTED PATIENT BADGE --- */}
                  <div className="flex items-center gap-2">
                     {newAppt.patientId === 'add_new' ? (
                        <span className="type-body text-teal-600 flex items-center gap-1.5"><Plus size={16}/> New Patient Entry</span>
                     ) : (
                        <div>
                          <div className="type-card-title text-slate-800">{getPatientName(newAppt.patientId)}</div>
                          <div className="type-label text-slate-500">Selected Patient</div>
                        </div>
                     )}
                  </div>
                  {/* Hide the change button if we are strictly Rebooking */}
                  {!rebookingApptId && (
                    <button 
                      type="button" 
                      onClick={() => { setNewAppt({...newAppt, patientId: ''}); setPatientSearchQuery(''); setIsPatientDropdownOpen(false); }} 
                      className="type-label text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                    >
                      Change
                    </button>
                  )}
               </div>
            ) : (
               <div className="relative">
                 {/* --- SEARCH BAR & DROPDOWN --- */}
                 <div className="relative">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input
                      type="text"
                      placeholder="Search by name or phone..."
                      value={patientSearchQuery}
                      onFocus={() => setIsPatientDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsPatientDropdownOpen(false), 200)}
                      onChange={e => {
                          setPatientSearchQuery(e.target.value);
                          setIsPatientDropdownOpen(true);
                      }}
                      className={`type-body w-full pl-9 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${invalidFields.includes('patientId') ? 'border-red-500' : 'border-slate-200 bg-slate-50'}`}
                   />
                 </div>
                 
                 {/* The Floating List */}
                 {isPatientDropdownOpen && (
                   <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[220px] overflow-y-auto">
                      <button
                        type="button"
                        onMouseDown={(e) => { 
                            e.preventDefault(); 
                            setNewAppt({...newAppt, patientId: 'add_new'}); 
                            setPatientSearchQuery(''); 
                            setIsPatientDropdownOpen(false); 
                        }}
                        className="type-body w-full text-left px-3 py-2.5 text-teal-600 hover:bg-teal-50 flex items-center gap-2 border-b border-slate-100 transition-colors sticky top-0 bg-white/95 backdrop-blur-sm z-10"
                      >
                        <div className="bg-teal-100 p-1 rounded-md"><Plus size={14} className="text-teal-700" /></div> Create New Patient
                      </button>
                      
                      {patientSearchQuery.length > 0 && data.patients
                        .filter(p => 
                          (p.name || '').toLowerCase().includes(patientSearchQuery.toLowerCase()) || 
                          (p.phone || '').includes(patientSearchQuery)
                        )
                        .slice(0, 30)
                        .map(p => (
                         <button
                           key={p._id}
                           type="button"
                           onMouseDown={(e) => { 
                               e.preventDefault(); 
                               setNewAppt({...newAppt, patientId: p._id}); 
                               setPatientSearchQuery(''); 
                               setIsPatientDropdownOpen(false); 
                           }}
                           className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex justify-between items-center group"
                         >
                           <div>
                             <div className="type-card-title text-slate-700 group-hover:text-teal-700">{p.name}</div>
                             <div className="type-label text-slate-400">{p.phone}</div>
                           </div>
                           <div className="type-label text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Select</div>
                         </button>
                      ))}
                      
                      {patientSearchQuery !== '' && data.patients.filter(p => (p.name || '').toLowerCase().includes(patientSearchQuery.toLowerCase()) || (p.phone || '').includes(patientSearchQuery)).length === 0 && (
                         <div className="type-secondary p-4 text-center text-slate-400">No matching patients found.</div>
                      )}
                   </div>
                 )}
               </div>
            )}
          </div>
          {newAppt.patientId === 'add_new' && (
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-100 space-y-2">
              {/* SPLIT NAME INPUTS */}
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="First Name *"
                  className={`type-body w-full p-1.5 border rounded outline-none ${invalidFields.includes('newPatientName') ? 'border-red-500' : 'border-teal-200'}`}
                  value={newPatientDetails.firstName}
                  onChange={(e) => handlePatientNameInput('firstName', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Middle"
                  className="type-body w-full p-1.5 border border-teal-200 rounded outline-none"
                  value={newPatientDetails.middleName}
                  onChange={(e) => handlePatientNameInput('middleName', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="type-body w-full p-1.5 border border-teal-200 rounded outline-none"
                  value={newPatientDetails.lastName}
                  onChange={(e) => handlePatientNameInput('lastName', e.target.value)}
                />
              </div>

              {/* RESTRICTED PHONE & AGE */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Phone *"
                  className={`type-body w-full p-1.5 border rounded outline-none ${invalidFields.includes('newPatientPhone') ? 'border-red-500' : 'border-teal-200'}`}
                  value={newPatientDetails.phone}
                  onChange={(e) => handlePatientPhoneInput(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <input
                    type="tel" // usage of tel on age helps mobile keyboards
                    placeholder="Age *"
                    className={`type-body w-1/2 p-1.5 border rounded outline-none ${invalidFields.includes('newPatientAge') ? 'border-red-500' : 'border-teal-200'}`}
                    value={newPatientDetails.age}
                    onChange={(e) => handlePatientAgeInput(e.target.value)}
                  />
                  <select
                    className="type-body w-1/2 p-1.5 border border-teal-200 rounded"
                    value={newPatientDetails.gender}
                    onChange={(e) => setNewPatientDetails({ ...newPatientDetails, gender: e.target.value })}
                  >
                    <option value="M">M</option><option value="F">F</option><option value="O">O</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                placeholder="Address *"
                // 👇 The check here matches the string pushed above
                className={`type-body w-full p-1.5 border rounded outline-none ${invalidFields.includes('newPatientAddress') ? 'border-red-500' : 'border-teal-200'
                  }`}
                value={newPatientDetails.address}
                onChange={(e) => handlePatientAddressInput(e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="type-label block text-slate-500 mb-1 uppercase">Department</label>
              <select className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50" value={newAppt.department} onChange={(e) => setNewAppt({ ...newAppt, department: e.target.value, doctorId: '', time: '' })}><option value="">All</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
            </div>
            <div>
              <label className="type-label block text-slate-500 mb-1 uppercase">Doctor <span className="text-red-500">*</span></label>
              <select className={`type-body w-full p-2 border rounded-lg bg-slate-50 outline-none ${invalidFields.includes('doctorId') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.doctorId} onChange={(e) => { const doc = getDoctorById(e.target.value); setNewAppt({ ...newAppt, doctorId: e.target.value, department: doc ? doc.department : newAppt.department, time: '' }); }}>
                <option value="">Select</option>
                {/* FIX: Filter Doctors - Must be 'Available' AND match department */}
                {data.doctors
                  .filter(d => (!newAppt.department || d.department === newAppt.department) && d.status === 'Available')
                  .map(d => <option key={d._id} value={d._id}>{d.name}</option>)
                }
              </select>
            </div>
          </div>
          <div><label className="type-label block text-slate-500 mb-1 uppercase">Select Date <span className="text-red-500">*</span></label><input type="date" min={new Date().toISOString().split('T')[0]} max={maxDateStr} className={`type-body w-full p-2 border rounded-lg bg-slate-50 outline-none ${invalidFields.includes('date') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value, time: '' })} /></div>
          <div>
            <label className="type-label block text-slate-500 mb-1 uppercase">Available Slots <span className="text-red-500">*</span></label>
            <div className={`rounded-lg ${invalidFields.includes('time') ? 'border border-red-500 p-1' : ''}`}>
              <TimeSlotPicker selectedTime={newAppt.time} onSelect={(t) => setNewAppt({ ...newAppt, time: t })} doctor={getDoctorById(newAppt.doctorId)} date={newAppt.date} appointments={data.calendar30 || []} clinic={data.clinic} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isRescheduleModalOpen} onClose={() => { setIsRescheduleModalOpen(false); setActionAppt(null); }} title="Reschedule" footer={
        <button
          onClick={confirmReschedule}
          disabled={isSubmitting}
          className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : 'Update Appointment'}
        </button>
      }>
        <div className="space-y-3">
          {actionAppt && (<div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between mb-2"><span className="type-utility text-slate-500 uppercase">Currently Scheduled:</span><span className="type-body text-slate-700">{actionAppt.date} at {actionAppt.time}</span></div>)}
          <AlertMessage message={modalError} />
          <div><label className="type-label block text-slate-500 mb-1 uppercase">New Date</label><input type="date" min={new Date().toISOString().split('T')[0]} max={maxDateStr} className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50" value={rescheduleData.date} onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value, time: '' })} /></div><div><label className="type-label block text-slate-500 mb-1 uppercase">Available Slots</label><TimeSlotPicker selectedTime={rescheduleData.time} onSelect={(t) => setRescheduleData({ ...rescheduleData, time: t })} doctor={getDoctorById(actionAppt?.doctorId)} date={rescheduleData.date} appointments={data.calendar30 || []} clinic={data.clinic} /></div>
        </div>
      </Modal>

      <Modal
        isOpen={isContactModalOpen}
        onClose={() => { setIsContactModalOpen(false); setContactAppt(null); }}
        title="Contact Patient"
        footer={
          <div className="flex gap-2">
            {dialableContactPhone ? (
              <a
                href={`tel:${dialableContactPhone}`}
                className="type-section-title flex-1 h-8 bg-teal-600 text-white rounded-lg flex justify-center items-center gap-1.5 whitespace-nowrap"
              >
                <Phone size={14} /> Call
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="type-section-title flex-1 h-8 bg-slate-200 text-slate-400 rounded-lg flex justify-center items-center gap-1.5 whitespace-nowrap cursor-not-allowed"
              >
                <Phone size={14} /> Call
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const appt = contactAppt;
                setIsContactModalOpen(false);
                setContactAppt(null);
                if (appt) handleSendReminder(appt);
              }}
              disabled={!dialableContactPhone || processingAppointmentId === contactAppt?._id}
              className="type-section-title flex-1 h-8 bg-teal-600 text-white rounded-lg flex justify-center items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAppointmentId === contactAppt?._id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              Send Reminder
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <p className="type-card-title text-slate-800">{getPatientName(contactAppt?.patientId)}</p>
            <p className="type-body text-slate-600 mt-1">{contactPhone || 'No mobile number available'}</p>
          </div>
          {dialableContactPhone ? (
            <p className="type-secondary text-slate-500">
              If calling is unavailable, use reminder option
            </p>
          ) : (
            <p className="type-secondary text-slate-500">
              Add a mobile number in the patient profile before calling or sending a reminder.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isVitalsModalOpen}
        onClose={() => { setIsVitalsModalOpen(false); setActionAppt(null); setModalError(''); }}
        title="Add Vitals"
        footer={
          <button
            onClick={handleSaveVitals}
            disabled={isSubmitting}
            className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Vitals'}
          </button>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          {actionAppt && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="type-card-title text-slate-800">{vitalsPatient?.name || 'Unknown Patient'}</p>
              <p className="type-secondary text-slate-500">
                {vitalsPatient?.age ? `${vitalsPatient.age} Yrs` : 'Age Unknown'} | {vitalsPatientGender}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="type-label block text-slate-500 mb-1 uppercase">BP</label>
              <input type="text" placeholder="120/80" value={vitalsData.bp} onChange={e => setVitalsData({ ...vitalsData, bp: e.target.value })} className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="type-label block text-slate-500 mb-1 uppercase">Temp</label>
              <input type="text" placeholder="98.6" value={vitalsData.temp} onChange={e => setVitalsData({ ...vitalsData, temp: e.target.value })} className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className="type-label block text-slate-500 mb-1 uppercase">Weight</label>
              <input type="text" placeholder="70" value={vitalsData.weight} onChange={e => setVitalsData({ ...vitalsData, weight: e.target.value })} className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => { setIsHistoryModalOpen(false); setPreviewAppt(null); setHistoryData([]); setHistoryError(''); }}
        title={`Patient History - ${getPatientName(previewAppt?.patientId)}`}
        panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
        bodyClassName="p-2 overflow-y-auto flex-1 overscroll-contain"
      >
        <AlertMessage message={historyError} />
        <PatientHistoryList historyData={historyData} isLoading={isHistoryLoading} layout="vertical" embeddedMarker />
      </Modal>

      <Modal
        isOpen={isViewVitalsModalOpen}
        onClose={() => { setIsViewVitalsModalOpen(false); setPreviewAppt(null); }}
        title="View Vitals"
      >
        {previewAppt?.vitalsRecordedAt ? (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="type-card-title text-slate-800">{getPatientName(previewAppt.patientId)}</p>
              <p className="type-secondary text-slate-500">Recorded before consultation</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2"><p className="type-label uppercase text-slate-400">BP</p><p className="type-body text-slate-800">{previewAppt.vitals?.bp || '-'}</p></div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2"><p className="type-label uppercase text-slate-400">Temp</p><p className="type-body text-slate-800">{previewAppt.vitals?.temp || '-'}</p></div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2"><p className="type-label uppercase text-slate-400">Weight</p><p className="type-body text-slate-800">{previewAppt.vitals?.weight || '-'}</p></div>
            </div>
          </div>
        ) : (
          <div className="type-body text-slate-500 text-center py-6">No vitals recorded for this appointment yet.</div>
        )}
      </Modal>

      <Modal
        isOpen={isLeftEarlyModalOpen}
        onClose={() => { setIsLeftEarlyModalOpen(false); setActionAppt(null); setLeftEarlyReason(''); setModalError(''); }}
        title="Patient Walked Out ?"
        footer={
          <div className="flex">
            <button
              type="button"
              onClick={confirmLeftEarly}
              disabled={isSubmitting}
              className="type-section-title w-full h-8 bg-red-600 text-white rounded-lg flex justify-center items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {isSubmitting ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          <p className="type-body text-slate-600">
            Patient checked in but left before consultation.
          </p>
          <div>
            <label className="type-label block text-slate-500 mb-1 uppercase">Reason (Optional)</label>
            <select
              value={leftEarlyReason}
              onChange={(event) => setLeftEarlyReason(event.target.value)}
              className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select reason</option>
              <option value="Long wait time">Long wait time</option>
              <option value="Patient emergency">Patient emergency</option>
              <option value="Will reschedule">Will reschedule</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </Modal>

      <BillingPaymentModal
        isOpen={isBillingPaymentModalOpen}
        onClose={() => {
          setIsBillingPaymentModalOpen(false);
          setBillingPaymentContext(null);
        }}
        clinic={data.clinic}
        context={billingPaymentContext}
        onSaved={() => {
          fetchAllData(true);
        }}
      />

      <Modal isOpen={isCancelModalOpen} onClose={() => { setIsCancelModalOpen(false); setActionAppt(null); }} title="Cancel Appointment" footer={
        <div className="flex gap-2">
          <button onClick={() => setIsCancelModalOpen(false)} disabled={isSubmitting} className="flex-1 py-1.5 text-slate-600 border rounded-lg bg-white disabled:opacity-50">Keep it</button>
          <button onClick={confirmCancel} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-1.5 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Cancelling...</> : 'Yes, Cancel'}
          </button>
        </div>
      }><div className="type-body text-slate-600">Are you sure you want to cancel?</div></Modal>
    </div>
  );
};

export default Appointments;

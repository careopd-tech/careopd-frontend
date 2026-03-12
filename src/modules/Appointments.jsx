import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  Calendar, CalendarCheck, History, Plus, Clock, RefreshCw, 
  ChevronDown, CalendarDays, CheckCircle, AlertCircle, Loader2, X 
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import FAB from '../components/ui/FAB';
import AlertMessage from '../components/ui/AlertMessage';
import ModuleHeader from '../components/ui/ModuleHeader';
import TimeSlotPicker from '../components/business/TimeSlotPicker';
import { useGlobalDate } from '../context/DateContext'; 
import API_BASE_URL from '../config';

const Appointments = ({ data, setData }) => {
  // --- 1. CONTEXT & BASICS ---
  const dateContext = useGlobalDate();
  const safeCurrentDate = dateContext?.currentDate || new Date().toISOString().split('T')[0];
  const clinicId = localStorage.getItem('clinicId');

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
  const [loading, setLoading] = useState(() => {
      if (data.cachedSections) return false;
      return !data.appointments || data.appointments.length === 0;
  });

  const [activeFilters, setActiveFilters] = useState({ dateFrom: '', dateTo: '', doctorId: '', status: [] });
  const [tempFilters, setTempFilters] = useState(activeFilters);

  // Modals & Action State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState('today');
  const [rebookingApptId, setRebookingApptId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [actionAppt, setActionAppt] = useState(null);

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
  const [newAppt, setNewAppt] = useState({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate });
  const [newPatientDetails, setNewPatientDetails] = useState({ firstName: '', middleName: '', lastName: '', phone: '', age: '', gender: 'M', address: '' });
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);

  // Refs
  const previousListRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const sectionsRef = useRef(sections);
  const metaCountsRef = useRef(metaCounts);
  const expandedSectionRef = useRef(expandedSection);
  const searchQueryRef = useRef(searchQuery);
  const searchPageRef = useRef(searchPage); 
  const hasSnappedToBottomRef = useRef(false);

  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { metaCountsRef.current = metaCounts; }, [metaCounts]);
  useEffect(() => { expandedSectionRef.current = expandedSection; }, [expandedSection]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { searchPageRef.current = searchPage; }, [searchPage]); 

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

  // --- 3. LOGIC HELPERS ---
  const getUiStatus = (appt) => {
    if (appt.status === 'Cancelled') return 'Cancelled';
    if (appt.status === 'Completed' || appt.status === 'Done') return 'Completed';
    const isPast = appt.date < safeCurrentDate;
    if (isPast && (appt.status === 'Scheduled' || appt.status === 'Pending')) return 'No-Show';
    return 'Scheduled';
  };

  const getPatientName = (id) => { const p = (data.patients || []).find(p => String(p._id) === String(id) || String(p.id) === String(id)); return p ? p.name : 'Unknown'; };
  const getDoctorName = (id) => { const d = (data.doctors || []).find(d => String(d._id) === String(id) || String(d.id) === String(id)); return d ? d.name : 'Unknown'; };
  const getDoctorById = (id) => (data.doctors || []).find(d => String(d._id) === String(id));
  
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
          if (activeFilters.doctorId && String(appt.doctorId) !== String(activeFilters.doctorId)) return false;
          if (activeFilters.status.length > 0 && !activeFilters.status.includes(uiStatus)) return false;
      }
      return true;
  });

  // --- 6. DATA FETCHING (RESTORED SMART REFRESH) ---
  const fetchAllData = async (forceSync = false, overrideQuery = undefined) => {
    if (!clinicId) return;
    const isNewSearch = overrideQuery !== undefined; 
    const currentQuery = isNewSearch ? overrideQuery : searchQueryRef.current;
    const isSearchMode = !!currentQuery && currentQuery.trim().length > 0;

    try {
      const promises = [];
      const dashboardPromise = Promise.all([
          fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=snapshot&date=${safeCurrentDate}`),
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}`),
          fetch(`${API_BASE_URL}/api/patients/${clinicId}`)
        ]).then(async ([snapshotRes, docsRes, patsRes]) => {
            if (snapshotRes.ok && docsRes.ok && patsRes.ok) {
                const [snapshot, docs, pats] = await Promise.all([snapshotRes.json(), docsRes.json(), patsRes.json()]);
                
                const activeSection = expandedSectionRef.current;

                // RESTORED: Smart Refresh Logic with Strict Guards
                const syncGroup = async (group, serverCount) => {
                    // GUARD: Only sync if the user is actively viewing this section
                    if (activeSection !== group) return sectionsRef.current[group];

                    const currentList = sectionsRef.current[group];
                    
                    // SMART SYNC: If Server says 19, but Local has 18, triggers heal.
                    const needsSync = serverCount !== currentList.length || (forceSync && activeSection === group);

                    if (needsSync) {
                        const currentPages = Math.ceil((currentList.length || 1) / 20);
                        const limit = Math.max(currentPages * 20, 20); 
                        
                        const res = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=batch&group=${group}&page=1&limit=${limit}&date=${safeCurrentDate}`);
                        if (res.ok) {
                            let list = await res.json();
                            // Sort 'Previous' Ascending (Oldest -> Newest)
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
                    ...prev, doctors: docs, patients: pats, appointments: updatedToday, counts: snapshot.counts, cachedSections: finalSections 
                }));
            }
        });
      promises.push(dashboardPromise);

      if (isSearchMode) {
        if (!forceSync) setIsSearching(true);
        const currentPagesLoaded = isNewSearch ? 1 : searchPageRef.current;
        const limitToFetch = Math.max(20, currentPagesLoaded * 20);

        const searchPromise = fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=search&query=${currentQuery}&page=1&limit=${limitToFetch}`)
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

    } catch (err) { console.error("Fetch Error:", err); } 
    finally { setLoading(false); setIsSearching(false); }
  };

  useEffect(() => {
    fetchAllData(true); 
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
      // SCENARIO 1: "Load Older" was clicked (Prepend Data)
      if (previousScrollHeightRef.current > 0) {
        const newScrollHeight = previousListRef.current.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeightRef.current;
        previousListRef.current.scrollTop += heightDifference; 
        previousScrollHeightRef.current = 0;
      } 
      // SCENARIO 2: Initial Open
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
    
    // Collapse sections immediately to stop background syncing in fetchAllData
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
    
    // FIX: Capture Scroll Position FIRST to ensure Anti-Jerk works
    if (group === 'previous' && previousListRef.current) {
        previousScrollHeightRef.current = previousListRef.current.scrollHeight;
    }

    setBatchLoading(prev => ({ ...prev, [group]: true }));
    try {
      const currentList = sectionsRef.current[group];
      const currentLen = currentList.length;
      let pageToFetch, limitToFetch;

      // Smart Gap-Healing Logic for Load More
      if (currentLen % 20 !== 0) {
          pageToFetch = 1;
          limitToFetch = Math.ceil(currentLen / 20) * 20; 
      } else {
          pageToFetch = (currentLen / 20) + 1; // Explicit Page calculation
          limitToFetch = 20;
      }

      const response = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=batch&group=${group}&page=${pageToFetch}&limit=${limitToFetch}&date=${safeCurrentDate}`);
      if (response.ok) {
        const newItems = await response.json();
        
        // 1. REFRESH MODE (Healed the list)
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
        // 2. APPEND MODE (Load Older)
        else if (newItems.length > 0) {
          // Explicit Sort (Oldest -> Newest)
          if (group === 'previous') {
              newItems.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          }

          const nextSections = {
                ...sectionsRef.current,
                [group]: group === 'previous' 
                    ? [...newItems, ...sectionsRef.current.previous] // Prepend Oldest
                    : [...sectionsRef.current.upcoming, ...newItems] // Append Future
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
        const response = await fetch(`${API_BASE_URL}/api/appointments/${clinicId}?mode=search&query=${searchQuery}&page=${nextPage}&limit=20`);
        const data = await response.json();
        const newItems = Array.isArray(data) ? data : (data.data || []);
        
        if (newItems.length > 0) {
            setSearchResults(prev => [...prev, ...newItems]);
            setSearchPage(nextPage);
        }
    } catch (err) { console.error("Search Error:", err); } 
    finally { setIsSearchLoadingMore(false); }
  };

  const handleToggleSection = (id) => {
    if (expandedSection === id) setExpandedSection(null);
    else {
      setExpandedSection(id);
      // Only fetch if empty. 'Smart Refresh' handles the count mismatches in fetchAllData.
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
            if (activeFilters.doctorId && String(appt.doctorId) !== String(activeFilters.doctorId)) return false;
            return true;
        });
    }

    const scheduled = sourceData.filter(a => getUiStatus(a) === 'Scheduled').length;
    const completed = sourceData.filter(a => getUiStatus(a) === 'Completed').length;
    const cancelled = sourceData.filter(a => getUiStatus(a) === 'Cancelled').length;
    const noShow = sourceData.filter(a => getUiStatus(a) === 'No-Show').length;

    return [
        { key: 'Scheduled', label: 'Scheduled', val: scheduled, color: 'bg-amber-50 text-amber-700' },
        { key: 'Completed', label: 'Completed', val: completed, color: 'bg-green-50 text-green-700' },
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
    if (['Scheduled', 'Completed', 'Cancelled', 'No-Show'].every(s => newStatusList.includes(s))) {
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
    // 1. Strict: Letters and Dot ONLY. (Removed \s to ban spaces)
    let cleanVal = value.replace(/[^a-zA-Z.]/g, ''); 

    // 2. Strict "One Dot" Rule: If more than 1 dot exists, block the input
    if ((cleanVal.match(/\./g) || []).length > 1) {
        return; 
    }

    setNewPatientDetails(prev => ({ ...prev, [field]: cleanVal }));
  };

  const handlePatientPhoneInput = (value) => {
    // Numbers only, max 10
    const cleanVal = value.replace(/\D/g, '').slice(0, 10); 
    setNewPatientDetails(prev => ({ ...prev, phone: cleanVal }));
  };

const handlePatientAgeInput = (value) => {
    // 1. Remove non-digits and limit to 3 chars
    let cleanVal = value.replace(/\D/g, '').slice(0, 3);

    // 2. Remove leading zeros (Prevents "0", "05", etc.)
    // If the user types "0", it effectively becomes an empty string
    if (cleanVal.startsWith('0')) {
        cleanVal = cleanVal.replace(/^0+/, ''); 
    }

    setNewPatientDetails(prev => ({ ...prev, age: cleanVal }));
  };

const handlePatientAddressInput = (value) => {
    let cleanVal = value
      // 1. Allow: Alphanumeric, Space, Dot, Hyphen, Underscore, Comma, Hash, Forward Slash
      // Note: We escape the hyphen \- and the forward slash \/
      .replace(/[^a-zA-Z0-9\s.\-_,#\/&']/g, '') 

      // 2. Remove Leading Spaces
      .replace(/^\s+/g, '')

      // 3. Collapse multiple spaces to single
      .replace(/\s\s+/g, ' ')

      // 4. Collapse multiple special chars to single (e.g., prevents "St..", ",,", "##")
      // This matches any of the chars in the group, if repeated, and replaces with the first instance
      .replace(/([.,_#\-\/])\1+/g, '$1');

    setNewPatientDetails(prev => ({ ...prev, address: cleanVal }));
  };

  // --- ACTIONS ---
  const handleAddAppointment = async () => { 
    setModalError('');
    let errors = [];
    if (!newAppt.patientId) errors.push('patientId');
    if (newAppt.patientId === 'add_new') {
      if (!newPatientDetails.firstName) errors.push('newPatientName'); // Check First Name
      if (!newPatientDetails.phone || newPatientDetails.phone.length < 10) errors.push('newPatientPhone');
      if (!newPatientDetails.age) errors.push('newPatientAge');
      if (!newPatientDetails.address) errors.push('newPatientAddress');
    }
    if (!newAppt.doctorId) errors.push('doctorId');
    if (!newAppt.date) errors.push('date');
    if (!newAppt.time) errors.push('time');

    if (errors.length > 0) { setInvalidFields(errors); return setModalError('Please fill required fields *'); }
    if (!validateFutureDate(newAppt.date, newAppt.time)) return setModalError('Cannot book in the past.');
    const checkPatientConflict = (pid, date, time, eid) => pid !== 'add_new' && (sections.today || []).some(a => String(a.patientId) === String(pid) && a.date === date && a.time === time && a.status !== 'Cancelled' && a._id !== eid);
    if (checkPatientConflict(newAppt.patientId, newAppt.date, newAppt.time, rebookingApptId)) return setModalError('Conflict: Appointment exists.');

    setInvalidFields([]);
    
    // CONSTRUCT FULL NAME
    // Logic: Put parts in an array, remove empty ones (filter), join with exactly 1 space.
    const fullName = newAppt.patientId === 'add_new' 
      ? [newPatientDetails.firstName, newPatientDetails.middleName, newPatientDetails.lastName]
          .filter(Boolean) // Removes empty strings ("") or null/undefined
          .join(' ')       // Joins remaining parts with a single space
      : '';

    const payload = {
      clinicId: localStorage.getItem('clinicId'),
      patientId: newAppt.patientId, doctorId: newAppt.doctorId, time: newAppt.time, date: newAppt.date, type: 'Consultation', 
      status: 'Scheduled', newPatientData: newAppt.patientId === 'add_new' ? {
          ...newPatientDetails,
          name: fullName // Send combined name to API
      } : null
    };

    try {
      const url = rebookingApptId ? `${API_BASE_URL}/api/appointments/${rebookingApptId}` : `${API_BASE_URL}/api/appointments`;
      const method = rebookingApptId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      
      if (res.ok) {
        await fetchAllData(true); 
        setIsAddModalOpen(false); setRebookingApptId(null);
        setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate });
        setNewPatientDetails({ name: '', phone: '', age: '', gender: 'M', address: '' });
        
        const pName = newAppt.patientId === 'add_new' ? newPatientDetails.name : getPatientName(newAppt.patientId);
        showNotification(
            rebookingApptId ? 'Appointment Rebooked' : 'Appointment Booked', 
            'success',
            `Appointment ${rebookingApptId ? 'Rebooked' : 'Booked'} for ${pName} on ${newAppt.date}  at ${newAppt.time}`
        );
      } else {
        if (result.errorCode === 'ERR_PATIENT_DUPLICATE') {
            setInvalidFields(prev => [...prev, 'newPatientPhone']);
        }
        setModalError(result.errorMessage || result.error || "Failed to save appointment.");
      }
    } catch (e) { setModalError("Server error."); }
  };
  
  const confirmCancel = async () => { 
      if (!actionAppt) return;
      await fetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: 'Cancelled'})});
      await fetchAllData(true); 
      setIsCancelModalOpen(false); 
      showNotification('Appointment Cancelled', 'error', `Appointment Cancelled for ${getPatientName(actionAppt.patientId)} scheduled on ${actionAppt.date} at ${actionAppt.time}`);
      setActionAppt(null); 
  };
  
  const confirmReschedule = async () => { 
      if (!rescheduleData.date || !rescheduleData.time) return setModalError('Select date & time');
      if (!validateFutureDate(rescheduleData.date, rescheduleData.time)) return setModalError('Cannot reschedule to the past.');
      await fetch(`${API_BASE_URL}/api/appointments/${actionAppt._id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({date: rescheduleData.date, time: rescheduleData.time, status: 'Scheduled'})});
      await fetchAllData(true); 
      setIsRescheduleModalOpen(false); 
      showNotification('Appointment Rescheduled', 'success', `Appointment Rescheduled for ${getPatientName(actionAppt.patientId)} to ${rescheduleData.date} at ${rescheduleData.time}`);
      setActionAppt(null); 
  };
  
  const handleRebook = (appt) => { 
    const doc = getDoctorById(appt.doctorId);
    setNewAppt({ patientId: appt.patientId.toString(), department: doc ? doc.department : '', doctorId: appt.doctorId.toString(), date: safeCurrentDate, time: '' });
    setRebookingApptId(appt.date < safeCurrentDate ? null : appt._id);
    setIsAddModalOpen(true);
  };

  // --- RENDER HELPERS ---
  const renderAppointmentCard = (appt) => {
    const uiStatus = getUiStatus(appt);
    const isCancelled = uiStatus === 'Cancelled';
    const isCompleted = uiStatus === 'Completed';
    const isNoShow = uiStatus === 'No-Show';
    const showActions = !isCancelled && !isCompleted && !isNoShow;
    
    return (
      <div key={appt._id} className={`p-3 rounded-xl border border-slate-100 shadow-sm relative flex flex-col md:flex-row gap-2 ${isCancelled || isNoShow ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
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
          <div className="flex flex-row md:flex-col gap-1.5 border-t md:border-t-0 md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-3 justify-end flex-shrink-0 md:w-32">
            <button onClick={() => { setActionAppt(appt); setIsCancelModalOpen(true); }} className="flex-1 md:flex-none w-full h-7 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap">Cancel</button>
            <button onClick={() => { setActionAppt(appt); setRescheduleData({ date: appt.date, time: appt.time }); setIsRescheduleModalOpen(true); }} className="flex-1 md:flex-none w-full h-7 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap"><CalendarDays size={12} /> Reschedule</button>
          </div>
        )}
        {(isCancelled || isNoShow) && (
          <div className="flex flex-row md:flex-col gap-1.5 border-t md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-3 justify-end flex-shrink-0 md:w-32">
             <button onClick={() => handleRebook(appt)} className="flex-1 md:flex-none w-full h-7 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg flex items-center justify-center gap-1 whitespace-nowrap"><RefreshCw size={12} /> ReBook</button>
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
            <h3 className="text-[11px] font-bold uppercase tracking-wider">
              {title} 
              {isFiltering && <span className="text-red-500 ml-1.5 text-[10px]">(Filtered)</span>}
            </h3>
            {id === 'today' && <span className="bg-teal-100 text-teal-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1.5">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">{(!loading || items.length > 0) ? `(${displayCount})` : ''}</span>
          </div>
          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} className="text-slate-400" /></div>
        </button>
        
        {isExpanded && (
          <div ref={id === 'previous' ? previousListRef : null} className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide animate-fadeIn relative">
             {isSectionLoading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-teal-600 mb-2" />
                  <span className="text-[10px] font-medium">Loading records...</span>
                </div>
             )}
             
             {id === 'previous' && items.length > 0 && items.length < metaCounts.previous && (
                <button onClick={() => fetchBatch(id)} disabled={isSectionLoading} className="w-full py-1.5 mb-2 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5 flex-shrink-0">
                  {isSectionLoading ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown className="rotate-180" size={12} />}
                  {isSectionLoading ? 'Loading...' : 'Load Older'}
                </button>
             )}

             {visibleItems.length > 0 && visibleItems.map(renderAppointmentCard)}

             {!isSectionLoading && visibleItems.length === 0 && <div className="text-center py-6 text-slate-400 text-[11px] italic">No appointments</div>}

             {id !== 'previous' && id !== 'today' && items.length > 0 && items.length < metaCounts.upcoming && (
                <button onClick={() => fetchBatch(id)} disabled={isSectionLoading} className="w-full py-1.5 mt-2 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5 flex-shrink-0">
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

  return (
    <div className="h-full flex flex-col relative">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="text-[13px] font-bold">{notification.message}</span>
        </div>
      )}

      <ModuleHeader 
        title="Appointments" 
        shortTitle="Appts" 
        searchVal={searchQuery} 
        onSearch={handleSearchInput} 
        onFilterClick={openFilterModal} 
        hasFilter={hasActiveFilters} 
        notifications={notificationStack} 
        onClearAll={handleClearNotifications} 
        onDismiss={handleDismissNotification} 
      />
      
      <div className="flex-1 flex flex-col landscape:flex-row min-h-0 p-2 gap-2">
        <div className="flex-none landscape:w-20 pb-1 landscape:pb-0">
          <div className="flex flex-row landscape:flex-col gap-1.5 landscape:h-full">
            {statsConfig.map((s, i) => {
              const isActive = activeFilters.status.includes(s.key);
              return (
                <button 
                  key={s.key} 
                  onClick={() => handleStatsClick(s.key)} 
                  className={`flex-1 p-1.5 rounded-xl border duration-200 text-center flex flex-col items-center justify-center ${s.color} ${isActive ? 'border-slate-400 ring-2 ring-slate-200 shadow-inner' : 'border-slate-100 hover:shadow-sm'}`}
                >
                  <div className="text-[17px] font-bold leading-tight">{s.val}</div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">{s.label}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {searchQuery ? (
            <div className="flex-1 flex flex-col min-h-0 animate-fadeIn bg-white">
              <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 shadow-sm flex-none">
                 <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-teal-700" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Search Results {hasActiveFilters && <span className="text-red-500 ml-1.5 text-[10px]">(Filtered)</span>}</h3>
                    <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                      Showing {visibleSearchResults.length} of {searchTotal}
                    </span>
                 </div>
                 <button onClick={() => handleSearchInput('')} className="p-0 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50 scrollbar-hide">
                {isSearching ? (
                   <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-teal-600" /><span className="text-xs">Searching database...</span></div>
                ) : visibleSearchResults.length > 0 ? (
                   <>
                     {visibleSearchResults.map(renderAppointmentCard)}
                     
                     {searchResults.length < searchTotal && (
                        <button 
                           onClick={fetchSearchMore}
                           disabled={isSearchLoadingMore}
                           className="w-full py-2 mt-2 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex justify-center items-center gap-1.5"
                        >
                           {isSearchLoadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                           {isSearchLoadingMore ? 'Loading...' : 'Load More Results'}
                        </button>
                     )}
                   </>
                ) : (<div className="py-10 text-center text-slate-400 text-xs">{searchResults.length > 0 ? "No results match your active filters." : `No records found for "${searchQuery}"`}</div>)}
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
      
      <FAB icon={Plus} onClick={() => { setRebookingApptId(null); setIsAddModalOpen(true); }} />

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Appointments" footer={<div className="flex gap-2"><button onClick={clearFilters} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white">Clear</button><button onClick={applyActiveFilters} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Apply</button></div>}>
         <div className="space-y-4">
           <div><h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Date Range</h4><div className="grid grid-cols-2 gap-2"><div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">From</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={tempFilters.dateFrom} onChange={(e) => setTempFilters({...tempFilters, dateFrom: e.target.value})} /></div><div><span className="text-[11px] font-bold text-teal-700 uppercase block mb-1">To</span><input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={tempFilters.dateTo} onChange={(e) => setTempFilters({...tempFilters, dateTo: e.target.value})} /></div></div></div>
           <div><h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Doctor</h4><select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px]" value={tempFilters.doctorId} onChange={(e) => setTempFilters({...tempFilters, doctorId: e.target.value})}><option value="">All Doctors</option>{data.doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
           {/* <div><h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Status</h4><div className="flex flex-wrap gap-2">{['Scheduled', 'Completed', 'Cancelled', 'No-Show'].map(status => { const isSelected = tempFilters.status.includes(status); return (<button key={status} onClick={() => { let newStatus = isSelected ? tempFilters.status.filter(s => s !== status) : [...tempFilters.status, status]; if (['Scheduled', 'Completed', 'Cancelled', 'No-Show'].every(s => newStatus.includes(s))) { newStatus = []; } setTempFilters({...tempFilters, status: newStatus}); }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${isSelected ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{status}</button>); })}</div></div> */}
         </div>
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setRebookingApptId(null); setModalError(''); setInvalidFields([]); setNewAppt({ patientId: '', department: '', doctorId: '', time: '', date: safeCurrentDate }); setNewPatientDetails({ name: '', phone: '', age: '', gender: 'M', address: '' }); }} title={rebookingApptId ? "ReBook Appointment" : "New Appointment"} footer={<button onClick={handleAddAppointment} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Confirm Booking</button>}>
         <div className="space-y-3">
            <AlertMessage message={modalError} />
            <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Patient <span className="text-red-500">*</span></label><select disabled={!!rebookingApptId} className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 outline-none ${invalidFields.includes('patientId') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.patientId} onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})}><option value="">Select Patient</option>{!rebookingApptId && <option value="add_new" className="font-bold text-teal-600">+ Add New Patient</option>}{data.patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            {newAppt.patientId === 'add_new' && (
  <div className="p-3 bg-teal-50 rounded-lg border border-teal-100 space-y-2">
    {/* SPLIT NAME INPUTS */}
    <div className="grid grid-cols-3 gap-2">
      <input 
        type="text" 
        placeholder="First Name *" 
        className={`w-full p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientName') ? 'border-red-500' : 'border-teal-200'}`} 
        value={newPatientDetails.firstName} 
        onChange={(e) => handlePatientNameInput('firstName', e.target.value)} 
      />
      <input 
        type="text" 
        placeholder="Middle" 
        className="w-full p-1.5 border border-teal-200 rounded text-[13px] outline-none" 
        value={newPatientDetails.middleName} 
        onChange={(e) => handlePatientNameInput('middleName', e.target.value)} 
      />
      <input 
        type="text" 
        placeholder="Last Name" 
        className="w-full p-1.5 border border-teal-200 rounded text-[13px] outline-none" 
        value={newPatientDetails.lastName} 
        onChange={(e) => handlePatientNameInput('lastName', e.target.value)} 
      />
    </div>

    {/* RESTRICTED PHONE & AGE */}
    <div className="grid grid-cols-2 gap-2">
      <input 
        type="tel" 
        placeholder="Phone *" 
        className={`w-full p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientPhone') ? 'border-red-500' : 'border-teal-200'}`} 
        value={newPatientDetails.phone} 
        onChange={(e) => handlePatientPhoneInput(e.target.value)} 
      />
      <div className="flex gap-1.5">
        <input 
          type="tel" // usage of tel on age helps mobile keyboards
          placeholder="Age *" 
          className={`w-1/2 p-1.5 border rounded text-[13px] outline-none ${invalidFields.includes('newPatientAge') ? 'border-red-500' : 'border-teal-200'}`} 
          value={newPatientDetails.age} 
          onChange={(e) => handlePatientAgeInput(e.target.value)} 
        />
        <select 
          className="w-1/2 p-1.5 border border-teal-200 rounded text-[13px]" 
          value={newPatientDetails.gender} 
          onChange={(e) => setNewPatientDetails({...newPatientDetails, gender: e.target.value})}
        >
          <option value="M">M</option><option value="F">F</option><option value="O">O</option>
        </select>
      </div>
    </div>
    <input 
      type="text" 
      placeholder="Address *" 
      // 👇 The check here matches the string pushed above
      className={`w-full p-1.5 border rounded text-[13px] outline-none ${
        invalidFields.includes('newPatientAddress') ? 'border-red-500' : 'border-teal-200'
      }`} 
      value={newPatientDetails.address} 
      onChange={(e) => handlePatientAddressInput(e.target.value)} 
    />
  </div>
)}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Department</label>
                    <select className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50" value={newAppt.department} onChange={(e) => setNewAppt({...newAppt, department: e.target.value, doctorId: '', time: ''})}><option value="">All</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Doctor <span className="text-red-500">*</span></label>
                    <select className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 outline-none ${invalidFields.includes('doctorId') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.doctorId} onChange={(e) => { const doc = getDoctorById(e.target.value); setNewAppt({...newAppt, doctorId: e.target.value, department: doc ? doc.department : newAppt.department, time: ''}); }}>
                        <option value="">Select</option>
                        {/* FIX: Filter Doctors - Must be 'Available' AND match department */}
                        {data.doctors
                            .filter(d => (!newAppt.department || d.department === newAppt.department) && d.status === 'Available')
                            .map(d => <option key={d._id} value={d._id}>{d.name}</option>)
                        }
                    </select>
                </div>
            </div>
            <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Select Date <span className="text-red-500">*</span></label><input type="date" min={new Date().toISOString().split('T')[0]} className={`w-full p-2 border rounded-lg text-[13px] bg-slate-50 outline-none ${invalidFields.includes('date') ? 'border-red-500' : 'border-slate-200'}`} value={newAppt.date} onChange={(e) => setNewAppt({...newAppt, date: e.target.value, time: ''})} /></div>
            <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Available Slots <span className="text-red-500">*</span></label>
                <div className={`rounded-lg ${invalidFields.includes('time') ? 'border border-red-500 p-1' : ''}`}>
                    <TimeSlotPicker selectedTime={newAppt.time} onSelect={(t) => setNewAppt({...newAppt, time: t})} doctor={getDoctorById(newAppt.doctorId)} date={newAppt.date} appointments={sections.today.concat(sections.previous, sections.upcoming).filter(a => a.doctorId === newAppt.doctorId && a.date === newAppt.date && a.status !== 'Cancelled')} />
                </div>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isRescheduleModalOpen} onClose={() => { setIsRescheduleModalOpen(false); setActionAppt(null); }} title="Reschedule" footer={<button onClick={confirmReschedule} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium">Update Appointment</button>}>
         <div className="space-y-3">
            {actionAppt && (<div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between mb-2"><span className="text-[11px] font-bold text-slate-500 uppercase">Currently Scheduled:</span><span className="text-[13px] font-bold text-slate-700">{actionAppt.date} at {actionAppt.time}</span></div>)}
            <AlertMessage message={modalError} />
            <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">New Date</label><input type="date" min={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50" value={rescheduleData.date} onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value, time: ''})} /></div><div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Available Slots</label><TimeSlotPicker selectedTime={rescheduleData.time} onSelect={(t) => setRescheduleData({...rescheduleData, time: t})} doctor={getDoctorById(actionAppt?.doctorId)} date={rescheduleData.date} appointments={sections.today.concat(sections.previous, sections.upcoming).filter(a => a.doctorId === actionAppt?.doctorId && a.date === rescheduleData.date && a.status !== 'Cancelled')} /></div>
         </div>
      </Modal>

      <Modal isOpen={isCancelModalOpen} onClose={() => { setIsCancelModalOpen(false); setActionAppt(null); }} title="Cancel Appointment" footer={<div className="flex gap-2"><button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-1.5 text-slate-600 border rounded-lg bg-white">Keep it</button><button onClick={confirmCancel} className="flex-1 bg-red-600 text-white py-1.5 rounded-lg">Yes, Cancel</button></div>}><div className="text-[13px] text-slate-600">Are you sure you want to cancel?</div></Modal>
    </div>
  );
};

export default Appointments;
import React, { useState, useEffect } from 'react';
import { 
  Building2, MessageCircle, FileText, Plus, Edit2, ChevronDown, ChevronRight, UserPlus, Users, CheckCircle, AlertCircle, ShieldCheck, Trash2
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ModuleHeader from '../components/ui/ModuleHeader';
import AlertMessage from '../components/ui/AlertMessage';
import ClinicalLibraryModal from '../components/settings/ClinicalLibraryModal';
import API_BASE_URL from '../config';
import { authFetch, getSessionUser, updateSessionFromAuth } from '../utils/auth';
import { hasPermission } from '../utils/permissions';
import { getLocalDateString } from '../utils/dateUtils';
import {
  APPOINTMENT_WINDOW_OPTIONS,
  DEFAULT_CLINIC_END_TIME,
  DEFAULT_CLINIC_EVENING_END_TIME,
  DEFAULT_CLINIC_EVENING_START_TIME,
  DEFAULT_CLINIC_MORNING_END_TIME,
  DEFAULT_CLINIC_MORNING_START_TIME,
  DEFAULT_CLINIC_START_TIME,
  formatClinicScheduleSummary,
  getClinicSchedule,
  normalizeAppointmentWindow,
  validateClinicSchedule
} from '../utils/schedule';

// Initial Defaults
const DEFAULT_TEMPLATES = [
  { title: 'Appointment Confirmation', text: 'Hello {patient_name}, your appointment with {doctor_name} has been confirmed for {time} on {date}.' },
  { title: 'Appointment Reminder', text: 'Reminder: You have an appointment with {doctor_name} at {time} today.' },
  { title: 'Appointment Cancellation', text: 'Hello {patient_name}, your appointment on {date} has been cancelled.' }
];

const DEFAULT_POLICIES = [
  {
    title: 'Privacy Policy',
    text: 'We collect and use patient information only for registration, appointment management, consultation, billing, and clinic communication. Patient information is handled confidentially and shared only where required for care delivery, operations, or legal compliance.'
  },
  {
    title: 'Consent Policy',
    text: 'By registering with the clinic, the patient consents to the collection and use of their personal and medical information for healthcare services, appointment communication, prescriptions, follow-up reminders, and clinic administration.'
  },
  {
    title: 'Appointment Policy',
    text: 'Appointment timings are subject to doctor availability and clinic operations. Patients are requested to arrive on time and inform the clinic in advance for cancellation or rescheduling.'
  }
];

const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeBillingServiceRows = (services = []) => (
  Array.isArray(services)
    ? services.map((service) => ({
        _id: service?._id,
        name: String(service?.name || ''),
        price: service?.price === 0 || service?.price ? String(service.price) : '',
        active: service?.active !== false
      }))
    : []
);

const preventInvalidMoneyKey = (event) => {
  if (['-', '+', 'e', 'E'].includes(event.key)) {
    event.preventDefault();
  }
};

const getNonNegativeMoneyInput = (value, fallback = '') => {
  if (value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? value : fallback;
};

const Settings = ({ data, setData, onLogout }) => {
  const todayStr = getLocalDateString();
  const [expandedSection, setExpandedSection] = useState('clinic');
  const [searchQuery, setSearchQuery] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeData, setUpgradeData] = useState({
    clinicName: '',
    clinicalEstablishmentNo: '',
    ceIssueDate: '',
    registeringAuthority: ''
  });
  const [accessUsers, setAccessUsers] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [clinicalLibraryType, setClinicalLibraryType] = useState('');
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);
  const [transferConfirmUser, setTransferConfirmUser] = useState(null);
  const [statusRemark, setStatusRemark] = useState('');
  const [transferRemark, setTransferRemark] = useState('');
  const [permissionProfiles, setPermissionProfiles] = useState({
    clinic_admin: {},
    doctor: {}
  });
  const [savedPermissionProfiles, setSavedPermissionProfiles] = useState({
    clinic_admin: {},
    doctor: {}
  });
  const [activePermissionRole, setActivePermissionRole] = useState('clinic_admin');
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notificationStack, setNotificationStack] = useState(() => {
    try {
      const saved = localStorage.getItem('settings_notifications');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [accessData, setAccessData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const savedUser = getSessionUser();
  const canManageAccess = hasPermission(savedUser.permissions, 'settings.users_access');
  const canManageRolePermissions = hasPermission(savedUser.permissions, 'settings.permissions');
  const canManageClinicSettings = hasPermission(savedUser.permissions, 'settings.clinic');
  const canManageCatalog = hasPermission(savedUser.permissions, 'settings.catalog');
  const canManageCommunication = hasPermission(savedUser.permissions, 'settings.communication');
  const canManagePolicies = hasPermission(savedUser.permissions, 'settings.policies');
  const canConfigureVitalsWorkflow = savedUser.accountRole === 'super_admin' && data.clinic?.type === 'Clinic';

  useEffect(() => {
    localStorage.setItem('settings_notifications', JSON.stringify(notificationStack.slice(0, 30)));
  }, [notificationStack]);

  const showNotification = (shortMessage, type = 'success', detailedMessage = null) => {
    setNotification({ message: shortMessage, type });
    window.setTimeout(() => setNotification(null), 3000);

    const newNotif = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: detailedMessage || shortMessage,
      type,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    setNotificationStack(prev => [newNotif, ...(Array.isArray(prev) ? prev : [])].slice(0, 30));
  };

  const handleClearNotifications = () => setNotificationStack([]);
  const handleDismissNotification = (id) => setNotificationStack(prev => prev.filter(n => n.id !== id));

  useEffect(() => {
    const clinic = data.clinic || {};
    const clinicId = clinic._id || localStorage.getItem('clinicId');
    if (!clinicId || clinic.type !== 'Clinic' || clinic.clinicRegistrationStatus !== 'Approved') return;

    const approvedMarker = clinic.clinicRegistrationApprovedAt || clinic.upgradedFromSoloAt || 'approved';
    const seenKey = `clinic_upgrade_approved_seen_${clinicId}`;
    if (localStorage.getItem(seenKey) === String(approvedMarker)) return;

    showNotification('Clinic Approved', 'success', 'Your clinic registration is approved. Clinic-level features are now unlocked.');
    localStorage.setItem(seenKey, String(approvedMarker));
  }, [data.clinic]);

  // --- 1. FETCH & SYNC DATA ---
  useEffect(() => {
    const fetchClinicSettings = async () => {
      const clinicId = localStorage.getItem('clinicId');
      if (!clinicId) return;

      try {
        const [response, catalogResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clinics/${clinicId}`),
          fetch(`${API_BASE_URL}/api/clinical-catalog/${clinicId}`)
        ]);

        const [clinicData, catalogData] = await Promise.all([
          response.ok ? response.json() : Promise.resolve(null),
          catalogResponse.ok ? catalogResponse.json() : Promise.resolve(null)
        ]);

        if (clinicData) {
          const mergedData = {
             ...clinicData,
             consultationFee: Number(clinicData.consultationFee || 0),
             billingServices: Array.isArray(clinicData.billingServices) ? clinicData.billingServices : [],
             templates: (clinicData.templates && clinicData.templates.length > 0) ? clinicData.templates : DEFAULT_TEMPLATES,
             policies: (clinicData.policies && clinicData.policies.length > 0) ? clinicData.policies : DEFAULT_POLICIES
          };
          setData(prev => ({ ...prev, clinic: mergedData }));
        }

        if (catalogData) {
          setData(prev => ({ ...prev, clinicalCatalog: catalogData }));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    fetchClinicSettings();
  }, [setData]);

  useEffect(() => {
    if (!canManageAccess && !canManageRolePermissions) return;

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    const fetchAccessContext = async () => {
      try {
        setAccessLoading(true);
        const requests = [
          canManageAccess
            ? authFetch(`${API_BASE_URL}/api/users?clinicId=${clinicId}`)
            : Promise.resolve({ ok: false }),
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}`),
          canManageRolePermissions
            ? authFetch(`${API_BASE_URL}/api/clinics/${clinicId}/permissions`)
            : Promise.resolve({ ok: false })
        ];
        const [usersRes, doctorsRes, permissionsRes] = await Promise.all(requests);

        if (usersRes.ok) {
          setAccessUsers(await usersRes.json());
        }

        if (doctorsRes.ok) {
          const doctors = await doctorsRes.json();
          setData(prev => ({ ...prev, doctors }));
        }

        if (permissionsRes.ok) {
          const permissionsPayload = await permissionsRes.json();
          const nextPermissionProfiles = permissionsPayload.permissionProfiles || { clinic_admin: {}, doctor: {} };
          setPermissionProfiles(nextPermissionProfiles);
          setSavedPermissionProfiles(nextPermissionProfiles);
        }
      } catch (err) {
        console.error('Failed to load access settings', err);
      } finally {
        setAccessLoading(false);
      }
    };

    fetchAccessContext();
  }, [canManageAccess, canManageRolePermissions, savedUser._id, setData]);

  const openEdit = (config) => {
    setModalError('');
    setInvalidFields([]);
    setEditModal(config);
    setFormData(config.initialData || {});
  };

  const openUpgradeModal = () => {
    const pendingDetails = data.clinic?.clinicRegistrationDetails || {};
    setModalError('');
    setInvalidFields([]);
    setUpgradeData({
      clinicName: pendingDetails.clinicName || data.clinic?.name || '',
      clinicalEstablishmentNo: pendingDetails.clinicalEstablishmentNo || data.clinic?.clinicalEstablishmentNo || '',
      ceIssueDate: pendingDetails.ceIssueDate || data.clinic?.ceIssueDate || '',
      registeringAuthority: pendingDetails.registeringAuthority || data.clinic?.registeringAuthority || ''
    });
    setUpgradeModalOpen(true);
  };

  const openAccessModal = () => {
    setModalError('');
    setInvalidFields([]);
    setAccessData({ name: '', email: '', phone: '' });
    setAccessModalOpen(true);
  };

  // --- 2. SAVE HANDLER ---
  const handleSaveSetting = async () => {
    setModalError('');
    let errors = [];

    if (editModal.type === 'clinic_details') {
      if (!formData.name) errors.push('name');
      if (!formData.address) errors.push('address');
    } else if (editModal.type === 'single_input') {
      if (!formData.value) errors.push('value');
    } else if (editModal.type === 'clinic_schedule') {
      if (formData.open24Hours !== true) {
        if (!formData.morningStart) errors.push('morningStart');
        if (!formData.morningEnd) errors.push('morningEnd');
        if ((formData.eveningStart && !formData.eveningEnd) || (!formData.eveningStart && formData.eveningEnd)) {
          errors.push('eveningStart', 'eveningEnd');
        }
      }
      if (!formData.appointmentWindowMinutes) errors.push('appointmentWindowMinutes');
    } else if (editModal.type === 'billing_services') {
      const consultationFeeRaw = String(formData.consultationFee ?? '').trim();
      const numericConsultationFee = Number(consultationFeeRaw);
      if (!consultationFeeRaw || !Number.isFinite(numericConsultationFee) || numericConsultationFee < 0) errors.push('consultationFee');

      const seenServiceNames = new Map();
      (formData.billingServices || []).forEach((service, index) => {
        const name = String(service?.name || '').trim();
        const priceRaw = String(service?.price ?? '').trim();
        if (!name && !priceRaw) return;
        const numericPrice = Number(priceRaw);
        if (!name) errors.push(`billingService-${index}-name`);
        if (!priceRaw || !Number.isFinite(numericPrice) || numericPrice < 0) errors.push(`billingService-${index}-price`);
        const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');
        if (normalizedName) {
          if (seenServiceNames.has(normalizedName)) {
            errors.push('billingServicesDuplicateName', `billingService-${seenServiceNames.get(normalizedName)}-name`, `billingService-${index}-name`);
          } else {
            seenServiceNames.set(normalizedName, index);
          }
        }
      });
    } else if (editModal.type === 'template' || editModal.type === 'policy') {
      if (!formData.title) errors.push('title');
      if (!formData.text) errors.push('text');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (editModal.type === 'billing_services') {
        if (errors.includes('consultationFee')) {
          return setModalError('Consultation fee must be entered as a valid non-negative amount.');
        }
        if (errors.some((field) => field.endsWith('-name'))) {
          if (errors.includes('billingServicesDuplicateName')) {
            return setModalError('Service names must be unique.');
          }
          return setModalError('Service name is required when service price is entered.');
        }
        if (errors.some((field) => field.endsWith('-price'))) {
          return setModalError('Service price must be entered as a valid non-negative amount.');
        }
      }
      return setModalError('Please fill all required details marked with *');
    }

    if (editModal.type === 'clinic_schedule') {
      const scheduleError = validateClinicSchedule({
        open24Hours: formData.open24Hours === true,
        morningStart: formData.morningStart,
        morningEnd: formData.morningEnd,
        eveningStart: formData.eveningStart,
        eveningEnd: formData.eveningEnd,
        appointmentWindowMinutes: formData.appointmentWindowMinutes
      });

      if (scheduleError) {
        let scheduleErrorFields = ['appointmentWindowMinutes'];
        const scheduleErrorText = scheduleError.toLowerCase();
        if (scheduleErrorText.includes('evening shift must be later than the morning shift')) {
          scheduleErrorFields = ['morningStart', 'eveningStart'];
        } else if (scheduleErrorText.includes('evening shift cannot overlap')) {
          scheduleErrorFields = ['morningEnd', 'eveningStart'];
        } else if (scheduleErrorText.includes('morning start')) {
          scheduleErrorFields = ['morningStart'];
        } else if (scheduleErrorText.includes('morning shift end')) {
          scheduleErrorFields = ['morningEnd'];
        } else if (scheduleErrorText.includes('morning end')) {
          scheduleErrorFields = ['morningEnd'];
        } else if (scheduleErrorText.includes('morning shift')) {
          scheduleErrorFields = ['morningStart', 'morningEnd'];
        } else if (scheduleErrorText.includes('evening shift must include both')) {
          scheduleErrorFields = ['eveningStart', 'eveningEnd'];
        } else if (scheduleErrorText.includes('evening shift end')) {
          scheduleErrorFields = ['eveningEnd'];
        } else if (scheduleErrorText.includes('evening shift')) {
          scheduleErrorFields = ['eveningStart', 'eveningEnd'];
        } else if (scheduleErrorText.includes('appointment window')) {
          scheduleErrorFields = ['appointmentWindowMinutes'];
        }
        setInvalidFields(scheduleErrorFields);
        return setModalError(scheduleError);
      }
    }

    setInvalidFields([]);

    const clinicId = localStorage.getItem('clinicId');
    let updatePayload = {};

    if (editModal.type === 'template') {
      const currentList = [...(data.clinic.templates || [])];
      const newItem = { title: formData.title, text: formData.text };
      if (editModal.index !== undefined) {
        currentList[editModal.index] = newItem;
      } else {
        currentList.push(newItem);
      }
      updatePayload = { templates: currentList };
    } else if (editModal.type === 'policy') {
      const currentList = [...(data.clinic.policies || [])];
      const newItem = { title: formData.title, text: formData.text };
      if (editModal.index !== undefined) {
        currentList[editModal.index] = newItem;
      } else {
        currentList.push(newItem);
      }
      updatePayload = { policies: currentList };
    } else if (editModal.type === 'clinic_details') {
      updatePayload = { name: formData.name, address: formData.address };
    } else if (editModal.type === 'clinic_schedule') {
      const isOpen24Hours = formData.open24Hours === true;
      updatePayload = {
        open24Hours: isOpen24Hours,
        morningStart: isOpen24Hours ? '' : formData.morningStart,
        morningEnd: isOpen24Hours ? '' : formData.morningEnd,
        eveningStart: isOpen24Hours ? '' : (formData.eveningStart || ''),
        eveningEnd: isOpen24Hours ? '' : (formData.eveningEnd || ''),
        appointmentWindowMinutes: normalizeAppointmentWindow(formData.appointmentWindowMinutes)
      };
    } else if (editModal.type === 'consultation_workflow') {
      updatePayload = {
        preConsultVitalsEnabled: formData.preConsultVitalsEnabled === true
      };
    } else if (editModal.type === 'billing_services') {
      updatePayload = {
        consultationFee: Number(formData.consultationFee),
        billingServices: (formData.billingServices || [])
          .map((service) => {
            const name = String(service.name || '').trim();
            const priceRaw = String(service.price ?? '').trim();
            if (!name && !priceRaw) return null;
            return {
              _id: service._id,
              name,
              price: Number(priceRaw),
              active: service.active !== false
            };
          })
          .filter(Boolean)
      };
    } else if (editModal.stateKey === 'hours') {
      updatePayload = { hours: formData.value };
    }

    if (Object.keys(updatePayload).length > 0) {
      try {
        setLoading(true);
        const isWorkflowPreference = editModal.type === 'consultation_workflow';
        const request = isWorkflowPreference ? authFetch : fetch;
        const endpoint = isWorkflowPreference
          ? `${API_BASE_URL}/api/clinics/${clinicId}/workflow-preferences`
          : `${API_BASE_URL}/api/clinics/${clinicId}`;
        const response = await request(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (response.ok) {
          const updatedClinic = await response.json();
          setData(prev => ({ ...prev, clinic: updatedClinic }));
          setEditModal(null);
          showNotification('Settings Saved', 'success', `${editModal.title || 'Settings'} updated successfully.`);
        } else {
          const result = await response.json().catch(() => ({}));
          setModalError(result.error || "Failed to save changes.");
        }
      } catch (err) {
        setModalError("Server connection error.");
      } finally {
        setLoading(false);
      }
    } else {
      setEditModal(null);
    }
  };

  const handleUpgradeToClinic = async () => {
    setModalError('');
    const errors = [];
    const clinicName = upgradeData.clinicName.trim();
    const clinicalEstablishmentNo = upgradeData.clinicalEstablishmentNo.trim();
    const registeringAuthority = upgradeData.registeringAuthority.trim();

    if (!clinicName) errors.push('clinicName');
    if (!clinicalEstablishmentNo) errors.push('clinicalEstablishmentNo');
    if (!upgradeData.ceIssueDate) errors.push('ceIssueDate');
    if (upgradeData.ceIssueDate && upgradeData.ceIssueDate > todayStr) errors.push('ceIssueDate');
    if (!registeringAuthority) errors.push('registeringAuthority');

    if (errors.length > 0) {
      setInvalidFields(errors);
      if (errors.includes('ceIssueDate') && upgradeData.ceIssueDate && upgradeData.ceIssueDate > todayStr) {
        return setModalError('Date of issue cannot be a future date.');
      }
      return setModalError('Please fill all required details correctly *');
    }

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return setModalError('Clinic ID missing.');

    try {
      setLoading(true);
      const payload = {
        clinicId,
        clinicName,
        clinicalEstablishmentNo,
        ceIssueDate: upgradeData.ceIssueDate,
        registeringAuthority
      };

      const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}/upgrade-to-clinic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setData(prev => ({ ...prev, clinic: result.clinic }));
        setUpgradeModalOpen(false);
        setInvalidFields([]);
        showNotification('Registration Submitted', 'success', 'Clinic registration details submitted for operations review.');
      } else {
        setModalError(result.error || 'Failed to submit clinic registration.');
      }
    } catch (err) {
      setModalError('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccessUser = async () => {
    setModalError('');
    const errors = [];
    const name = accessData.name.trim();
    const email = accessData.email.trim().toLowerCase();
    const phone = accessData.phone.trim();

    if (!name) errors.push('name');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
    if (!phone || phone.length !== 10) errors.push('phone');

    if (errors.length > 0) {
      setInvalidFields(errors);
      return setModalError('Please fill all required details correctly *');
    }

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return setModalError('Clinic ID missing.');

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          name,
          email,
          phone,
          role: 'clinic_admin'
        })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setAccessUsers(prev => [...prev, result]);
        setAccessModalOpen(false);
        setInvalidFields([]);
        showNotification('Admin Added', 'success', `Activation link sent to ${email}.`);
      } else {
        setModalError(result.error || 'Failed to create user.');
      }
    } catch (err) {
      setModalError('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const openStatusConfirm = (user) => {
    setModalError('');
    setStatusRemark('');
    setStatusConfirmUser(user);
  };

  const closeStatusConfirm = () => {
    setStatusConfirmUser(null);
    setStatusRemark('');
    setModalError('');
  };

  const handleToggleAccessUser = async (user = statusConfirmUser) => {
    if (!user) return;
    setModalError('');
    const clinicId = localStorage.getItem('clinicId');
    const nextStatus = user.status === 'Inactive' ? 'Active' : 'Inactive';
    const expectedStatus = user.status === 'Inactive' && user.activationPending ? 'Pending' : nextStatus;

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/api/users/${user._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, status: nextStatus, activationPending: Boolean(user.activationPending), remark: statusRemark.trim() })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setAccessUsers(prev => prev.map(item => item._id === result._id ? result : item));
        setStatusConfirmUser(null);
        setStatusRemark('');
        showNotification(
          expectedStatus === 'Pending' ? 'User Reactivated' : expectedStatus === 'Active' ? 'User Reactivated' : 'User Deactivated',
          'success',
          `${user.name || 'User'} has been marked as ${expectedStatus}.`
        );
      } else {
        showNotification('Action Failed', 'error', result.error || 'Failed to update user status.');
      }
    } catch (err) {
      showNotification('Connection Error', 'error', 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAccessUser = async (user) => {
    setModalError('');
    const clinicId = localStorage.getItem('clinicId');

    try {
      const response = await authFetch(`${API_BASE_URL}/api/users/${user._id}/reset-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        showNotification(
          user.status === 'Pending' ? 'Activation Link Sent' : 'Reset Link Sent',
          'success',
          result.message || (user.status === 'Pending' ? 'Activation link sent successfully.' : 'Password reset link sent successfully.')
        );
      } else {
        showNotification('Action Failed', 'error', result.error || 'Failed to send password reset link.');
      }
    } catch (err) {
      showNotification('Connection Error', 'error', 'Server connection error.');
    }
  };

  const toggleRolePermission = (roleKey, permissionKey) => {
    setPermissionProfiles(prev => ({
      ...prev,
      [roleKey]: {
        ...(prev?.[roleKey] || {}),
        [permissionKey]: !prev?.[roleKey]?.[permissionKey]
      }
    }));
  };

  const handleSavePermissionProfile = async (roleKey) => {
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return showNotification('Action Failed', 'error', 'Clinic ID missing.');
    const nextPermissionProfiles = {
      ...savedPermissionProfiles,
      [roleKey]: permissionProfiles?.[roleKey] || {}
    };

    try {
      setPermissionsLoading(true);
      const response = await authFetch(`${API_BASE_URL}/api/clinics/${clinicId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionProfiles: nextPermissionProfiles })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        const persistedProfiles = result.permissionProfiles || nextPermissionProfiles;
        setSavedPermissionProfiles(persistedProfiles);
        setPermissionProfiles(prev => ({
          ...prev,
          [roleKey]: persistedProfiles[roleKey] || prev[roleKey]
        }));
        const nextSessionUser = {
          ...savedUser,
          permissionProfiles: persistedProfiles
        };
        localStorage.setItem('user', JSON.stringify(nextSessionUser));
        showNotification('Permissions Updated', 'success', `${roleLabels[roleKey]} permissions saved successfully.`);
      } else {
        showNotification('Action Failed', 'error', result.error || 'Failed to update role permissions.');
      }
    } catch (err) {
      showNotification('Connection Error', 'error', 'Server connection error.');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const openTransferConfirm = (user) => {
    setModalError('');
    setTransferRemark('');
    setTransferConfirmUser(user);
  };

  const closeTransferConfirm = () => {
    setTransferConfirmUser(null);
    setTransferRemark('');
    setModalError('');
  };

  const handleTransferOwnership = async () => {
    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId || !transferConfirmUser?._id) return;

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/api/users/${transferConfirmUser._id}/transfer-super-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, reason: transferRemark.trim() })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        if (result.actorSession) {
          updateSessionFromAuth(result.actorSession);
        }
        showNotification('Ownership Transferred', 'success', `${transferConfirmUser.name} is now the clinic owner.`);
        closeTransferConfirm();
        window.setTimeout(() => window.location.reload(), 700);
      } else {
        showNotification('Action Failed', 'error', result.error || 'Failed to transfer ownership.');
      }
    } catch (err) {
      showNotification('Connection Error', 'error', 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER HELPERS ---
  const SettingItem = ({ title, subtitle, onEdit }) => {
    const isClinicDetails = title === 'Clinic Details';

    return (
      <div
        onClick={onEdit}
        // Compact Padding: p-2.5 to match standard cards
        className="flex justify-between items-center p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-teal-300 transition-colors cursor-pointer group"
      >
        <div className="min-w-0 pr-2">
          <h4 className="type-card-title text-slate-800 truncate group-hover:text-teal-700 transition-colors">{title}</h4>
          {isClinicDetails && (
            <p className="type-label text-teal-700 truncate mt-0.5">{workspaceTypeLabel} ({workspaceStatusLabel})</p>
          )}
          {subtitle && <p className="type-label text-slate-600 truncate mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-shrink-0 text-slate-400 group-hover:text-teal-600 bg-slate-50 group-hover:bg-teal-50 p-1.5 rounded-md transition-colors"
        >
          <Edit2 size={14} />
        </button>
      </div>
    );
  };

  const renderAccordion = (sectionOrId, legacyTitle, legacyIcon, legacyColorClass, legacyChildren) => {
    const isSectionObject = typeof sectionOrId === 'object' && sectionOrId !== null && 'id' in sectionOrId;
    const matchedSection = isSectionObject
      ? sectionOrId
      : visibleSections.find(section => section.id === sectionOrId) || sections.find(section => section.id === sectionOrId);
    if (isSearchMode && !matchedSection) {
      return null;
    }

    const id = isSectionObject ? sectionOrId.id : sectionOrId;
    const title = isSectionObject ? sectionOrId.title : legacyTitle;
    const icon = isSectionObject ? sectionOrId.icon : legacyIcon;
    const colorClass = isSectionObject ? sectionOrId.colorClass : legacyColorClass;
    const visibleItems = matchedSection?.visibleItems || [];
    const isExpanded = isSearchMode ? true : expandedSection === id;
    const Icon = typeof icon === 'function' ? icon : null;
    return (
      <div className={`flex flex-col border-b border-slate-100 ${isSearchMode ? 'flex-none' : isExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
        <button 
          onClick={() => {
            if (!isSearchMode) {
              setExpandedSection(isExpanded ? null : id);
            }
          }}
          // MATCHING APPOINTMENTS STYLE:
          // px-3 py-2.5 (was px-4 py-3)
          className={`flex-none flex items-center justify-between px-3 py-2.5 bg-white transition-colors z-10 shadow-sm ${isSearchMode ? 'cursor-default' : 'hover:bg-slate-50'} ${isExpanded ? 'border-b border-slate-100' : 'border-transparent'}`}
        >
          {/* gap-1.5 (was gap-2) */}
          <div className={`flex items-center gap-1.5 ${colorClass}`}>
            {/* Icon size 14 (was 16) */}
            {Icon ? <Icon size={14} /> : null}
            {/* Compact title sizing */}
            <h3 className="type-section-title">{title}</h3>
            {isSearchMode && <span className="type-label text-red-500 ml-1">(Filtered)</span>}
            {isSearchMode && <span className="type-label text-slate-400">({visibleItems.length})</span>}
          </div>
          {/* Arrow size 14 (was 16) */}
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>
        {isExpanded && (
          // MATCHING CONTENT STYLE:
          // p-2 space-y-1.5 (was p-3 space-y-2)
          <div className={`${isSearchMode ? '' : 'flex-1 overflow-y-auto scrollbar-hide'} bg-slate-50/50 p-2 space-y-1.5 animate-fadeIn`}>
            {isSearchMode
              ? visibleItems.map(item => (
                  <React.Fragment key={item.key}>
                    {item.render()}
                  </React.Fragment>
                ))
              : legacyChildren}
          </div>
        )}
      </div>
    );
  };

  const clinicTemplates = data.clinic?.templates || [];
  const clinicPolicies = data.clinic?.policies || [];
  const clinicalCatalog = data.clinicalCatalog || { complaints: [], drugs: [], labTests: [] };
  const loggedInDoctorId = savedUser.doctorId || localStorage.getItem('doctorId');
  const canUpgradeSolo = data.clinic?.type === 'Solo' || (!data.clinic?.type && Boolean(loggedInDoctorId));
  const clinicSchedule = getClinicSchedule(data.clinic || {});
  const clinicRegistrationStatus = data.clinic?.clinicRegistrationStatus || (data.clinic?.type === 'Clinic' ? 'Approved' : 'Not Submitted');
  const clinicRegistrationRemark = String(data.clinic?.clinicRegistrationReviewRemark || '').trim();
  const workspaceTypeLabel = data.clinic?.type === 'Clinic' ? 'Clinic Workspace' : 'Solo Practice';
  const workspaceStatusLabel = data.clinic?.type === 'Clinic'
    ? 'Clinic-level features unlocked'
    : clinicRegistrationStatus === 'Under Review'
      ? 'Registration Under Review'
      : clinicRegistrationStatus === 'Correction Required'
        ? 'Correction Required'
        : 'Registration Not Submitted';
  const registrationActionSubtitle = clinicRegistrationStatus === 'Under Review'
    ? 'Submitted for operations review. You can edit and resubmit if details need correction.'
    : clinicRegistrationStatus === 'Correction Required'
      ? (clinicRegistrationRemark ? `Correction required: ${clinicRegistrationRemark}` : 'Correction required. Update details and resubmit for review.')
      : 'Add official establishment details and submit them for operations review.';
  const registrationSubmitLabel = clinicRegistrationStatus === 'Under Review' || clinicRegistrationStatus === 'Correction Required'
    ? 'Resubmit for Review'
    : 'Submit for Review';
  const roleLabels = {
    super_admin: 'Super Admin',
    clinic_admin: 'Clinic Admin',
    doctor: 'Clinic Doctor'
  };
  const permissionGroups = [
    {
      title: 'Operations',
      items: [
        { key: 'appointments.view_all', label: 'View full appointment book' },
        { key: 'appointments.manage', label: 'Create and manage appointments' },
        { key: 'appointments.consult_own', label: 'Consult own appointment queue' },
        { key: 'patients.view_all', label: 'View full patient list' },
        { key: 'patients.view_own', label: 'View own patients only' },
        { key: 'patients.create_edit', label: 'Create and edit patients' },
        { key: 'doctors.view', label: 'View doctors module' },
        { key: 'doctors.manage', label: 'Create and manage doctors' }
      ]
    },
    {
      title: 'Settings',
      items: [
        { key: 'settings.clinic', label: 'Manage clinic details and schedule' },
        { key: 'settings.catalog', label: 'Manage clinical catalog' },
        { key: 'settings.communication', label: 'Manage WhatsApp templates' },
        { key: 'settings.policies', label: 'Manage policies' },
        { key: 'settings.users_access', label: 'Manage users and access' },
        { key: 'settings.permissions', label: 'Configure role permissions' }
      ]
    }
  ];
  const searchTerm = normalizeSearchText(searchQuery);
  const isSearchMode = searchTerm.length > 0;
  const matchesSearch = (...values) => values.some(value => normalizeSearchText(value).includes(searchTerm));

  const renderPrimaryButton = ({ onClick, icon: Icon, label, className }) => (
    <button
      onClick={onClick}
      className={className}
    >
      {typeof Icon === 'function' ? <Icon size={14} /> : null}
      {label}
    </button>
  );

  const renderUserAccessCard = (user) => {
    const isProtectedOwner = user.role === 'super_admin';
    return (
      <div key={user._id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="type-card-title text-slate-800 truncate">{user.name}</h4>
            <span className={`type-utility px-1.5 py-0.5 rounded-full ${
              user.status === 'Inactive'
                ? 'bg-slate-100 text-slate-600'
                : user.status === 'Pending'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-teal-50 text-teal-700'
            }`}>
              {user.status || 'Active'}
            </span>
          </div>
          <p className="type-label text-slate-600 truncate mt-0.5">{user.email} • {user.phone}</p>
          <p className="type-label text-slate-400 truncate mt-0.5">
            {roleLabels[user.role] || user.role}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {!isProtectedOwner && user.status === 'Active' && (
            <button
              type="button"
              onClick={() => openTransferConfirm(user)}
              className="type-label px-2.5 py-1.5 rounded-md transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              Transfer Ownership
            </button>
          )}
          <button
            type="button"
            disabled={user.status === 'Inactive'}
            onClick={() => handleResetAccessUser(user)}
            className={`type-label px-2.5 py-1.5 rounded-md transition-colors ${user.status === 'Inactive' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            {user.status === 'Pending' ? 'Resend Activation' : 'Reset Password'}
          </button>
          <button
            type="button"
            disabled={isProtectedOwner}
            onClick={() => openStatusConfirm(user)}
            className={`type-label px-2.5 py-1.5 rounded-md transition-colors ${
              isProtectedOwner
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : user.status === 'Inactive'
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            {isProtectedOwner ? 'Owner' : user.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}
          </button>
        </div>
      </div>
    );
  };

  const renderRolePermissionCard = (roleKey) => {
    return (
      <div className="px-3 pb-3 pt-2 bg-white border border-t-0 border-slate-200 rounded-b-xl shadow-sm space-y-3">
        {permissionGroups.map(group => (
          <div key={`${roleKey}-${group.title}`} className="space-y-2">
            <p className="type-utility uppercase text-slate-400">{group.title}</p>
            {group.items.map(item => (
              <label key={`${roleKey}-${item.key}`} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="type-secondary text-slate-700">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(permissionProfiles?.[roleKey]?.[item.key])}
                  onChange={() => toggleRolePermission(roleKey, item.key)}
                  className="accent-teal-600"
                />
              </label>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => handleSavePermissionProfile(roleKey)}
          disabled={permissionsLoading}
          className="type-secondary w-full py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-70"
        >
          {permissionsLoading ? 'Saving...' : `Save ${roleLabels[roleKey]} Permissions`}
        </button>
      </div>
    );
  };

  const renderRolePermissionTabs = () => {
    const roleKeys = ['clinic_admin', 'doctor'];
    const searchedRole = isSearchMode
      ? roleKeys.find(roleKey => matchesSearch(roleLabels[roleKey]))
      : null;
    const visibleRole = searchedRole || activePermissionRole;

    return (
      <div>
        <div className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-white px-1 pt-1 rounded-t-xl border-x border-t" role="tablist" aria-label="Role permission profiles">
          {roleKeys.map(roleKey => {
            const isActive = visibleRole === roleKey;
            return (
              <button
                key={roleKey}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActivePermissionRole(roleKey)}
                className={`type-secondary relative px-2 py-2.5 rounded-t-lg transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-800 font-semibold after:absolute after:left-3 after:right-3 after:-bottom-px after:h-0.5 after:bg-amber-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {roleLabels[roleKey]}
              </button>
            );
          })}
        </div>
        {renderRolePermissionCard(visibleRole)}
      </div>
    );
  };

  const getSectionItems = () => {
    const clinicItems = [];

    if (canManageClinicSettings) {
      clinicItems.push(
        {
          key: 'clinic-code',
          searchText: `clinic code join sign in secure code ${data.clinic?.clinicCode || ''}`,
          render: () => (
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <p className="type-label text-slate-600 uppercase">Clinic Code</p>
              <p className="type-page-title tracking-[0.18em] text-teal-600 mt-1">
                {data.clinic?.clinicCode ? `${data.clinic.clinicCode.slice(0, 4)}-${data.clinic.clinicCode.slice(4)}` : 'Not Available'}
              </p>
              <p className="type-secondary text-slate-400 mt-1">Share this code with your team for secure sign-in.</p>
            </div>
          )
        },
        {
          key: 'clinic-details',
          searchText: `clinic details clinic name address ${data.clinic?.name || ''} ${data.clinic?.address || ''}`,
          render: () => (
            <SettingItem
              title="Clinic Details"
              subtitle={(data.clinic?.name || 'My Clinic') + " • " + (data.clinic?.address || 'Set address...')}
              onEdit={() => openEdit({ title: 'Edit Clinic Details', type: 'clinic_details', initialData: { name: data.clinic?.name, address: data.clinic?.address } })}
            />
          )
        },
        {
          key: 'clinic-schedule',
          searchText: `clinic schedule timings hours appointment window working hours ${formatClinicScheduleSummary(data.clinic || clinicSchedule)}`,
          render: () => (
            <SettingItem
              title="Clinic Schedule"
              subtitle={formatClinicScheduleSummary(data.clinic || clinicSchedule)}
              onEdit={() => openEdit({
                title: 'Edit Clinic Schedule',
                type: 'clinic_schedule',
                initialData: {
                  open24Hours: clinicSchedule.open24Hours === true,
                  morningStart: clinicSchedule.morningStart,
                  morningEnd: clinicSchedule.morningEnd,
                  eveningStart: clinicSchedule.eveningStart,
                  eveningEnd: clinicSchedule.eveningEnd,
                  appointmentWindowMinutes: clinicSchedule.appointmentWindowMinutes
                }
              })}
            />
          )
        },
        {
          key: 'billing-services',
          searchText: `billing services consultation fee pricing ecg blood sugar diabetic check ${data.clinic?.consultationFee || 0} ${(data.clinic?.billingServices || []).map(service => `${service.name} ${service.price}`).join(' ')}`,
          render: () => (
            <SettingItem
              title="Billing & Services"
              subtitle={`Consultation Rs ${Number(data.clinic?.consultationFee || 0).toFixed(2)} • ${(data.clinic?.billingServices || []).filter(service => service.active !== false).length} services configured`}
              onEdit={() => openEdit({
                title: 'Billing & Services',
                type: 'billing_services',
                initialData: {
                  consultationFee: String(Number(data.clinic?.consultationFee || 0)),
                  billingServices: normalizeBillingServiceRows(data.clinic?.billingServices || [])
                }
              })}
            />
          )
        }
      );

      if (canConfigureVitalsWorkflow) {
        clinicItems.push({
          key: 'consultation-workflow',
          searchText: 'consultation workflow vitals required before consultation triage',
          render: () => (
            <SettingItem
              title="Consultation Workflow"
              subtitle={data.clinic?.preConsultVitalsEnabled
                ? 'Vitals capture enabled before consultation.'
                : 'Vitals can be captured during consultation.'}
              onEdit={() => openEdit({
                title: 'Consultation Workflow',
                type: 'consultation_workflow',
                initialData: {
                  preConsultVitalsEnabled: data.clinic?.preConsultVitalsEnabled === true
                }
              })}
            />
          )
        });
      }

      if (canUpgradeSolo) {
        clinicItems.push({
          key: 'upgrade-clinic',
          searchText: `register clinic upgrade establishment review ${clinicRegistrationStatus} ${clinicRegistrationRemark}`,
          render: () => (
            <SettingItem
              title="Register Your Clinic"
              subtitle={registrationActionSubtitle}
              onEdit={openUpgradeModal}
            />
          )
        });
      }
    }

    const catalogItems = canManageCatalog ? [
      {
        key: 'catalog-complaints',
        searchText: `chief complaints clinical catalog symptoms ${(clinicalCatalog.complaints || []).length} items`,
        render: () => <SettingItem title="Chief Complaints" subtitle={`${(clinicalCatalog.complaints || []).length} items`} onEdit={() => setClinicalLibraryType('complaint')} />
      },
      {
        key: 'catalog-drugs',
        searchText: `drug master medicines prescriptions catalog ${(clinicalCatalog.drugs || []).length} items`,
        render: () => <SettingItem title="Drug Master" subtitle={`${(clinicalCatalog.drugs || []).length} items`} onEdit={() => setClinicalLibraryType('drug')} />
      },
      {
        key: 'catalog-lab-tests',
        searchText: `lab tests diagnostics catalog ${(clinicalCatalog.labTests || []).length} items`,
        render: () => <SettingItem title="Lab Tests" subtitle={`${(clinicalCatalog.labTests || []).length} items`} onEdit={() => setClinicalLibraryType('lab_test')} />
      }
    ] : [];

    const accessItems = canManageAccess
      ? [
          ...(accessLoading
            ? [{
                key: 'access-loading',
                searchText: 'users access loading',
                render: () => <div className="type-secondary p-4 text-center text-slate-400">Loading users...</div>
              }]
            : accessUsers.length === 0
              ? [{
                  key: 'access-empty',
                  searchText: 'users access no users found',
                  render: () => <div className="type-secondary p-4 text-center text-slate-400">No users found</div>
                }]
              : accessUsers.map(user => ({
                  key: `access-user-${user._id}`,
                  searchText: `${user.name} ${user.email} ${user.phone} ${user.status} ${roleLabels[user.role] || user.role} users access transfer ownership reset password resend activation reactivate deactivate`,
                  render: () => renderUserAccessCard(user)
                }))),
          {
            key: 'access-add-admin',
            searchText: 'add admin invite clinic admin users access create user',
            render: () => renderPrimaryButton({
              onClick: openAccessModal,
              icon: UserPlus,
              label: 'Add Admin',
              className: 'type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100'
            })
          }
        ]
      : [];

    const permissionItems = canManageRolePermissions
      ? [
          {
            key: 'permissions-info',
            searchText: 'delegate daily operations ownership permissions role controls clinic admins doctors manage workspace',
            render: () => (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="type-secondary text-amber-800">Delegate tasks! Use these settings to control exactly what admins and doctors can view and edit.</p>
              </div>
            )
          },
          {
            key: 'permissions-editor',
            searchText: `save role permissions clinic admin doctor access ${permissionGroups.map(group => `${group.title} ${group.items.map(item => item.label).join(' ')}`).join(' ')}`,
            render: renderRolePermissionTabs
          }
        ]
      : [];

    const whatsappItems = canManageCommunication
      ? [
          ...clinicTemplates.map((tpl, idx) => ({
            key: `template-${idx}`,
            searchText: `${tpl.title} ${tpl.text} whatsapp template communication message`,
            render: () => (
              <SettingItem
                title={tpl.title}
                subtitle={tpl.text}
                onEdit={() => openEdit({ title: 'Edit Template', type: 'template', index: idx, initialData: { title: tpl.title, text: tpl.text } })}
              />
            )
          })),
          {
            key: 'template-add',
            searchText: 'add new template whatsapp settings communication',
            render: () => renderPrimaryButton({
              onClick: () => openEdit({ title: 'Add New Template', type: 'template', initialData: { title: '', text: '' } }),
              icon: Plus,
              label: 'Add Template',
              className: 'type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100'
            })
          }
        ]
      : [];

    const policyItems = canManagePolicies
      ? [
          ...clinicPolicies.map((pol, idx) => ({
            key: `policy-${idx}`,
            searchText: `${pol.title} ${pol.text} policy settings`,
            render: () => (
              <SettingItem
                title={pol.title}
                subtitle={pol.text}
                onEdit={() => openEdit({ title: 'Edit Policy', type: 'policy', index: idx, initialData: { title: pol.title, text: pol.text } })}
              />
            )
          })),
          {
            key: 'policy-add',
            searchText: 'add new policy clinic policy settings',
            render: () => renderPrimaryButton({
              onClick: () => openEdit({ title: 'Add New Policy', type: 'policy', initialData: { title: '', text: '' } }),
              icon: Plus,
              label: 'Add Policy',
              className: 'type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100'
            })
          }
        ]
      : [];

    return [
      { id: 'clinic', title: 'Clinic Settings', icon: Building2, colorClass: 'text-blue-600', items: clinicItems },
      { id: 'clinical-library', title: 'Clinical Catalog', icon: FileText, colorClass: 'text-teal-600', items: catalogItems },
      { id: 'access', title: 'Users & Access', icon: Users, colorClass: 'text-indigo-600', items: accessItems },
      { id: 'permissions', title: 'Role Permissions', icon: ShieldCheck, colorClass: 'text-amber-600', items: permissionItems },
      { id: 'whatsapp', title: 'Whatsapp Settings', icon: MessageCircle, colorClass: 'text-green-600', items: whatsappItems },
      { id: 'policy', title: 'Policy Settings', icon: FileText, colorClass: 'text-purple-600', items: policyItems }
    ].filter(section => section.items.length > 0);
  };

  const sections = getSectionItems();
  const visibleSections = sections
    .map(section => {
      const showAllItems = isSearchMode && matchesSearch(section.title, section.id);
      const visibleItems = showAllItems
        ? section.items
        : section.items.filter(item => !isSearchMode || matchesSearch(item.searchText, section.title));
      return visibleItems.length > 0 ? { ...section, visibleItems } : null;
    })
    .filter(Boolean);
  const hasVisibleSearchResults = visibleSections.length > 0;

  const getCatalogIdentity = (item = {}) => {
    const label = String(item.label || '').trim().toLowerCase();
    const group = String(item.group || item.category || '').trim().toLowerCase();
    return `${label}::${group}`;
  };

  const handleClinicalCatalogUpdate = (itemType, updatedItem) => {
    const typeMap = {
      complaint: 'complaints',
      drug: 'drugs',
      lab_test: 'labTests'
    };
    const targetKey = typeMap[itemType];
    if (!targetKey) return;

    setData(prev => ({
      ...prev,
      clinicalCatalog: {
        ...(prev.clinicalCatalog || {}),
        [targetKey]: (() => {
          const currentItems = prev.clinicalCatalog?.[targetKey] || [];
          const updatedIdentity = getCatalogIdentity(updatedItem);
          const matchesUpdatedItem = (item) => (
            (updatedItem?._id && item._id === updatedItem._id) ||
            (updatedItem?.seedKey && item.seedKey === updatedItem.seedKey) ||
            (updatedItem?.normalizedLabel && updatedItem?.group && item.normalizedLabel === updatedItem.normalizedLabel && String(item.group || item.category || '').trim().toLowerCase() === String(updatedItem.group || updatedItem.category || '').trim().toLowerCase()) ||
            (updatedIdentity !== '::' && getCatalogIdentity(item) === updatedIdentity)
          );

          if (updatedItem?.active === false) {
            return currentItems.filter(item => !matchesUpdatedItem(item));
          }

          if (currentItems.some(matchesUpdatedItem)) {
            return currentItems.map(item => (matchesUpdatedItem(item) ? updatedItem : item));
          }

          return [...currentItems, updatedItem];
        })()
      }
    }));
  };

  const handleClinicalCatalogGroupUpdate = (itemType, updatedGroup) => {
    const typeMap = {
      complaint: 'complaints',
      drug: 'drugs',
      lab_test: 'labTests'
    };
    const targetKey = typeMap[itemType];
    if (!targetKey) return;

    setData(prev => {
      const catalogGroups = prev.clinicalCatalog?.catalogGroups || {};
      const currentGroups = catalogGroups[targetKey] || [];
      const groupName = String(updatedGroup.group || updatedGroup.category || '').trim().toLowerCase();
      const matchesGroup = (group) => (
        (updatedGroup?._id && group._id === updatedGroup._id) ||
        (groupName && String(group.group || group.category || '').trim().toLowerCase() === groupName)
      );

      const nextGroups = updatedGroup?.active === false
        ? currentGroups.filter(group => !matchesGroup(group))
        : currentGroups.some(matchesGroup)
          ? currentGroups.map(group => (matchesGroup(group) ? updatedGroup : group))
          : [...currentGroups, updatedGroup];

      return {
        ...prev,
        clinicalCatalog: {
          ...(prev.clinicalCatalog || {}),
          catalogGroups: {
            ...catalogGroups,
            [targetKey]: nextGroups
          }
        }
      };
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="type-body">{notification.message}</span>
        </div>
      )}

      <ModuleHeader
        title="Settings"
        searchVal={searchQuery}
        onSearch={setSearchQuery}
        notifications={notificationStack}
        onClearAll={handleClearNotifications}
        onDismiss={handleDismissNotification}
        onLogout={onLogout}
      />
      
      {/* Container Padding: p-2 gap-2 to match other pages */}
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2 max-w-3xl mx-auto w-full">
        <div className={`flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm ${isSearchMode ? 'overflow-y-auto scrollbar-hide' : 'overflow-hidden'}`}>
          {isSearchMode && !hasVisibleSearchResults && (
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50 border-b border-slate-100">
              <div className="text-center">
                <p className="type-section-title text-slate-700">No matching settings</p>
                <p className="type-secondary text-slate-400 mt-1">Try searching by clinic code, ownership, schedule, passwords, or policies.</p>
              </div>
            </div>
          )}
          
          {/* 1. CLINIC */}
          {canManageClinicSettings && renderAccordion('clinic', 'Clinic Settings', Building2, 'text-blue-600', 
            <>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                <p className="type-label text-slate-600 uppercase">Clinic Code</p>
                <p className="type-page-title tracking-[0.18em] text-teal-600 mt-1">
                  {data.clinic?.clinicCode ? `${data.clinic.clinicCode.slice(0, 4)}-${data.clinic.clinicCode.slice(4)}` : 'Not Available'}
                </p>
                <p className="type-secondary text-slate-400 mt-1">Share this code with your team for secure sign-in.</p>
              </div>
              <SettingItem 
                title="Clinic Details" 
                subtitle={(data.clinic?.name || 'My Clinic') + " • " + (data.clinic?.address || 'Set address...')} 
                onEdit={() => openEdit({ title: 'Edit Clinic Details', type: 'clinic_details', initialData: { name: data.clinic?.name, address: data.clinic?.address } })}
              />
              <SettingItem 
                title="Clinic Schedule" 
                subtitle={formatClinicScheduleSummary(data.clinic || clinicSchedule)} 
                onEdit={() => openEdit({
                  title: 'Edit Clinic Schedule',
                  type: 'clinic_schedule',
                  initialData: {
                    open24Hours: clinicSchedule.open24Hours === true,
                    morningStart: clinicSchedule.morningStart,
                    morningEnd: clinicSchedule.morningEnd,
                    eveningStart: clinicSchedule.eveningStart,
                    eveningEnd: clinicSchedule.eveningEnd,
                    appointmentWindowMinutes: clinicSchedule.appointmentWindowMinutes
                  }
                })}
              />
              <SettingItem
                title="Billing & Services"
                subtitle={`Consultation Rs ${Number(data.clinic?.consultationFee || 0).toFixed(2)} - ${(data.clinic?.billingServices || []).filter(service => service.active !== false).length} services configured`}
                onEdit={() => openEdit({
                  title: 'Billing & Services',
                  type: 'billing_services',
                  initialData: {
                    consultationFee: String(Number(data.clinic?.consultationFee || 0)),
                    billingServices: normalizeBillingServiceRows(data.clinic?.billingServices || [])
                  }
                })}
              />
              {canConfigureVitalsWorkflow && (
                <SettingItem
                  title="Consultation Workflow"
                  subtitle={data.clinic?.preConsultVitalsEnabled
                    ? 'Vitals capture enabled before consultation.'
                    : 'Vitals can be captured during consultation.'}
                  onEdit={() => openEdit({
                    title: 'Consultation Workflow',
                    type: 'consultation_workflow',
                    initialData: {
                      preConsultVitalsEnabled: data.clinic?.preConsultVitalsEnabled === true
                    }
                  })}
                />
              )}
              {canUpgradeSolo && (
                <SettingItem
                  title="Register Your Clinic"
                  subtitle={registrationActionSubtitle}
                  onEdit={openUpgradeModal}
                />
              )}
            </>
          )}

          {canManageCatalog && renderAccordion('clinical-library', 'Clinical Catalog', FileText, 'text-teal-600',
            <>
              <SettingItem
                title="Chief Complaints"
                subtitle={`${(clinicalCatalog.complaints || []).length} items`}
                onEdit={() => setClinicalLibraryType('complaint')}
              />
              <SettingItem
                title="Drug Master"
                subtitle={`${(clinicalCatalog.drugs || []).length} items`}
                onEdit={() => setClinicalLibraryType('drug')}
              />
              <SettingItem
                title="Lab Tests"
                subtitle={`${(clinicalCatalog.labTests || []).length} items`}
                onEdit={() => setClinicalLibraryType('lab_test')}
              />
            </>
          )}

          {canManageAccess && renderAccordion('access', 'Users & Access', Users, 'text-indigo-600',
            <>
              {accessLoading ? (
                <div className="type-secondary p-4 text-center text-slate-400">Loading users...</div>
              ) : accessUsers.length === 0 ? (
                <div className="type-secondary p-4 text-center text-slate-400">No users found</div>
              ) : (
                accessUsers.map(user => {
                  const isProtectedOwner = user.role === 'super_admin';
                  return (
                    <div key={user._id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="type-card-title text-slate-800 truncate">{user.name}</h4>
                          <span className={`type-utility px-1.5 py-0.5 rounded-full ${
                            user.status === 'Inactive'
                              ? 'bg-slate-100 text-slate-600'
                              : user.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-teal-50 text-teal-700'
                          }`}>
                            {user.status || 'Active'}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-600 truncate mt-0.5">{user.email} • {user.phone}</p>
                        <p className="text-[12px] text-slate-400 truncate mt-0.5">
                          {roleLabels[user.role] || user.role}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {!isProtectedOwner && user.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => openTransferConfirm(user)}
                            className="type-label px-2.5 py-1.5 rounded-md transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100"
                          >
                            Transfer Ownership
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={user.status === 'Inactive'}
                          onClick={() => handleResetAccessUser(user)}
                          className={`type-label px-2.5 py-1.5 rounded-md transition-colors ${user.status === 'Inactive' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          {user.status === 'Pending' ? 'Resend Activation' : 'Reset Password'}
                        </button>
                        <button
                          type="button"
                          disabled={isProtectedOwner}
                          onClick={() => openStatusConfirm(user)}
                          className={`type-label px-2.5 py-1.5 rounded-md transition-colors ${
                            isProtectedOwner
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : user.status === 'Inactive'
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {isProtectedOwner ? 'Owner' : user.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              <button
                onClick={openAccessModal}
                className="type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <UserPlus size={14} /> Add Admin
              </button>
            </>
          )}

          {canManageRolePermissions && renderAccordion('permissions', 'Role Permissions', ShieldCheck, 'text-amber-600',
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="type-secondary text-amber-800">Delegate tasks! Use these settings to control exactly what admins and doctors can view and edit.</p>
              </div>
              {renderRolePermissionTabs()}
            </div>
          )}
          
          {/* 2. WHATSAPP SETTINGS (Renamed) */}
          {canManageCommunication && renderAccordion('whatsapp', 'Whatsapp Settings', MessageCircle, 'text-green-600',
            <>
              {clinicTemplates.map((tpl, idx) => (
                <SettingItem 
                  key={idx}
                  title={tpl.title} 
                  subtitle={tpl.text} 
                  onEdit={() => openEdit({ title: 'Edit Template', type: 'template', index: idx, initialData: { title: tpl.title, text: tpl.text } })}
                />
              ))}

              <button 
                onClick={() => openEdit({ title: 'Add New Template', type: 'template', initialData: { title: '', text: '' } })}
                className="type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <Plus size={14} /> Add Template
              </button>
            </>
          )}

          {/* 3. POLICIES */}
          {canManagePolicies && renderAccordion('policy', 'Policy Settings', FileText, 'text-purple-600',
            <>
              {clinicPolicies.map((pol, idx) => (
                <SettingItem 
                  key={idx}
                  title={pol.title} 
                  subtitle={pol.text} 
                  onEdit={() => openEdit({ title: 'Edit Policy', type: 'policy', index: idx, initialData: { title: pol.title, text: pol.text } })}
                />
              ))}

              <button 
                onClick={() => openEdit({ title: 'Add New Policy', type: 'policy', initialData: { title: '', text: '' } })}
                className="type-secondary w-full mt-1.5 py-2 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <Plus size={14} /> Add Policy
              </button>
            </>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      <Modal
        isOpen={!!editModal}
        onClose={() => { setEditModal(null); setModalError(''); setInvalidFields([]); }}
        title={editModal?.title}
        bodyClassName={editModal?.type === 'billing_services' ? 'p-4 flex-1 min-h-0 overflow-hidden overscroll-contain' : undefined}
        footer={
          <button onClick={handleSaveSetting} disabled={loading} className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Saving...' : 'Save Changes'}
          </button>
        }
      >
        <div className={editModal?.type === 'billing_services' ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-3'}>
           <AlertMessage message={modalError} />
           
           {editModal?.type === 'clinic_details' && (
             <>
               <div><label className="type-label block text-slate-600 mb-1 uppercase">Clinic Name *</label><input type="text" className="type-body w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
               <div><label className="type-label block text-slate-600 mb-1 uppercase">Address *</label><textarea className="type-body w-full p-2 border border-slate-200 rounded-lg h-20 outline-none focus:ring-1 focus:ring-teal-500" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
             </>
           )}

           {editModal?.type === 'single_input' && (
             <div><label className="type-label block text-slate-600 mb-1 uppercase">{editModal.inputLabel} *</label><input type="text" className="type-body w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-500" value={formData.value || ''} onChange={e => setFormData({...formData, value: e.target.value})} /></div>
           )}

           {editModal?.type === 'clinic_schedule' && (
             <>
               <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                 <p className="type-utility uppercase text-teal-700">Scheduling Rule</p>
                 <p className="type-secondary text-teal-900">Doctor working hours and appointment slots will follow this clinic schedule.</p>
               </div>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={formData.open24Hours === true}
                   onChange={e => setFormData({
                     ...formData,
                     open24Hours: e.target.checked,
                     morningStart: e.target.checked ? '' : DEFAULT_CLINIC_MORNING_START_TIME,
                     morningEnd: e.target.checked ? '' : DEFAULT_CLINIC_MORNING_END_TIME,
                     eveningStart: e.target.checked ? '' : DEFAULT_CLINIC_EVENING_START_TIME,
                     eveningEnd: e.target.checked ? '' : DEFAULT_CLINIC_EVENING_END_TIME
                   })}
                   className="h-4 w-4 accent-teal-600"
                 />
                 <span className="type-section-title text-teal-700">Open 24 Hours</span>
               </label>
               <div>
                 <h4 className="type-utility uppercase text-slate-700 mb-1 border-b border-slate-100 pb-1">Morning Shift</h4>
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="type-label block text-slate-600 mb-1 uppercase">Start Time *</label>
                     <input type="time" disabled={formData.open24Hours === true} className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('morningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={formData.open24Hours === true ? '' : (formData.morningStart || '')} onChange={e => setFormData({...formData, morningStart: e.target.value})} />
                   </div>
                   <div>
                     <label className="type-label block text-slate-600 mb-1 uppercase">End Time *</label>
                     <input type="time" disabled={formData.open24Hours === true} className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('morningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={formData.open24Hours === true ? '' : (formData.morningEnd || '')} onChange={e => setFormData({...formData, morningEnd: e.target.value})} />
                   </div>
                 </div>
               </div>
               <div>
                 <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-1">
                   <h4 className="type-utility uppercase text-slate-700">Evening Shift</h4>
                   <button
                     type="button"
                     disabled={formData.open24Hours === true}
                     onClick={() => setFormData(prev => ({ ...prev, eveningStart: '', eveningEnd: '' }))}
                     className="type-utility uppercase text-slate-400 transition-colors hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                     Clear
                   </button>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="type-label block text-slate-600 mb-1 uppercase">Start Time</label>
                     <input type="time" disabled={formData.open24Hours === true} className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('eveningStart') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={formData.open24Hours === true ? '' : (formData.eveningStart || '')} onChange={e => setFormData({...formData, eveningStart: e.target.value})} />
                   </div>
                   <div>
                     <label className="type-label block text-slate-600 mb-1 uppercase">End Time</label>
                     <input type="time" disabled={formData.open24Hours === true} className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalidFields.includes('eveningEnd') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={formData.open24Hours === true ? '' : (formData.eveningEnd || '')} onChange={e => setFormData({...formData, eveningEnd: e.target.value})} />
                   </div>
                 </div>
                 <p className="type-label mt-1 text-slate-400">Optional. Leave this blank if the clinic follows a single continuous shift.</p>
               </div>
               <div>
                 <label className="type-label block text-slate-600 mb-1 uppercase">Appointment Window *</label>
                 <select className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('appointmentWindowMinutes') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={formData.appointmentWindowMinutes || clinicSchedule.appointmentWindowMinutes} onChange={e => setFormData({...formData, appointmentWindowMinutes: Number(e.target.value)})}>
                   {APPOINTMENT_WINDOW_OPTIONS.map((minutes) => (
                     <option key={minutes} value={minutes}>{minutes} minutes</option>
                   ))}
                 </select>
               </div>
             </>
           )}

           {editModal?.type === 'consultation_workflow' && (
             <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer">
               <input
                 type="checkbox"
                 checked={formData.preConsultVitalsEnabled === true}
                 onChange={e => setFormData({ ...formData, preConsultVitalsEnabled: e.target.checked })}
                 className="mt-0.5 h-4 w-4 accent-teal-600"
               />
               <div>
                 <p className="type-section-title text-slate-800">Vitals Required before Consultation</p>
                 <p className="type-secondary text-slate-600 mt-1">Adds pre-consult vitals capture to the appointment workflow. Consultation is not blocked.</p>
               </div>
             </label>
           )}

           {editModal?.type === 'billing_services' && (
             <>
               <div>
                 <label className="type-label block text-slate-600 mb-1 uppercase">Consultation Fee *</label>
                 <input
                   type="number"
                   min="0"
                   step="0.01"
                   className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('consultationFee') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                   value={formData.consultationFee || ''}
                   onKeyDown={preventInvalidMoneyKey}
                   onPaste={e => {
                     const pastedValue = e.clipboardData.getData('text');
                     if (Number(pastedValue) < 0 || pastedValue.includes('-')) e.preventDefault();
                   }}
                   onChange={e => setFormData({ ...formData, consultationFee: getNonNegativeMoneyInput(e.target.value, formData.consultationFee || '') })}
                 />
               </div>

               <div className="flex min-h-0 flex-1 flex-col gap-2">
                 <div className="flex items-center justify-between">
                   <label className="type-label text-slate-600 uppercase">Available Services</label>
                   <button
                     type="button"
                     onClick={() => setFormData({
                       ...formData,
                       billingServices: [{ name: '', price: '', active: true }, ...(formData.billingServices || [])]
                     })}
                     className="type-label text-teal-600 bg-teal-50 border border-teal-100 px-2 py-1 rounded-lg flex items-center gap-1"
                   >
                     <Plus size={12} /> Add Service
                   </button>
                 </div>

                 <div className="min-h-0 max-h-[min(18rem,38vh)] flex-1 space-y-2 overflow-y-auto pr-1">
                   {(formData.billingServices || []).length === 0 && (
                     <div className="type-secondary text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                       No services configured yet.
                     </div>
                   )}

                   {(formData.billingServices || []).map((service, index) => (
                     <div key={service._id || `service-${index}`} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center border border-slate-200 bg-slate-50 rounded-lg p-2">
                       <input
                         type="text"
                         placeholder="Service name"
                         className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes(`billingService-${index}-name`) ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                         value={service.name || ''}
                         onChange={e => {
                           const nextServices = [...(formData.billingServices || [])];
                           nextServices[index] = { ...nextServices[index], name: e.target.value };
                           setFormData({ ...formData, billingServices: nextServices });
                         }}
                       />
                       <input
                         type="number"
                         min="0"
                         step="0.01"
                         placeholder="Price"
                         className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes(`billingService-${index}-price`) ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
                         value={service.price || ''}
                         onKeyDown={preventInvalidMoneyKey}
                         onPaste={e => {
                           const pastedValue = e.clipboardData.getData('text');
                           if (Number(pastedValue) < 0 || pastedValue.includes('-')) e.preventDefault();
                         }}
                         onChange={e => {
                           const nextServices = [...(formData.billingServices || [])];
                           nextServices[index] = {
                             ...nextServices[index],
                             price: getNonNegativeMoneyInput(e.target.value, nextServices[index]?.price || '')
                           };
                           setFormData({ ...formData, billingServices: nextServices });
                         }}
                       />
                       <button
                         type="button"
                         onClick={() => setFormData({
                           ...formData,
                           billingServices: (formData.billingServices || []).filter((_, serviceIndex) => serviceIndex !== index)
                         })}
                         className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
                         aria-label="Delete service"
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
             </>
           )}

           {(editModal?.type === 'template' || editModal?.type === 'policy') && (
             <>
               <div><label className="type-label block text-slate-600 mb-1 uppercase">Title *</label><input type="text" className="type-body w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
               <div>
                  <label className="type-label block text-slate-600 mb-1 uppercase">Content *</label>
                  <textarea className="type-body w-full p-2 border border-slate-200 rounded-lg h-32 outline-none focus:ring-1 focus:ring-teal-500 resize-none" value={formData.text || ''} onChange={e => setFormData({...formData, text: e.target.value})} />
                  {editModal.type === 'template' && <p className="type-label text-slate-400 mt-1">Variables: {'{patient_name}, {doctor_name}, {time}, {date}'}</p>}
               </div>
             </>
           )}
        </div>
      </Modal>

      <Modal isOpen={upgradeModalOpen} onClose={() => { setUpgradeModalOpen(false); setModalError(''); setInvalidFields([]); }} title="Register Your Clinic" footer={
          <button onClick={handleUpgradeToClinic} disabled={loading} className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Submitting...' : registrationSubmitLabel}
          </button>
        }>
        <div className="space-y-2">
          <div className="rounded-lg border border-teal-100 bg-teal-50 px-2 py-2">
            <p className="type-secondary text-teal-900">Congratulations on expanding your practice! Add your official establishment details to unlock clinic-level features.</p>
          </div>
          {clinicRegistrationStatus === 'Correction Required' && clinicRegistrationRemark ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-2">
              <p className="type-secondary text-amber-800">{clinicRegistrationRemark}</p>
            </div>
          ) : null}
          <AlertMessage message={modalError} />

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Clinic Name <span className="text-red-500">*</span></label>
            <input type="text" placeholder="CareOPD Medical Center" className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('clinicName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.clinicName} onChange={e => setUpgradeData({...upgradeData, clinicName: e.target.value})} />
          </div>

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Clinical Establishment (CE) Number <span className="text-red-500">*</span></label>
            <input type="text" placeholder="CE registration number" className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('clinicalEstablishmentNo') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.clinicalEstablishmentNo} onChange={e => setUpgradeData({...upgradeData, clinicalEstablishmentNo: e.target.value})} />
          </div>

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Registering State Authority <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g. Delhi Health Authority" className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('registeringAuthority') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.registeringAuthority} onChange={e => setUpgradeData({...upgradeData, registeringAuthority: e.target.value})} />
          </div>

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Date of Issue <span className="text-red-500">*</span></label>
            <input type="date" max={todayStr} className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('ceIssueDate') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.ceIssueDate} onChange={e => setUpgradeData({...upgradeData, ceIssueDate: e.target.value})} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={accessModalOpen} onClose={() => { setAccessModalOpen(false); setModalError(''); setInvalidFields([]); }} title="Add Clinic Admin" footer={
          <button onClick={handleCreateAccessUser} disabled={loading} className="type-section-title w-full bg-teal-600 text-white py-1.5 rounded-lg disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Creating...' : 'Create Admin'}
          </button>
        }>
        <div className="space-y-3">
          <AlertMessage message={modalError} />

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Full name"
              className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('name') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.name}
              onChange={e => setAccessData({ ...accessData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Email ID <span className="text-red-500">*</span></label>
            <input
              type="email"
              placeholder="user@clinic.com"
              className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('email') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.email}
              onChange={e => setAccessData({ ...accessData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Mobile Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              maxLength={10}
              placeholder="10-digit number"
              className={`type-body w-full p-2 border rounded-lg outline-none focus:ring-1 ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.phone}
              onChange={e => setAccessData({ ...accessData, phone: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!transferConfirmUser}
        onClose={closeTransferConfirm}
        title="Transfer Clinic Ownership"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeTransferConfirm}
              disabled={loading}
              className="type-section-title w-full bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg disabled:opacity-70 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransferOwnership}
              disabled={loading}
              className="type-section-title w-full bg-amber-600 text-white py-1.5 rounded-lg disabled:opacity-70 hover:bg-amber-700 transition-colors"
            >
              {loading ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="type-body text-amber-900">{transferConfirmUser?.name}</p>
            <p className="type-label text-amber-800 mt-0.5">{transferConfirmUser?.email}</p>
            <p className="type-label text-amber-700 mt-1">{roleLabels[transferConfirmUser?.role] || transferConfirmUser?.role}</p>
          </div>
          <p className="type-body text-slate-600 leading-relaxed">
            This will make the selected user the new clinic owner and super admin. Your account will fall back to {savedUser.doctorId ? 'Doctor' : 'Clinic Admin'} access.
          </p>
          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Reason</label>
            <textarea
              value={transferRemark}
              onChange={e => setTransferRemark(e.target.value)}
              placeholder="Optional note for audit history"
              className="type-body w-full p-2 border border-slate-200 rounded-lg h-24 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              disabled={loading}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!statusConfirmUser}
        onClose={closeStatusConfirm}
        title={statusConfirmUser?.status === 'Inactive' ? 'Reactivate User' : 'Deactivate User'}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeStatusConfirm}
              disabled={loading}
              className="type-section-title w-full bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg disabled:opacity-70 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleToggleAccessUser()}
              disabled={loading}
              className={`type-section-title w-full text-white py-1.5 rounded-lg disabled:opacity-70 transition-colors ${
                statusConfirmUser?.status === 'Inactive'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Updating...' : statusConfirmUser?.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertMessage message={modalError} />
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="type-body text-slate-800">{statusConfirmUser?.name}</p>
            <p className="type-label text-slate-600 mt-0.5">{statusConfirmUser?.email}</p>
          </div>
          <p className="type-body text-slate-600 leading-relaxed">
            {statusConfirmUser?.status === 'Inactive'
              ? statusConfirmUser?.activationPending
                ? 'This will restore the invite. The user will remain Pending until they open the activation link and set a password.'
                : 'This will restore access for the selected user.'
              : 'This will immediately block the selected user from signing in.'}
          </p>
          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">Remark</label>
            <textarea
              value={statusRemark}
              onChange={e => setStatusRemark(e.target.value)}
              placeholder="Optional reason or internal note"
              className="type-body w-full p-2 border border-slate-200 rounded-lg h-24 outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              disabled={loading}
            />
          </div>
        </div>
      </Modal>

      <ClinicalLibraryModal
        clinicId={localStorage.getItem('clinicId')}
        isOpen={clinicalLibraryType === 'complaint'}
        onClose={() => setClinicalLibraryType('')}
        title="Chief Complaints"
        itemType="complaint"
        items={clinicalCatalog.complaints || []}
        groups={clinicalCatalog.catalogGroups?.complaints || []}
        onCatalogUpdate={handleClinicalCatalogUpdate}
        onCatalogGroupUpdate={handleClinicalCatalogGroupUpdate}
      />

      <ClinicalLibraryModal
        clinicId={localStorage.getItem('clinicId')}
        isOpen={clinicalLibraryType === 'drug'}
        onClose={() => setClinicalLibraryType('')}
        title="Drug Master"
        itemType="drug"
        items={clinicalCatalog.drugs || []}
        groups={clinicalCatalog.catalogGroups?.drugs || []}
        onCatalogUpdate={handleClinicalCatalogUpdate}
        onCatalogGroupUpdate={handleClinicalCatalogGroupUpdate}
      />

      <ClinicalLibraryModal
        clinicId={localStorage.getItem('clinicId')}
        isOpen={clinicalLibraryType === 'lab_test'}
        onClose={() => setClinicalLibraryType('')}
        title="Lab Tests"
        itemType="lab_test"
        items={clinicalCatalog.labTests || []}
        groups={clinicalCatalog.catalogGroups?.labTests || []}
        onCatalogUpdate={handleClinicalCatalogUpdate}
        onCatalogGroupUpdate={handleClinicalCatalogGroupUpdate}
      />

    </div>
  );
};
export default Settings;

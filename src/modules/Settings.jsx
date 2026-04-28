import React, { useState, useEffect } from 'react';
import { 
  Building2, MessageCircle, FileText, Plus, Edit2, ChevronDown, ChevronRight, UserPlus, Users, CheckCircle, AlertCircle
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ModuleHeader from '../components/ui/ModuleHeader';
import AlertMessage from '../components/ui/AlertMessage';
import API_BASE_URL from '../config';

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

const Settings = ({ data, setData, onLogout }) => {
  const [expandedSection, setExpandedSection] = useState('clinic');
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
    registeringAuthority: '',
    createAdmin: false,
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: ''
  });
  const [accessUsers, setAccessUsers] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);
  const [statusRemark, setStatusRemark] = useState('');
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

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (err) {
      return {};
    }
  })();
  const canManageAccess = savedUser.accountRole === 'super_admin';

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

  // --- 1. FETCH & SYNC DATA ---
  useEffect(() => {
    const fetchClinicSettings = async () => {
      const clinicId = localStorage.getItem('clinicId');
      if (!clinicId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}`);
        if (response.ok) {
          const clinicData = await response.json();
          const mergedData = {
             ...clinicData,
             templates: (clinicData.templates && clinicData.templates.length > 0) ? clinicData.templates : DEFAULT_TEMPLATES,
             policies: (clinicData.policies && clinicData.policies.length > 0) ? clinicData.policies : DEFAULT_POLICIES
          };
          setData(prev => ({ ...prev, clinic: mergedData }));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    fetchClinicSettings();
  }, [setData]);

  useEffect(() => {
    if (!canManageAccess) return;

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return;

    const fetchAccessContext = async () => {
      try {
        setAccessLoading(true);
        const [usersRes, doctorsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users?clinicId=${clinicId}&actorId=${savedUser._id}`),
          fetch(`${API_BASE_URL}/api/doctors/${clinicId}`)
        ]);

        if (usersRes.ok) {
          setAccessUsers(await usersRes.json());
        }

        if (doctorsRes.ok) {
          const doctors = await doctorsRes.json();
          setData(prev => ({ ...prev, doctors }));
        }
      } catch (err) {
        console.error('Failed to load access settings', err);
      } finally {
        setAccessLoading(false);
      }
    };

    fetchAccessContext();
  }, [canManageAccess, savedUser._id, setData]);

  const openEdit = (config) => {
    setModalError('');
    setInvalidFields([]);
    setEditModal(config);
    setFormData(config.initialData || {});
  };

  const openUpgradeModal = () => {
    setModalError('');
    setInvalidFields([]);
    setUpgradeData({
      clinicName: '',
      clinicalEstablishmentNo: '',
      ceIssueDate: '',
      registeringAuthority: '',
      createAdmin: false,
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: ''
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
    } else if (editModal.type === 'template' || editModal.type === 'policy') {
      if (!formData.title) errors.push('title');
      if (!formData.text) errors.push('text');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      return setModalError('Please fill all required details marked with *');
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
    } else if (editModal.stateKey === 'hours') {
      updatePayload = { hours: formData.value };
    }

    if (Object.keys(updatePayload).length > 0) {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}`, {
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
          setModalError("Failed to save changes.");
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
    const adminName = upgradeData.adminName.trim();
    const adminEmail = upgradeData.adminEmail.trim().toLowerCase();

    if (!clinicName) errors.push('clinicName');
    if (!clinicalEstablishmentNo) errors.push('clinicalEstablishmentNo');
    if (!upgradeData.ceIssueDate) errors.push('ceIssueDate');
    if (!registeringAuthority) errors.push('registeringAuthority');

    if (upgradeData.createAdmin) {
      if (!adminName) errors.push('adminName');
      if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) errors.push('adminEmail');
      if (!upgradeData.adminPhone || upgradeData.adminPhone.length < 10) errors.push('adminPhone');
      if (!upgradeData.adminPassword || upgradeData.adminPassword.length < 6) errors.push('adminPassword');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
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

      if (upgradeData.createAdmin) {
        payload.adminName = adminName;
        payload.adminEmail = adminEmail;
        payload.adminPhone = upgradeData.adminPhone;
        payload.adminPassword = upgradeData.adminPassword;
      }

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
        showNotification('Practice Upgraded', 'success', 'Solo doctor setup has been upgraded to a clinic workspace.');
      } else {
        setModalError(result.error || 'Failed to upgrade practice.');
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
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          actorId: savedUser._id,
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
      const response = await fetch(`${API_BASE_URL}/api/users/${user._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, actorId: savedUser._id, status: nextStatus, activationPending: Boolean(user.activationPending), remark: statusRemark.trim() })
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
      const response = await fetch(`${API_BASE_URL}/api/users/${user._id}/reset-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, actorId: savedUser._id })
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

  // --- RENDER HELPERS ---
  const SettingItem = ({ title, subtitle, onEdit }) => (
    <div 
      onClick={onEdit}
      // Compact Padding: p-2.5 to match standard cards
      className="flex justify-between items-center p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-teal-300 transition-colors cursor-pointer group"
    >
      <div className="min-w-0 pr-2">
        <h4 className="text-[13px] font-bold text-slate-800 truncate group-hover:text-teal-700 transition-colors">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="flex-shrink-0 text-slate-400 group-hover:text-teal-600 bg-slate-50 group-hover:bg-teal-50 p-1.5 rounded-md transition-colors"
      >
        <Edit2 size={14} />
      </button>
    </div>
  );

  const renderAccordion = (id, title, icon, colorClass, children) => {
    const isExpanded = expandedSection === id;
    const Icon = icon;
    return (
      <div className={`flex flex-col border-b border-slate-100 ${isExpanded ? 'flex-1 min-h-0' : 'flex-none'}`}>
        <button 
          onClick={() => setExpandedSection(isExpanded ? null : id)}
          // MATCHING APPOINTMENTS STYLE:
          // px-3 py-2.5 (was px-4 py-3)
          className={`flex-none flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 transition-colors z-10 shadow-sm ${isExpanded ? 'border-b border-slate-100' : 'border-transparent'}`}
        >
          {/* gap-1.5 (was gap-2) */}
          <div className={`flex items-center gap-1.5 ${colorClass}`}>
            {/* Icon size 14 (was 16) */}
            <Icon size={14} />
            {/* Text 11px (was 12px) */}
            <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
          </div>
          {/* Arrow size 14 (was 16) */}
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>
        {isExpanded && (
          // MATCHING CONTENT STYLE:
          // p-2 space-y-1.5 (was p-3 space-y-2)
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2 space-y-1.5 scrollbar-hide animate-fadeIn">
            {children}
          </div>
        )}
      </div>
    );
  };

  const clinicTemplates = data.clinic?.templates || [];
  const clinicPolicies = data.clinic?.policies || [];
  const loggedInDoctorId = savedUser.doctorId || localStorage.getItem('doctorId');
  const canUpgradeSolo = data.clinic?.type === 'Solo' || (!data.clinic?.type && Boolean(loggedInDoctorId));
  const roleLabels = {
    super_admin: 'Super Admin',
    clinic_admin: 'Clinic Admin',
    doctor: 'Doctor'
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 bg-white border-l-4 ${notification.type === 'success' ? 'border-teal-500 text-teal-800' : 'border-red-500 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-teal-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="text-[13px] font-bold">{notification.message}</span>
        </div>
      )}

      <ModuleHeader
        title="Settings"
        showSearch={false}
        notifications={notificationStack}
        onClearAll={handleClearNotifications}
        onDismiss={handleDismissNotification}
        onLogout={onLogout}
      />
      
      {/* Container Padding: p-2 gap-2 to match other pages */}
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2 max-w-3xl mx-auto w-full">
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* 1. CLINIC */}
          {renderAccordion('clinic', 'Clinic Settings', Building2, 'text-blue-600', 
            <>
              <SettingItem 
                title="Clinic Details" 
                subtitle={(data.clinic?.name || 'My Clinic') + " • " + (data.clinic?.address || 'Set address...')} 
                onEdit={() => openEdit({ title: 'Edit Clinic Details', type: 'clinic_details', initialData: { name: data.clinic?.name, address: data.clinic?.address } })}
              />
              <SettingItem 
                title="Operating Hours" 
                subtitle={data.clinic?.hours || '9 AM - 5 PM'} 
                onEdit={() => openEdit({ title: 'Edit Operating Hours', type: 'single_input', inputLabel: 'Operating Hours', stateKey: 'hours', initialData: { value: data.clinic?.hours } })}
              />
              {canUpgradeSolo && (
                <SettingItem
                  title="Upgrade Practice"
                  subtitle="Convert solo doctor setup into a clinic workspace"
                  onEdit={openUpgradeModal}
                />
              )}
            </>
          )}

          {canManageAccess && renderAccordion('access', 'Users & Access', Users, 'text-indigo-600',
            <>
              {accessLoading ? (
                <div className="p-4 text-center text-[12px] text-slate-400 font-medium">Loading users...</div>
              ) : accessUsers.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-slate-400 font-medium">No users found</div>
              ) : (
                accessUsers.map(user => {
                  const linkedDoctor = data.doctors?.find(doc => String(doc._id) === String(user.doctorId));
                  const isProtectedOwner = user.role === 'super_admin';
                  return (
                    <div key={user._id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[13px] font-bold text-slate-800 truncate">{user.name}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            user.status === 'Inactive'
                              ? 'bg-slate-100 text-slate-500'
                              : user.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-teal-50 text-teal-700'
                          }`}>
                            {user.status || 'Active'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email} • {user.phone}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {roleLabels[user.role] || user.role}{linkedDoctor ? ` • ${linkedDoctor.name}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={user.status === 'Inactive'}
                          onClick={() => handleResetAccessUser(user)}
                          className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${user.status === 'Inactive' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          {user.status === 'Pending' ? 'Resend Activation' : 'Reset Password'}
                        </button>
                        <button
                          type="button"
                          disabled={isProtectedOwner}
                          onClick={() => openStatusConfirm(user)}
                          className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
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
                className="w-full mt-1.5 py-2 text-[12px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <UserPlus size={14} /> Add Admin
              </button>
            </>
          )}
          
          {/* 2. WHATSAPP SETTINGS (Renamed) */}
          {renderAccordion('whatsapp', 'Whatsapp Settings', MessageCircle, 'text-green-600',
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
                className="w-full mt-1.5 py-2 text-[12px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <Plus size={14} /> Add Template
              </button>
            </>
          )}

          {/* 3. POLICIES */}
          {renderAccordion('policy', 'Policy Settings', FileText, 'text-purple-600',
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
                className="w-full mt-1.5 py-2 text-[12px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-teal-100"
              >
                <Plus size={14} /> Add Policy
              </button>
            </>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      <Modal isOpen={!!editModal} onClose={() => { setEditModal(null); setModalError(''); setInvalidFields([]); }} title={editModal?.title} footer={
          <button onClick={handleSaveSetting} disabled={loading} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Saving...' : 'Save Changes'}
          </button>
        }>
        <div className="space-y-3">
           <AlertMessage message={modalError} />
           
           {editModal?.type === 'clinic_details' && (
             <>
               <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Clinic Name *</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-teal-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
               <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Address *</label><textarea className="w-full p-2 border border-slate-200 rounded-lg text-[13px] h-20 outline-none focus:ring-1 focus:ring-teal-500" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
             </>
           )}

           {editModal?.type === 'single_input' && (
             <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">{editModal.inputLabel} *</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-teal-500" value={formData.value || ''} onChange={e => setFormData({...formData, value: e.target.value})} /></div>
           )}

           {(editModal?.type === 'template' || editModal?.type === 'policy') && (
             <>
               <div><label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Title *</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-teal-500" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
               <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Content *</label>
                  <textarea className="w-full p-2 border border-slate-200 rounded-lg text-[13px] h-32 outline-none focus:ring-1 focus:ring-teal-500 resize-none" value={formData.text || ''} onChange={e => setFormData({...formData, text: e.target.value})} />
                  {editModal.type === 'template' && <p className="text-[10px] text-slate-400 mt-1">Variables: {'{patient_name}, {doctor_name}, {time}, {date}'}</p>}
               </div>
             </>
           )}
        </div>
      </Modal>

      <Modal isOpen={upgradeModalOpen} onClose={() => { setUpgradeModalOpen(false); setModalError(''); setInvalidFields([]); }} title="Add Establishment Details" footer={
          <button onClick={handleUpgradeToClinic} disabled={loading} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Upgrading...' : 'Upgrade to Clinic'}
          </button>
        }>
        <div className="space-y-3">
          <AlertMessage message={modalError} />

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Clinic Name <span className="text-red-500">*</span></label>
            <input type="text" placeholder="CareOPD Medical Center" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('clinicName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.clinicName} onChange={e => setUpgradeData({...upgradeData, clinicName: e.target.value})} />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Clinical Establishment (CE) Number <span className="text-red-500">*</span></label>
            <input type="text" placeholder="CE registration number" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('clinicalEstablishmentNo') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.clinicalEstablishmentNo} onChange={e => setUpgradeData({...upgradeData, clinicalEstablishmentNo: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Date of Issue <span className="text-red-500">*</span></label>
              <input type="date" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('ceIssueDate') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.ceIssueDate} onChange={e => setUpgradeData({...upgradeData, ceIssueDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Registering State Authority <span className="text-red-500">*</span></label>
              <input type="text" placeholder="e.g. Delhi Health Authority" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('registeringAuthority') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.registeringAuthority} onChange={e => setUpgradeData({...upgradeData, registeringAuthority: e.target.value})} />
            </div>
          </div>

          <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <input type="checkbox" checked={upgradeData.createAdmin} onChange={e => setUpgradeData({...upgradeData, createAdmin: e.target.checked})} className="accent-teal-600" />
            <UserPlus size={14} className="text-slate-500" />
            <span className="text-[13px] font-bold text-slate-700">Create clinic admin</span>
          </label>

          {upgradeData.createAdmin && (
            <div className="space-y-2 animate-fadeIn">
              <input type="text" placeholder="Admin name *" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('adminName') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.adminName} onChange={e => setUpgradeData({...upgradeData, adminName: e.target.value})} />
              <input type="email" placeholder="Admin email *" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('adminEmail') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.adminEmail} onChange={e => setUpgradeData({...upgradeData, adminEmail: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="tel" maxLength={10} placeholder="Admin phone *" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('adminPhone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.adminPhone} onChange={e => setUpgradeData({...upgradeData, adminPhone: e.target.value.replace(/\D/g, '')})} />
                <input type="password" placeholder="Password *" className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('adminPassword') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`} value={upgradeData.adminPassword} onChange={e => setUpgradeData({...upgradeData, adminPassword: e.target.value})} />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={accessModalOpen} onClose={() => { setAccessModalOpen(false); setModalError(''); setInvalidFields([]); }} title="Add Clinic Admin" footer={
          <button onClick={handleCreateAccessUser} disabled={loading} className="w-full bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium disabled:opacity-70 hover:bg-teal-700 transition-colors">
             {loading ? 'Creating...' : 'Create Admin'}
          </button>
        }>
        <div className="space-y-3">
          <AlertMessage message={modalError} />

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Full name"
              className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('name') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.name}
              onChange={e => setAccessData({ ...accessData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Email ID <span className="text-red-500">*</span></label>
            <input
              type="email"
              placeholder="user@clinic.com"
              className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('email') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.email}
              onChange={e => setAccessData({ ...accessData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Mobile Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              maxLength={10}
              placeholder="10-digit number"
              className={`w-full p-2 border rounded-lg text-[13px] outline-none focus:ring-1 ${invalidFields.includes('phone') ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-teal-500'}`}
              value={accessData.phone}
              onChange={e => setAccessData({ ...accessData, phone: e.target.value.replace(/\D/g, '') })}
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
              className="w-full bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg text-[15px] font-medium disabled:opacity-70 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleToggleAccessUser()}
              disabled={loading}
              className={`w-full text-white py-1.5 rounded-lg text-[15px] font-medium disabled:opacity-70 transition-colors ${
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
            <p className="text-[13px] font-bold text-slate-800">{statusConfirmUser?.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{statusConfirmUser?.email}</p>
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed">
            {statusConfirmUser?.status === 'Inactive'
              ? statusConfirmUser?.activationPending
                ? 'This will restore the invite. The user will remain Pending until they open the activation link and set a password.'
                : 'This will restore access for the selected user.'
              : 'This will immediately block the selected user from signing in.'}
          </p>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">Remark</label>
            <textarea
              value={statusRemark}
              onChange={e => setStatusRemark(e.target.value)}
              placeholder="Optional reason or internal note"
              className="w-full p-2 border border-slate-200 rounded-lg text-[13px] h-24 outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              disabled={loading}
            />
          </div>
        </div>
      </Modal>

    </div>
  );
};
export default Settings;

import React, { useState, useEffect } from 'react';
import { 
  Building2, MessageCircle, FileText, Plus, Edit2, ChevronDown, ChevronRight 
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
  { title: 'Privacy Policy', text: 'We are committed to protecting your personal information...' },
  { title: 'Consent Policy', text: 'By using our services, you consent to...' }
];

const Settings = ({ data, setData }) => {
  const [expandedSection, setExpandedSection] = useState('clinic');
  const [editModal, setEditModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalError, setModalError] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const openEdit = (config) => {
    setModalError('');
    setInvalidFields([]);
    setEditModal(config);
    setFormData(config.initialData || {});
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

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <ModuleHeader title="Settings" showSearch={false} />
      
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

    </div>
  );
};
export default Settings;
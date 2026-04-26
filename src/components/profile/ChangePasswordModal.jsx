import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, EyeOff, Eye } from 'lucide-react';
import Modal from '../ui/Modal';
import AlertMessage from '../ui/AlertMessage';
import API_BASE_URL from '../../config';

// --- Helper Component (Moved from MyAccountModal) ---
const PasswordField = ({ placeholder, value, onChange, isVisible, onToggle }) => (
  <div className="relative">
    <input 
      type={isVisible ? "text" : "password"} 
      placeholder={placeholder}
      className="w-full p-2 pr-9 border border-slate-200 bg-slate-50 rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-teal-500 placeholder:text-slate-400" 
      value={value}
      onChange={onChange}
    />
    <button 
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
    >
      {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  </div>
);

const UNSAFE_CHARS = /[<>"';\\]/;

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPass({ current: false, new: false, confirm: false });
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const toggleVisibility = (field) => {
    setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const onPasswordInput = (field, val) => {
    if (!UNSAFE_CHARS.test(val)) {
      setPasswords(prev => ({ ...prev, [field]: val }));
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!passwords.current || !passwords.new || !passwords.confirm) {
      return setError('Please fill all password fields.');
    }
    if (passwords.new !== passwords.confirm) {
      return setError('New passwords do not match.');
    }
    if (passwords.new.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (UNSAFE_CHARS.test(passwords.new)) {
      return setError('Password contains restricted characters.');
    }

    const clinicId = localStorage.getItem('clinicId');
    if (!clinicId) return setError("Clinic ID missing.");

    const userId = JSON.parse(localStorage.getItem('user'))._id;
    if (!userId) return setError("User session missing.");

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/change-password?clinicId=${clinicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password updated successfully!');
        setPasswords({ current: '', new: '', confirm: '' });
        setTimeout(() => onClose(), 1500);
      } else {
        setError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setError('Server error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Change Password"
      footer={
        <div className="flex gap-2 w-full">
          <button onClick={onClose} className="flex-1 py-1.5 text-[15px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isLoading || !passwords.current || !passwords.new || !passwords.confirm}
            className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-70 transition-opacity"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Update Password'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <AlertMessage message={error} />
        {success && (
          <div className="bg-green-50 text-green-700 p-2.5 rounded-lg flex items-center gap-2 text-[12px] font-medium border border-green-200">
            <CheckCircle size={14} /> <span>{success}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Current Password <span className="text-red-500">*</span></label>
          <PasswordField 
            placeholder="••••••••" 
            value={passwords.current} 
            onChange={(e) => onPasswordInput('current', e.target.value)}
            isVisible={showPass.current}
            onToggle={() => toggleVisibility('current')}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">New Password <span className="text-red-500">*</span></label>
          <PasswordField 
            placeholder="••••••••" 
            value={passwords.new} 
            onChange={(e) => onPasswordInput('new', e.target.value)}
            isVisible={showPass.new}
            onToggle={() => toggleVisibility('new')}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Confirm New Password <span className="text-red-500">*</span></label>
          <PasswordField 
            placeholder="••••••••" 
            value={passwords.confirm} 
            onChange={(e) => onPasswordInput('confirm', e.target.value)}
            isVisible={showPass.confirm}
            onToggle={() => toggleVisibility('confirm')}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;

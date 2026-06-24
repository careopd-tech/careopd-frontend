import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, Mail, Phone } from 'lucide-react';
import Modal from '../ui/Modal';
import AlertMessage from '../ui/AlertMessage';
import API_BASE_URL from '../../config';
import { authFetch, getSessionUser, updateSessionFromAuth } from '../../utils/auth';

const CONTACT_COPY = {
  email: {
    title: 'Update Email',
    fieldLabel: 'New Email Address',
    placeholder: 'doctor@example.com',
    summary: 'Your current email stays active until the new email is verified.',
    icon: Mail,
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase()),
    normalize: (value) => String(value || '').trim().toLowerCase(),
    currentValue: (user) => user.email || ''
  },
  mobile: {
    title: 'Update Mobile',
    fieldLabel: 'New Mobile Number',
    placeholder: '10-digit mobile number',
    summary: 'Your current mobile number stays active until the new mobile is verified.',
    icon: Phone,
    validate: (value) => /^\d{10}$/.test(String(value || '').trim()),
    normalize: (value) => String(value || '').replace(/\D/g, '').slice(0, 10),
    currentValue: (user) => user.phone || ''
  }
};

const ContactChangeInfoModal = ({ type = 'email', isOpen, onClose }) => {
  const content = useMemo(() => CONTACT_COPY[type] || CONTACT_COPY.email, [type]);
  const Icon = content.icon;

  const [value, setValue] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('edit');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sessionUser = getSessionUser();
  const currentValue = content.currentValue(sessionUser);

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setOtp('');
      setStep('edit');
      setIsSending(false);
      setIsVerifying(false);
      setError('');
      setSuccess('');
      return;
    }

    setValue('');
    setOtp('');
    setStep('edit');
    setError('');
    setSuccess('');
  }, [isOpen, type]);

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    const normalizedValue = content.normalize(value);

    if (!content.validate(normalizedValue)) {
      setError(type === 'mobile' ? 'Enter a valid 10-digit mobile number.' : 'Enter a valid email address.');
      return;
    }

    const clinicId = localStorage.getItem('clinicId');
    const userId = sessionUser?._id;
    if (!clinicId || !userId) {
      setError('Unable to load your account context.');
      return;
    }

    try {
      setIsSending(true);
      const response = await authFetch(`${API_BASE_URL}/api/users/${userId}/contact-change/send-otp?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value: normalizedValue
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to send verification code.');
        return;
      }

      setValue(normalizedValue);
      setStep('verify');
      setSuccess(data.message || 'Verification code sent successfully.');
    } catch (err) {
      setError('Server error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setSuccess('');

    if (!otp || otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    const clinicId = localStorage.getItem('clinicId');
    const userId = sessionUser?._id;
    if (!clinicId || !userId) {
      setError('Unable to load your account context.');
      return;
    }

    try {
      setIsVerifying(true);
      const response = await authFetch(`${API_BASE_URL}/api/users/${userId}/contact-change/verify?clinicId=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value,
          otp: otp.trim()
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to verify OTP.');
        return;
      }

      if (data.user) {
        updateSessionFromAuth({ user: data.user });
      }

      setSuccess(data.message || 'Contact updated successfully.');
      window.setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError('Server error occurred.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={content.title}
      footer={
        <div className="flex gap-2 w-full">
          <button
            onClick={onClose}
            disabled={isSending || isVerifying}
            className="flex-1 py-2 text-[14px] text-slate-600 font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          {step === 'edit' ? (
            <button
              onClick={handleSendOtp}
              disabled={isSending}
              className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : 'Send OTP'}
            </button>
          ) : (
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isVerifying ? <Loader2 size={16} className="animate-spin" /> : 'Verify & Update'}
            </button>
          )}
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

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-[12px] text-amber-900">
          <Icon size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wide">Verification Protected</p>
            <p className="mt-1">{content.summary}</p>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Current {type === 'mobile' ? 'Mobile Number' : 'Email Address'}
          </label>
          <input
            type="text"
            value={currentValue}
            disabled
            className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-100 text-slate-600 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
            {content.fieldLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type={type === 'mobile' ? 'tel' : 'email'}
            placeholder={content.placeholder}
            value={value}
            disabled={step === 'verify' || isSending || isVerifying}
            onChange={(event) => setValue(content.normalize(event.target.value))}
            className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
          />
        </div>

        {step === 'verify' && (
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
              6-Digit OTP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otp}
              disabled={isVerifying}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 tracking-[0.2em] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => {
                setStep('edit');
                setOtp('');
                setError('');
                setSuccess('');
              }}
              className="mt-2 text-[12px] font-bold text-teal-600 hover:text-teal-700"
            >
              Change entered {type === 'mobile' ? 'mobile number' : 'email address'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ContactChangeInfoModal;

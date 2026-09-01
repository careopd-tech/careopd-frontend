import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Mail, Phone, X } from 'lucide-react';
import Modal from '../ui/Modal';
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
    summary: 'Verify your current mobile number first. It stays active until the new mobile number is also verified.',
    icon: Phone,
    validate: (value) => /^\d{10}$/.test(String(value || '').trim()),
    normalize: (value) => String(value || '').replace(/\D/g, '').slice(0, 10),
    currentValue: (user) => user.phone || ''
  }
};

const OTP_RESEND_COOLDOWN_SECONDS = 60;

const ContactChangeInfoModal = ({ type = 'email', isOpen, onClose }) => {
  const content = useMemo(() => CONTACT_COPY[type] || CONTACT_COPY.email, [type]);
  const Icon = content.icon;

  const [value, setValue] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(type === 'mobile' ? 'current' : 'edit');
  const [currentVerificationToken, setCurrentVerificationToken] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sessionUser = getSessionUser();
  const currentValue = content.currentValue(sessionUser);
  const displayedCurrentValue = type === 'mobile' && /^\d{10}$/.test(currentValue)
    ? `${currentValue.slice(0, 2)}****${currentValue.slice(-4)}`
    : currentValue;

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setOtp('');
      setStep(type === 'mobile' ? 'current' : 'edit');
      setCurrentVerificationToken('');
      setIsSending(false);
      setIsVerifying(false);
      setResendSeconds(0);
      setError('');
      setSuccess('');
      return;
    }

    setValue('');
    setOtp('');
    setStep(type === 'mobile' ? 'current' : 'edit');
    setCurrentVerificationToken('');
    setError('');
    setSuccess('');
    setResendSeconds(0);
  }, [isOpen, type]);

  useEffect(() => {
    if (!isOpen || resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, resendSeconds]);

  useEffect(() => {
    if (!isOpen || (!error && !success)) return undefined;
    const timer = window.setTimeout(() => {
      setError('');
      setSuccess('');
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [error, success, isOpen]);

  const restartMobileVerification = () => {
    setCurrentVerificationToken('');
    setValue('');
    setOtp('');
    setResendSeconds(0);
    setStep('current');
  };

  const handleSendOtp = async (requestedStep = step) => {
    setError('');
    setSuccess('');
    const isCurrentMobileStep = type === 'mobile' && requestedStep === 'current';
    const normalizedValue = content.normalize(value);

    if (!isCurrentMobileStep && !content.validate(normalizedValue)) {
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
        body: JSON.stringify(isCurrentMobileStep
          ? { type, stage: 'current' }
          : {
              type,
              value: normalizedValue,
              ...(type === 'mobile' ? { stage: 'new', currentVerificationToken } : {})
            })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (
          type === 'mobile'
          && step === 'new'
          && ['CURRENT_MOBILE_VERIFICATION_REQUIRED', 'CURRENT_MOBILE_VERIFICATION_EXPIRED'].includes(data.code)
        ) {
          restartMobileVerification();
        }
        setError(data.error || 'Failed to send verification code.');
        return;
      }

      if (!isCurrentMobileStep) setValue(normalizedValue);
      setOtp('');
      setStep(isCurrentMobileStep ? 'verifyCurrent' : (type === 'mobile' ? 'verifyNew' : 'verify'));
      setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);
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
        body: JSON.stringify(type === 'mobile'
          ? {
              type,
              stage: step === 'verifyCurrent' ? 'current' : 'new',
              ...(step === 'verifyNew' ? { value, currentVerificationToken } : {}),
              otp: otp.trim()
            }
          : { type, value, otp: otp.trim() })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (
          type === 'mobile'
          && step === 'verifyNew'
          && ['CURRENT_MOBILE_VERIFICATION_REQUIRED', 'CURRENT_MOBILE_VERIFICATION_EXPIRED'].includes(data.code)
        ) {
          restartMobileVerification();
        }
        setError(data.error || 'Failed to verify OTP.');
        return;
      }

      if (type === 'mobile' && step === 'verifyCurrent') {
        if (!data.currentVerificationToken) {
          setError('Current mobile verification could not be completed. Please try again.');
          return;
        }
        setCurrentVerificationToken(data.currentVerificationToken);
        setOtp('');
        setStep('new');
        setSuccess(data.message || 'Current mobile number verified. Enter your new mobile number.');
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

  const isOtpStep = step === 'verify' || step === 'verifyCurrent' || step === 'verifyNew';
  const isSendStep = step === 'edit' || step === 'current' || step === 'new';
  const showCurrentContactField = type !== 'mobile' || step === 'current' || step === 'verifyCurrent';
  const showNewContactField = type !== 'mobile' || step === 'new' || step === 'verifyNew';
  const showOtpField = isOtpStep || (type === 'mobile' && (step === 'current' || step === 'new'));
  const primaryButtonLabel = isSendStep ? 'Send OTP' : 'Verify OTP';

  return (
    <>
      {(error || success) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`fixed right-4 top-4 z-[200] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-medium shadow-lg animate-fadeIn ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {error ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle size={16} className="flex-shrink-0" />}
          <span>{error || success}</span>
          <button
            type="button"
            onClick={() => {
              setError('');
              setSuccess('');
            }}
            className="ml-1 rounded-md p-1 transition-colors hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          {isSendStep ? (
            <button
              onClick={() => handleSendOtp()}
              disabled={isSending}
              className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : primaryButtonLabel}
            </button>
          ) : (
            <button
              onClick={handleVerify}
              disabled={isVerifying || isSending}
              className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isVerifying ? <Loader2 size={16} className="animate-spin" /> : primaryButtonLabel}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-[12px] text-amber-900">
          <Icon size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wide">Verification Protected</p>
            <p className="mt-1">{content.summary}</p>
          </div>
        </div>

        {type === 'mobile' && (
          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold uppercase tracking-wide">
            <div className={`rounded-lg border px-2 py-2 text-center ${currentVerificationToken ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              1. Verify Current
            </div>
            <div className={`rounded-lg border px-2 py-2 text-center ${step === 'new' || step === 'verifyNew' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
              2. Verify New
            </div>
          </div>
        )}

        {showCurrentContactField && (
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Current {type === 'mobile' ? 'Mobile Number' : 'Email Address'}
          </label>
          <input
            type="text"
            value={displayedCurrentValue}
            disabled
            className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-100 text-slate-600 cursor-not-allowed"
          />
        </div>
        )}

        {showNewContactField && (
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
            {content.fieldLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type={type === 'mobile' ? 'tel' : 'email'}
            placeholder={content.placeholder}
            value={value}
            disabled={step === 'verify' || step === 'verifyNew' || isSending || isVerifying}
            onChange={(event) => setValue(content.normalize(event.target.value))}
            className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
          />
        </div>
        )}

        {showOtpField && (
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase tracking-wide">
              Enter OTP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              disabled={!isOtpStep || isVerifying}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 tracking-[0.2em] disabled:opacity-60"
            />
            <div className="mt-2 min-h-5">
              {!isOtpStep ? (
                <p className="text-[11px] font-medium text-slate-500">Select Send OTP to receive and enter the verification code.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp(step === 'verifyCurrent' ? 'current' : (type === 'mobile' ? 'new' : 'edit'))}
                  disabled={resendSeconds > 0 || isSending || isVerifying}
                  className="text-[12px] font-bold text-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </Modal>
    </>
  );
};

export default ContactChangeInfoModal;

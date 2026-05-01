import React, { useState } from 'react';
import { Building2, Stethoscope, ShieldCheck, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import AlertMessage from '../components/ui/AlertMessage';
import API_BASE_URL from '../config';

const Onboarding = ({ setAuthState }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdClinicCode, setCreatedClinicCode] = useState('');

  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const [formData, setFormData] = useState({
    type: '',
    phone: '', email: '', password: '', otp: '', registrationToken: '',
    doctorName: '', regNo: '', regYear: '', medicalCouncil: '',
    clinicName: '', clinicalEstablishmentNo: '', ceIssueDate: '', registeringAuthority: '',
    hasAgreedToTerms: false
  });

  const handleSelectType = (type) => {
    setError('');
    setFormData({
      ...formData,
      type,
      doctorName: type === 'Solo' ? formData.doctorName : '',
      clinicName: type === 'Clinic' ? formData.clinicName : ''
    });
    setStep(2);
  };

  const handleSendOtp = async () => {
    const selectedName = formData.type === 'Solo' ? formData.doctorName : formData.clinicName;
    if (!selectedName.trim() || !formData.phone) return setError('Fill required fields.');

    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/otp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: formData.phone })
      });
      if (res.ok) {
        setIsOtpSent(true);
        setIsOtpVerified(false);
        setFormData(prev => ({ ...prev, otp: '', registrationToken: '' }));
        setStep(2);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp) return setError('Enter the 6-digit OTP.');

    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/otp/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: formData.phone, otp: formData.otp })
      });
      const data = await res.json();

      if (res.ok) {
        setIsOtpVerified(true);
        setFormData(prev => ({ ...prev, registrationToken: data.registrationToken }));
        setStep(3);
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!isOtpVerified) {
      return setError('Verify OTP before completing setup.');
    }

    if (!normalizedEmail) {
      return setError('Enter your email ID to complete setup.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return setError('Enter a valid email ID.');
    }

    if (!formData.password) {
      return setError('Create a password to complete setup.');
    }

    if (!formData.hasAgreedToTerms) {
      return setError('You must agree to the Terms & Privacy Policy to proceed.');
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, email: normalizedEmail })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setCreatedClinicCode(result.clinicCode || '');
        setSuccess(true);
      } else if (response.status === 401 && result.code === 'OTP_EXPIRED') {
        setIsOtpVerified(false);
        setIsOtpSent(false);
        setStep(2);
        setFormData(prev => ({ ...prev, otp: '', registrationToken: '' }));
        setError(result.error || 'OTP verification has expired. Please send a new OTP.');
      } else {
        setError(result.error || 'Failed to register clinic.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToPassword = (e) => {
    e.preventDefault();
    setError('');
    setStep(4);
  };

  if (success) {
    return (
      <div className="auth-screen min-h-dvh bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-scaleIn">
          <ShieldCheck size={64} className="mx-auto text-teal-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Workspace Ready!</h2>
          <p className="text-slate-500 mb-6">Your secure healthcare database has been successfully provisioned.</p>
          {createdClinicCode && (
            <div className="mb-6 p-4 rounded-2xl border border-teal-100 bg-teal-50">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 mb-1">Clinic Code</p>
              <p className="text-[22px] font-bold tracking-[0.2em] text-slate-800">{createdClinicCode}</p>
              <p className="text-[12px] text-slate-500 mt-2">Share this code with your team. They will need it to sign in.</p>
            </div>
          )}
          <button onClick={() => setAuthState('login')} className="w-full bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen min-h-dvh bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 animate-scaleIn">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {step === 1 && 'Choose your setup'}
            {step === 2 && (isOtpSent ? 'Verify your identity' : 'Let\'s start with basic details')}
            {step === 3 && (formData.type === 'Solo' ? 'Professional Credentials' : 'Establishment Details')}
            {step === 4 && 'Secure your account'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Step {step} of 4</p>
        </div>

        <AlertMessage message={error} />

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4 animate-fadeIn">
            <button type="button" onClick={() => handleSelectType('Solo')} className="p-6 border-2 border-slate-100 hover:border-teal-500 rounded-2xl flex flex-col items-center text-center group transition-all hover:shadow-md hover:bg-teal-50/30">
              <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Stethoscope size={32} /></div>
              <h3 className="font-bold text-slate-800 text-[15px]">Solo Doctor</h3>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">I operate my own private practice independently.</p>
            </button>

            <button type="button" onClick={() => handleSelectType('Clinic')} className="p-6 border-2 border-slate-100 hover:border-blue-500 rounded-2xl flex flex-col items-center text-center group transition-all hover:shadow-md hover:bg-blue-50/30">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Building2 size={32} /></div>
              <h3 className="font-bold text-slate-800 text-[15px]">Clinic / Poly</h3>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">We have an admin desk and multiple doctors.</p>
            </button>
          </div>
        )}

        {step > 1 && (
          <form onSubmit={step === 3 ? handleProceedToPassword : step === 4 ? handleRegister : (e) => e.preventDefault()} className="space-y-4">
            {step === 2 && !isOtpSent && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">
                    {formData.type === 'Solo' ? 'Doctor Name' : 'Clinic Name'} <span className="text-red-500">*</span>
                  </label>
                  {formData.type === 'Solo' ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">Dr.</span>
                      <input required type="text" placeholder="John Doe" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.doctorName} onChange={e => setFormData({...formData, doctorName: e.target.value})} />
                    </div>
                  ) : (
                    <input required type="text" placeholder="CareOPD Medical Center" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.clinicName} onChange={e => setFormData({...formData, clinicName: e.target.value})} />
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Mobile Number <span className="text-red-500">*</span></label>
                  <input required type="tel" maxLength={10} placeholder="10-digit number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setIsOtpSent(false); setFormData({...formData, otp: ''}); setIsOtpVerified(false); setStep(1); }} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <button type="button" onClick={handleSendOtp} disabled={isLoading} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors flex justify-center items-center">
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Send OTP'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && isOtpSent && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-teal-50 p-5 rounded-xl border border-teal-100 animate-fadeIn flex flex-col items-center">
                  <label className="block text-[13px] font-medium text-slate-700 mb-3 text-center">
                    Enter 6 digit OTP sent to <span className="font-bold text-slate-900">{formData.phone}</span>
                  </label>
                  <div className="relative max-w-xs w-full mx-auto mb-3">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
                    <input required type="text" maxLength={6} placeholder="123456" disabled={isLoading} className="w-full pl-9 pr-3 py-2.5 bg-white border border-teal-200 rounded-xl text-[15px] font-bold tracking-widest text-center outline-none focus:ring-2 focus:ring-teal-500" value={formData.otp} onChange={e => setFormData({...formData, otp: e.target.value.replace(/\D/g, '')})} />
                  </div>
                  <button type="button" onClick={() => { setIsOtpSent(false); setFormData({...formData, otp: ''}); setIsOtpVerified(false); setStep(2); }} className="text-[12px] text-teal-600 font-bold hover:text-teal-700 hover:underline transition-colors">
                    Edit Number
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setIsOtpSent(false); setFormData({...formData, otp: ''}); setIsOtpVerified(false); setStep(1); }} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <button type="button" onClick={handleVerifyOtp} disabled={isLoading} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors flex justify-center items-center">
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Verify & Proceed'}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && formData.type === 'Solo' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Medical Registration Number <span className="text-red-500">*</span></label>
                    <input required type="text" placeholder="NMC/SMC Number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.regNo} onChange={e => setFormData({...formData, regNo: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Year of Registration <span className="text-red-500">*</span></label>
                    <input required type="text" maxLength={4} placeholder="YYYY" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.regYear} onChange={e => setFormData({...formData, regYear: e.target.value.replace(/\D/g, '')})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Registering Medical Council <span className="text-red-500">*</span></label>
                  <input required type="text" placeholder="e.g. Maharashtra Medical Council" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.medicalCouncil} onChange={e => setFormData({...formData, medicalCouncil: e.target.value})} />
                </div>
              </div>
            )}

            {step === 3 && formData.type === 'Clinic' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Clinical Establishment (CE) Number <span className="text-red-500">*</span></label>
                  <input required type="text" placeholder="CE registration number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.clinicalEstablishmentNo} onChange={e => setFormData({...formData, clinicalEstablishmentNo: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Date of Issue <span className="text-red-500">*</span></label>
                    <input required type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.ceIssueDate} onChange={e => setFormData({...formData, ceIssueDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Registering State Authority <span className="text-red-500">*</span></label>
                    <input required type="text" placeholder="e.g. Delhi Health Authority" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.registeringAuthority} onChange={e => setFormData({...formData, registeringAuthority: e.target.value})} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => { setIsOtpSent(true); setStep(2); }} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <button type="submit" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 flex justify-center items-center gap-2 shadow-md">
                  Continue to Final Step
                </button>
              </div>
            )}

            {step === 4 && (
              <>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Email ID <span className="text-red-500">*</span></label>
                  <input required type="email" placeholder="dr.name@clinic.com" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1 uppercase">Create Password <span className="text-red-500">*</span></label>
                  <input required type="password" placeholder="At least 8 characters" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-teal-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>

                <div className="bg-slate-100 p-3 rounded-xl mt-4 border border-slate-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.hasAgreedToTerms}
                      onChange={e => setFormData({...formData, hasAgreedToTerms: e.target.checked})}
                      className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="text-[12px] text-slate-600 leading-tight">
                      I agree to the <a href="#" className="text-teal-600 font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-teal-600 font-bold hover:underline">Privacy Policy</a>. I acknowledge my organization acts as the Data Fiduciary.
                    </span>
                  </label>
                </div>

                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setStep(3)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <button type="submit" disabled={isLoading} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 flex justify-center items-center gap-2 shadow-md">
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Complete Setup'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="mt-6 text-center text-[13px]">
          <button onClick={() => setAuthState('login')} className="font-bold text-teal-600 hover:text-teal-700 transition-colors">Back to Login</button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

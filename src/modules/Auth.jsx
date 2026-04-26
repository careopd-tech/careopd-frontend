import React, { useState, useEffect } from 'react';
import { Mail, KeyRound, Eye, EyeOff, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import AlertMessage from '../components/ui/AlertMessage';
import API_BASE_URL from '../config';

// FIXED: Added setUserRole to props matching App.jsx
const Auth = ({ authState, setAuthState, setUserRole }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [otp, setOtp] = useState('');

  const isValidLoginId = (value) => {
    const trimmed = value.trim();
    const isMobile = /^\d{10}$/.test(trimmed);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
    return isMobile || isEmail;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    let errors = [];
    if (authState === 'login') {
      if (!email) errors.push('email');
      if (!password) errors.push('password');
    } else if (authState === 'forgot') {
      if (!email) errors.push('email');
    } else if (authState === 'reset') {
      if (!otp || otp.length !== 6) errors.push('otp');
      if (!password) errors.push('password');
      if (!confirmPassword) errors.push('confirmPassword');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      return setError('Please fill all required details marked with *');
    }

    if ((authState === 'login' || authState === 'forgot') && !isValidLoginId(email)) {
      setInvalidFields(['email']);
      return setError('Enter a valid 10-digit mobile number or email ID.');
    }

    setInvalidFields([]);
    setIsLoading(true);

    try {
      if (authState === 'login') {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();

        if (response.ok && result.user) {
          // --- NEW: Setup the Personas in LocalStorage ---
          localStorage.setItem('user', JSON.stringify(result.user));
          localStorage.setItem('clinicId', result.user.clinicId._id || result.user.clinicId);
          localStorage.setItem('userName', result.user.name);
          localStorage.setItem('userEmail', result.user.email || email.trim().toLowerCase());
          
          // Securely map the role and doctorId for RBAC UI logic
          localStorage.setItem('userRole', result.user.role);
          if (result.user.doctorId) {
             localStorage.setItem('doctorId', result.user.doctorId);
          } else {
             localStorage.removeItem('doctorId');
          }
          
          if (result.token) localStorage.setItem('token', result.token);
          
          // Update React State
          if (setUserRole) setUserRole(result.user.role);
          setAuthState('authenticated');

        } else {
          setError(result.error || 'Login failed. Please check your credentials.');
        }
      } 
      else if (authState === 'forgot') {
        const recoveryContact = email.trim();
        const isMobileRecovery = /^\d{10}$/.test(recoveryContact);
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryContact })
        });
        
        // We intentionally don't check response.ok to prevent email enumeration
        // but we still await it to ensure the request completes.
        const recoveryContactType = isMobileRecovery ? 'mobile' : 'email id';
        setSuccess(`A 6-digit OTP has been sent to your ${recoveryContactType}: ${recoveryContact}`);
        setAuthState('reset'); // Transition to OTP verification screen
      }
      else if (authState === 'reset') {
        if (password !== confirmPassword) {
           setError('Passwords do not match.');
           setIsLoading(false); 
           return;
        }
        if (password.length < 6) {
           setError('Password must be at least 6 characters.');
           setIsLoading(false);
           return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword: password })
        });

        const result = await response.json();

        if (response.ok) {
          setSuccess('Password updated successfully! Redirecting...');
          setTimeout(() => {
            setAuthState('login');
            setSuccess('Password updated successfully');
            setOtp('');
            setPassword('');
            setConfirmPassword('');
          }, 2000);
        } else {
          setError(result.error || 'Invalid or expired OTP. Please try again.');
        }
      }
    } catch (err) {
      console.log("Fetch error:", err);
      setError('Failed to connect to the CareOPD server. Is it running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 animate-scaleIn">
        
        {/* Header/Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <img src="/CareOPD-Logo.png" alt="CareOPD Logo" className="h-24 mb-2 object-contain" />
          <h2 className="text-2xl font-bold text-slate-800 text-center leading-tight">
            {authState === 'login' && 'Welcome to CareOPD'}
            {authState === 'forgot' && 'Recover Account'}
            {authState === 'reset' && 'Verify OTP & Reset'}
          </h2>
          <p className="text-slate-500 text-sm mt-1.5 text-center">
            {authState === 'login' && 'Sign in to access your administrative dashboard.'}
            {authState === 'forgot' && 'We will send a 6-digit OTP to your registered contact.'}
            {authState === 'reset' && 'Enter the OTP and set a new password.'}
          </p>
        </div>

        <AlertMessage message={error} />
        {success && (
          <div className="bg-green-50 text-green-700 p-2.5 rounded-lg flex items-start gap-2 mb-4 text-[12px] font-medium border border-green-200 animate-fadeIn">
            <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {(authState === 'login' || authState === 'forgot') && (
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Mobile Number / Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  name="email"
                  autoComplete="username"
                  placeholder={authState === 'forgot' ? 'registered mobile or email' : '10-digit number or email'} 
                  disabled={isLoading} 
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-[14px] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${invalidFields.includes('email') ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-teal-500'}`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {authState === 'reset' && (
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">6-Digit OTP <span className="text-red-500">*</span></label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  maxLength={6}
                  placeholder="123456" 
                  disabled={isLoading} 
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-[14px] transition-all outline-none tracking-widest disabled:opacity-50 disabled:cursor-not-allowed ${invalidFields.includes('otp') ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-teal-500'}`}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
          )}

          {(authState === 'login' || authState === 'reset') && (
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                {authState === 'reset' ? 'New Password' : 'Password'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  autoComplete="current-password"
                  placeholder="••••••••" 
                  disabled={isLoading}
                  className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-[14px] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${invalidFields.includes('password') ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-teal-500'}`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {authState === 'reset' && (
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Confirm Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  disabled={isLoading}
                  className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-[14px] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${invalidFields.includes('confirmPassword') ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-teal-500'}`}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {authState === 'login' && (
            <div className="flex justify-end pt-1">
              <button 
                type="button" 
                disabled={isLoading}
                onClick={() => { setAuthState('forgot'); setError(''); setSuccess(''); setInvalidFields([]); }}
                className="text-[12px] font-bold text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* UPDATED SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={isLoading || (authState === 'reset' && (!otp || !password || !confirmPassword))}
            className="w-full bg-teal-600 text-white py-2.5 rounded-xl text-[15px] font-bold hover:bg-teal-700 shadow-md hover:shadow-lg transition-all active:scale-[0.98] mt-2 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>
                  {authState === 'login' && 'Signing In...'}
                  {authState === 'forgot' && 'Sending OTP...'}
                  {authState === 'reset' && 'Verifying...'}
                </span>
              </>
            ) : (
              <>
                {authState === 'login' && 'Sign In'}
                {authState === 'forgot' && 'Send OTP'}
                {authState === 'reset' && 'Verify and Update'}
              </>
            )}
          </button>
        </form>

        {(authState === 'forgot' || authState === 'reset') && (
          <button 
            type="button"
            disabled={isLoading}
            onClick={() => { setAuthState('login'); setError(''); setSuccess(''); setInvalidFields([]); }}
            className="w-full flex justify-center items-center gap-2 mt-6 text-[13px] font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        )}

        {authState === 'login' && (
          <div className="mt-6 text-center text-[13px] text-slate-500 font-medium">
            Don't have an account?{' '}
            <button type="button" onClick={() => { setAuthState('onboarding'); setError(''); setSuccess(''); setInvalidFields([]); }} className="text-teal-600 font-bold hover:text-teal-700 transition-colors">
              Register
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-[12px] text-slate-400 font-medium">
        &copy; {new Date().getFullYear()} CareOPD Systems. All rights reserved.
        <p className="mt-1 text-[10px] text-slate-300 font-bold tracking-wider">v1.0.0</p>
      </div>
    </div>
  );
};

export default Auth;

import React, { useState } from 'react';
import { Mail, KeyRound, Eye, EyeOff, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'; // Added Loader2
import AlertMessage from '../components/ui/AlertMessage';
import API_BASE_URL from '../config';

const Auth = ({ authState, setAuthState }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // --- NEW: Loading State ---
  const [isLoading, setIsLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // 1. Validation Logic
    let errors = [];
    if (authState === 'login') {
      if (!email) errors.push('email');
      if (!password) errors.push('password');
    } else if (authState === 'forgot') {
      if (!email) errors.push('email');
    } else if (authState === 'reset') {
      if (!password) errors.push('password');
      if (!confirmPassword) errors.push('confirmPassword');
    }

    if (errors.length > 0) {
      setInvalidFields(errors);
      return setError('Please fill all required details marked with *');
    }
    setInvalidFields([]);

    // 2. Start Loading
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
          localStorage.setItem('user', JSON.stringify(result.user));
          localStorage.setItem('clinicId', result.user.clinicId._id || result.user.clinicId);
          localStorage.setItem('userName', result.user.name);
          if (result.token) localStorage.setItem('token', result.token);
          
          setAuthState('authenticated');
        } else {
          setError(result.error || 'Login failed. Please check your credentials.');
        }
      } 
      else if (authState === 'forgot') {
        // API call simulation
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        setSuccess('If an account exists, a reset link has been sent to your email.');
        setTimeout(() => setAuthState('reset'), 2000); 
      }
      else if (authState === 'reset') {
        if (password !== confirmPassword) {
           setError('Passwords do not match.');
           setIsLoading(false); // Stop loader here immediately
           return;
        }
        if (password.length < 6) {
           setError('Password must be at least 6 characters.');
           setIsLoading(false);
           return;
        }
        
        // API call simulation
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSuccess('Password set successfully!');
        setTimeout(() => setAuthState('login'), 1500);
      }
    } catch (err) {
      console.log("Fetch error:", err);
      setError('Failed to connect to the CareOPD server. Is it running?');
    } finally {
      // 3. Stop Loading (Always runs, success or fail)
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 animate-scaleIn">
        
        {/* Header/Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-[24px] mb-4 shadow-sm">
            C
          </div>
          <h2 className="text-2xl font-bold text-slate-800 text-center leading-tight">
            {authState === 'login' && 'Welcome to CareOPD'}
            {authState === 'forgot' && 'Recover Account'}
            {authState === 'reset' && 'Set Secure Password'}
          </h2>
          <p className="text-slate-500 text-sm mt-1.5 text-center">
            {authState === 'login' && 'Sign in to access your administrative dashboard.'}
            {authState === 'forgot' && 'Enter your email to receive a password reset link.'}
            {authState === 'reset' && 'Set your first-time password or reset an existing one.'}
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
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  name="email"
                  autoComplete="username"
                  placeholder="admin@careopd.com" 
                  disabled={isLoading} 
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-[14px] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${invalidFields.includes('email') ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-slate-200 focus:ring-2 focus:ring-teal-500'}`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
            disabled={isLoading}
            className="w-full bg-teal-600 text-white py-2.5 rounded-xl text-[15px] font-bold hover:bg-teal-700 shadow-md hover:shadow-lg transition-all active:scale-[0.98] mt-2 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                {authState === 'login' && 'Sign In'}
                {authState === 'forgot' && 'Send Reset Link'}
                {authState === 'reset' && 'Save Password'}
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
      </div>

      <div className="mt-8 text-center text-[12px] text-slate-400 font-medium">
        &copy; {new Date().getFullYear()} CareOPD Systems. All rights reserved.
      </div>
    </div>
  );
};

export default Auth;
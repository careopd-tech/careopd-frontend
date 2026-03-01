import React, { useState, useEffect } from 'react';
import { Camera, Save, User, Mail, Phone, Shield, Eye, EyeOff, Lock } from 'lucide-react';
import Modal from '../ui/Modal'; 
import API_BASE_URL from '../../config'; // Import your API Config

// --- Helper Component ---
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

const MyAccountModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  
  // 1. Database State
  const [savedData, setSavedData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    avatar: ''
  });

  // 2. Form State
  const [userData, setUserData] = useState(savedData);

  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  // --- FETCH USER DATA ON OPEN ---
  useEffect(() => {
    if (isOpen) {
      const fetchUserData = async () => {
        // Assuming userId is stored in localStorage after login
        // Adjust this key based on your login logic (e.g., JSON.parse(localStorage.getItem('user'))._id)
        const userStr = localStorage.getItem('user');
        const userId = userStr ? JSON.parse(userStr)._id : null;

        if (!userId) return;

        try {
          const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);
          if (response.ok) {
            const data = await response.json();
            const formattedData = {
              name: data.name,
              email: data.email,
              phone: data.phone || '',
              role: data.role,
              avatar: data.photo || ''
            };
            setSavedData(formattedData);
            setUserData(formattedData);
          }
        } catch (error) {
          console.error("Failed to fetch user data");
        }
      };

      fetchUserData();
      
      // Reset Passwords
      setPasswords({ current: '', new: '', confirm: '' }); 
      setShowPass({ current: false, new: false, confirm: false }); 
    }
  }, [isOpen]);

  // Regex
  const NAME_REGEX = /^[a-zA-Z\s.-]*$/;     
  const PHONE_REGEX = /^\d*$/;             
  const UNSAFE_CHARS = /[<>"';\\]/;        

  const toggleVisibility = (field) => {
    setShowPass(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // --- API: UPDATE PROFILE ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr)._id : null;
    if (!userId) return;

    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userData.name,
          phone: userData.phone,
          photo: userData.avatar 
        })
      });

      if (response.ok) {
        const updated = await response.json();
        setSavedData(userData); // Sync local state
        
        // Optional: Update localStorage if you cache user name there
        const lsUser = JSON.parse(userStr);
        lsUser.name = updated.name;
        localStorage.setItem('user', JSON.stringify(lsUser));
        
        alert('Profile updated successfully');
      } else {
        alert('Failed to update profile');
      }
    } catch (err) {
      alert('Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  // --- API: CHANGE PASSWORD ---
  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      alert("New passwords do not match!");
      return;
    }
    if (UNSAFE_CHARS.test(passwords.new)) {
      alert("Password contains restricted characters");
      return;
    }

    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr)._id : null;
    if (!userId) return;

    setPassLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert("Password updated successfully");
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        alert(data.error || "Failed to update password");
      }
    } catch (err) {
      alert('Server error occurred');
    } finally {
      setPassLoading(false);
    }
  };

  const onPasswordInput = (field, val) => {
    if (!UNSAFE_CHARS.test(val)) {
      setPasswords(prev => ({ ...prev, [field]: val }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My Account">
      <div className="space-y-4">
        
        {/* Photo Upload Logic (Simplified for Base64) */}
        <div className="flex justify-center mb-2">
          <label className="relative group cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors">
              {userData.avatar ? (
                <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="text-teal-700 text-2xl font-bold">{userData.name ? userData.name.charAt(0) : 'U'}</div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={20} />
            </div>
            {/* Hidden Input for File Upload */}
            <input 
              type="file" 
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setUserData({...userData, avatar: reader.result});
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        </div>

        {/* User Details Form */}
        <form onSubmit={handleUpdate} className="space-y-3">
          
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase flex items-center gap-1.5">
              <User size={12} /> Full Name
            </label>
            <input 
              type="text" 
              value={userData.name}
              onChange={(e) => {
                const val = e.target.value;
                if (NAME_REGEX.test(val)) setUserData({...userData, name: val});
              }}
              className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase flex items-center gap-1.5">
              <Mail size={12} /> Email Address
            </label>
            <input 
              type="email" 
              value={userData.email}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-100 text-slate-500 cursor-not-allowed select-none opacity-80"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Phone */}
            <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase flex items-center gap-1.5">
                <Phone size={12} /> Phone
                </label>
                <input 
                type="tel" 
                maxLength={10}
                value={userData.phone}
                onChange={(e) => {
                    const val = e.target.value;
                    if (PHONE_REGEX.test(val)) setUserData({...userData, phone: val});
                }}
                className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none"
                />
            </div>

            {/* Role */}
            <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-0.5 uppercase flex items-center gap-1.5">
                <Shield size={12} /> Role
                </label>
                <div className="w-full p-2 border border-indigo-100 bg-indigo-50 rounded-lg text-[13px] text-indigo-700 font-bold truncate">
                    {userData.role}
                </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2 bg-teal-600 text-white rounded-lg text-[13px] font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Updating...' : <><Save size={14} /> Update Profile</>}
          </button>
        </form>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Change Password Section */}
        <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Lock size={14} className="text-slate-400" />
              <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Change Password</h4>
            </div>
            
            <PasswordField 
              placeholder="Current Password" 
              value={passwords.current} 
              onChange={(e) => onPasswordInput('current', e.target.value)}
              isVisible={showPass.current}
              onToggle={() => toggleVisibility('current')}
            />
            
            <PasswordField 
              placeholder="New Password" 
              value={passwords.new} 
              onChange={(e) => onPasswordInput('new', e.target.value)}
              isVisible={showPass.new}
              onToggle={() => toggleVisibility('new')}
            />

            <PasswordField 
              placeholder="Confirm Password" 
              value={passwords.confirm} 
              onChange={(e) => onPasswordInput('confirm', e.target.value)}
              isVisible={showPass.confirm}
              onToggle={() => toggleVisibility('confirm')}
            />

            <button 
              type="button"
              onClick={handlePasswordChange}
              disabled={passLoading || !passwords.current || !passwords.new || !passwords.confirm}
              className="w-full py-2 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-black mt-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {passLoading ? 'Updating...' : 'Update Password'}
            </button> </form>
        </div>

      </div>
    </Modal>
  );
};

export default MyAccountModal;
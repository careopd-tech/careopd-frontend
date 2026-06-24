import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Mail, Phone, Save, Shield, Stethoscope } from 'lucide-react';
import Modal from '../ui/Modal';
import AlertMessage from '../ui/AlertMessage';
import API_BASE_URL from '../../config';
import { authFetch } from '../../utils/auth';

const NAME_REGEX = /^[a-zA-Z\s.-]*$/;
const EMPTY_PROFILE = {
  avatar: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  gender: 'M',
  address: '',
  department: '',
  qualification: '',
  experience: '',
  regNo: '',
  isDoctorProfile: false
};

const PROFILE_PROGRESS_TOTAL_FIELDS = 7;

const getSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    return {};
  }
};

const getClinicType = () => {
  try {
    return JSON.parse(localStorage.getItem('careopd_clinic_context') || '{}')?.type || '';
  } catch (err) {
    return '';
  }
};

const isBase64Photo = (value) => typeof value === 'string' && value.length > 50;

const splitDoctorName = (value = '') => {
  const rawName = String(value || '').replace(/^(Dr|Mr|Ms)\.\s*/i, '').trim();
  const parts = rawName.split(' ').filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: parts[0] || '',
      middleName: '',
      lastName: ''
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: parts[1]
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
};

const isSeededSoloDoctorProfile = (doctorProfile, clinicType) => (
  clinicType === 'Solo'
  && Boolean(doctorProfile)
  && doctorProfile.photo === 'DR'
  && !doctorProfile.address
  && doctorProfile.department === 'General Physician'
  && doctorProfile.qualification === 'MBBS'
  && Number(doctorProfile.experience || 0) === 0
);

const buildProfileState = (userPayload, clinicType) => {
  const doctorProfile = userPayload?.doctorProfile || null;
  const parsedName = splitDoctorName(doctorProfile?.name || userPayload?.name || '');
  const isSeededSolo = isSeededSoloDoctorProfile(doctorProfile, clinicType);

  return {
    avatar: [userPayload?.photo, doctorProfile?.photo].find(isBase64Photo) || '',
    firstName: parsedName.firstName,
    middleName: parsedName.middleName,
    lastName: parsedName.lastName,
    email: userPayload?.email || '',
    phone: userPayload?.phone || '',
    role: userPayload?.accountRole || userPayload?.role || '',
    gender: doctorProfile?.gender || userPayload?.gender || (doctorProfile ? 'M' : ''),
    address: doctorProfile?.address || '',
    department: isSeededSolo ? '' : (doctorProfile?.department || ''),
    qualification: isSeededSolo ? '' : (doctorProfile?.qualification || ''),
    experience: isSeededSolo && Number(doctorProfile?.experience || 0) === 0
      ? ''
      : String(doctorProfile?.experience ?? ''),
    regNo: doctorProfile?.regNo || '',
    isDoctorProfile: Boolean(userPayload?.doctorId && doctorProfile)
  };
};

const getPendingFields = (profile) => {
  if (!profile.isDoctorProfile) {
    return ['firstName', 'lastName'].filter((field) => !String(profile[field] || '').trim());
  }

  const missingFields = [];
  if (!String(profile.firstName || '').trim()) missingFields.push('firstName');
  if (!String(profile.lastName || '').trim()) missingFields.push('lastName');
  if (!String(profile.address || '').trim()) missingFields.push('address');
  if (!String(profile.department || '').trim()) missingFields.push('department');
  if (!String(profile.qualification || '').trim()) missingFields.push('qualification');
  if (String(profile.experience || '').trim() === '') missingFields.push('experience');
  if (!String(profile.regNo || '').trim()) missingFields.push('regNo');
  return missingFields;
};

const MyProfileModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userData, setUserData] = useState(EMPTY_PROFILE);
  const [clinicType, setClinicType] = useState('');
  const [needsCompletionPrompt, setNeedsCompletionPrompt] = useState(false);
  const closeTimerRef = useRef(null);

  const pendingFields = useMemo(() => getPendingFields(userData), [userData]);
  const requiresCompletion = userData.isDoctorProfile && needsCompletionPrompt;
  const completedProfileFields = PROFILE_PROGRESS_TOTAL_FIELDS - pendingFields.length;
  const profileCompletionPercent = Math.round((completedProfileFields / PROFILE_PROGRESS_TOTAL_FIELDS) * 100);
  const progressRadius = 20;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset = progressCircumference - ((profileCompletionPercent / 100) * progressCircumference);

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfile = async () => {
      setFetching(true);
      setError('');
      setSuccess('');

      const clinicId = localStorage.getItem('clinicId');
      const userId = getSessionUser()._id;
      const nextClinicType = getClinicType();
      setClinicType(nextClinicType);

      if (!clinicId || !userId) {
        setError('Unable to load profile right now.');
        setFetching(false);
        return;
      }

      try {
        const response = await authFetch(`${API_BASE_URL}/api/users/${userId}?clinicId=${clinicId}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error || 'Failed to fetch profile details.');
          return;
        }

        const formattedProfile = buildProfileState(data, nextClinicType);
        setUserData(formattedProfile);
        setNeedsCompletionPrompt(getPendingFields(formattedProfile).length > 0);
      } catch (err) {
        setError('Server error occurred.');
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, [isOpen]);

  const handleFieldChange = (field, value) => {
    setUserData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNameFieldChange = (field, value) => {
    let nextValue = value.replace(/[^a-zA-Z\s.-]/g, '');
    if (nextValue.startsWith(' ')) nextValue = nextValue.trimStart();
    nextValue = nextValue.replace(/\s\s+/g, ' ');
    handleFieldChange(field, nextValue);
  };

  const handleQualificationChange = (value) => {
    let nextValue = value.replace(/[^a-zA-Z\s,.-]/g, '');
    if (nextValue.startsWith(' ')) nextValue = nextValue.trimStart();
    nextValue = nextValue.replace(/\s\s+/g, ' ');
    handleFieldChange('qualification', nextValue);
  };

  const handleExperienceChange = (value) => {
    handleFieldChange('experience', value.replace(/\D/g, '').slice(0, 3));
  };

  const handlePhotoInput = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      handleFieldChange('avatar', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!userData.firstName.trim() || !userData.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (userData.isDoctorProfile && pendingFields.length > 0) {
      setError('Please complete the missing profile details before continuing.');
      return;
    }

    const clinicId = localStorage.getItem('clinicId');
    const userId = getSessionUser()._id;
    if (!clinicId || !userId) {
      setError('Unable to update profile right now.');
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/api/users/${userId}?clinicId=${clinicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userData.firstName,
          middleName: userData.middleName,
          lastName: userData.lastName,
          photo: userData.avatar,
          gender: userData.gender,
          address: userData.address,
          department: userData.department,
          qualification: userData.qualification,
          experience: userData.experience,
          regNo: userData.regNo
        })
      });

      const updatedData = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(updatedData.error || 'Failed to update profile.');
        return;
      }

      const formattedProfile = buildProfileState(updatedData, clinicType);
      setUserData(formattedProfile);
      setSuccess('Profile updated successfully.');
      setNeedsCompletionPrompt(false);

      const sessionUser = getSessionUser();
      const nextSessionUser = {
        ...sessionUser,
        name: updatedData.name,
        photo: formattedProfile.avatar,
        doctorId: updatedData.doctorId || sessionUser.doctorId || null
      };
      localStorage.setItem('user', JSON.stringify(nextSessionUser));
      localStorage.setItem('userName', updatedData.name || '');
      localStorage.setItem('userEmail', updatedData.email || '');
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      setError('Server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) return undefined;
    window.clearTimeout(closeTimerRef.current);
    setNeedsCompletionPrompt(false);
    setSuccess('');
    setError('');
    return undefined;
  }, [isOpen]);

  useEffect(() => () => {
    window.clearTimeout(closeTimerRef.current);
  }, []);

  const initials = `${userData.firstName?.[0] || ''}${userData.lastName?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="My Profile"
      bodyClassName="p-4 overflow-y-auto flex-1 overscroll-contain"
      panelClassName="careopd-modal-panel bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(var(--app-height)-1.5rem)] animate-scaleIn"
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 px-4 pb-4 bg-white space-y-4">
          <AlertMessage message={error} />

          {success && (
            <div className="bg-green-50 text-green-700 p-2.5 rounded-lg text-[12px] font-medium border border-green-200 animate-fadeIn">
              {success}
            </div>
          )}

          {requiresCompletion && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-[12px] text-amber-900 flex items-center justify-between gap-3 shadow-sm">
              <div className="min-w-0">
                <p className="font-bold uppercase tracking-wide">Complete Your Profile</p>
                <p className="mt-1">Fill in the missing details below to finish setting up your account.</p>
              </div>
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                  <circle
                    cx="24"
                    cy="24"
                    r={progressRadius}
                    fill="none"
                    stroke="rgb(253 230 138)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r={progressRadius}
                    fill="none"
                    stroke="rgb(13 148 136)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={progressCircumference}
                    strokeDashoffset={progressOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-teal-700">
                  {profileCompletionPercent}%
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <label className="relative group cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors">
              {userData.avatar ? (
                <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="text-teal-700 text-2xl font-bold">{initials}</div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={20} />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoInput} />
          </label>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="type-label block text-slate-600 mb-1 uppercase">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="First *"
                value={userData.firstName}
                disabled={fetching || loading}
                onChange={(event) => handleNameFieldChange('firstName', event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
              <input
                type="text"
                placeholder="Middle"
                value={userData.middleName}
                disabled={fetching || loading}
                onChange={(event) => handleNameFieldChange('middleName', event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
              <input
                type="text"
                placeholder="Last *"
                value={userData.lastName}
                disabled={fetching || loading}
                onChange={(event) => handleNameFieldChange('lastName', event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase flex items-center gap-1.5">
                <Mail size={12} /> Email Address
              </label>
              <input
                type="email"
                value={userData.email}
                disabled
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase flex items-center gap-1.5">
                <Phone size={12} /> Mobile Number
              </label>
              <input
                type="tel"
                value={userData.phone}
                disabled
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase flex items-center gap-1.5">
                <Shield size={12} /> Role
              </label>
              <div className="type-body w-full p-2 border border-indigo-100 bg-indigo-50 rounded-lg text-indigo-700 font-bold truncate">
                {userData.role || 'User'}
              </div>
            </div>

            <div>
              <label className="type-label block text-slate-600 mb-1 uppercase">
                Gender
              </label>
              <select
                value={userData.gender}
                disabled={fetching || loading}
                onChange={(event) => handleFieldChange('gender', event.target.value)}
                className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
              >
                {!userData.isDoctorProfile && <option value="">Select gender</option>}
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>

          {userData.isDoctorProfile && (
            <>
              <div>
                <label className="type-label block text-slate-600 mb-1 uppercase">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full residential address"
                  value={userData.address}
                  disabled={fetching || loading}
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                  className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="type-label block text-slate-600 mb-1 uppercase flex items-center gap-1.5">
                    <Stethoscope size={12} /> Specialization <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General Medicine"
                    value={userData.department}
                    disabled={fetching || loading}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (NAME_REGEX.test(value)) handleFieldChange('department', value);
                    }}
                    className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="type-label block text-slate-600 mb-1 uppercase">
                    Qualification <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD"
                    value={userData.qualification}
                    disabled={fetching || loading}
                    onChange={(event) => handleQualificationChange(event.target.value)}
                    className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="type-label block text-slate-600 mb-1 uppercase">
                    Experience in Months <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Months"
                    value={userData.experience}
                    disabled={fetching || loading}
                    onChange={(event) => handleExperienceChange(event.target.value)}
                    className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="type-label block text-slate-600 mb-1 uppercase">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Medical registration number"
                    value={userData.regNo}
                    disabled={fetching || loading}
                    onChange={(event) => handleFieldChange('regNo', event.target.value)}
                    className="type-body w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </>
          )}

            <button
              type="submit"
              disabled={loading || fetching}
              className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-[13px] font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Save size={14} /> Update Profile
                </>
              )}
            </button>
        </form>
      </div>
    </Modal>
  );
};

export default MyProfileModal;

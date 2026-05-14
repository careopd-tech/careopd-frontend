export const getSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    return {};
  }
};

export const getAuthToken = () => localStorage.getItem('token') || '';

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const authFetch = (url, options = {}) => {
  const headers = getAuthHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
};

export const updateSessionFromAuth = ({ user, token }) => {
  if (!user) return;

  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('clinicId', user.clinicId?._id || user.clinicId || '');
  localStorage.setItem('userName', user.name || '');
  localStorage.setItem('userEmail', user.email || '');
  localStorage.setItem('userRole', user.role || 'admin');

  if (user.doctorId) {
    localStorage.setItem('doctorId', user.doctorId);
  } else {
    localStorage.removeItem('doctorId');
  }

  if (token) {
    localStorage.setItem('token', token);
  }
};

export const clearSession = () => {
  localStorage.clear();
};

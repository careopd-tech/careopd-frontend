import API_BASE_URL from '../config';

export const getSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    return {};
  }
};

let accessToken = '';

export const getAuthToken = () => accessToken;

export const SESSION_EXPIRED_EVENT = 'careopd:session-expired';

let sessionExpiryNotified = false;
let refreshRequest = null;

const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

const notifySessionExpired = () => {
  if (sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
    detail: { message: 'Your session has expired. Please sign in again.' }
  }));
};

const getTokenExpiryTime = () => {
  try {
    const segment = getAuthToken().split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedSegment = segment.padEnd(Math.ceil(segment.length / 4) * 4, '=');
    const payload = JSON.parse(atob(paddedSegment));
    return Number(payload.exp || 0) * 1000;
  } catch (err) {
    return 0;
  }
};

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const refreshSession = async ({ onlyIfExpiring = false } = {}) => {
  const expiresAt = getTokenExpiryTime();
  if (onlyIfExpiring && expiresAt > Date.now() + REFRESH_LEEWAY_MS) {
    return null;
  }

  if (!refreshRequest) {
    refreshRequest = fetch(`${AUTH_API_URL}/refresh`, {
      method: 'POST',
      credentials: 'include'
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.user || !result.token) {
        throw new Error(result.error || 'Your session has expired. Please sign in again.');
      }
      updateSessionFromAuth(result);
      return result;
    }).finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
};

export const authFetch = async (url, options = {}) => {
  const requestOptions = {
    ...options,
    credentials: 'include',
    headers: getAuthHeaders(options.headers || {})
  };
  const response = await fetch(url, requestOptions);
  if (response.status !== 401) return response;

  try {
    await refreshSession();
    const retryResponse = await fetch(url, {
      ...requestOptions,
      headers: getAuthHeaders(options.headers || {})
    });
    if (retryResponse.status === 401) {
      notifySessionExpired();
    }
    return retryResponse;
  } catch (err) {
    notifySessionExpired();
    return response;
  }
};

export const maintainActiveSession = async () => {
  try {
    return await refreshSession({ onlyIfExpiring: true });
  } catch (err) {
    notifySessionExpired();
    return null;
  }
};

export const logoutSession = async () => {
  try {
    await fetch(`${AUTH_API_URL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } finally {
    clearSession();
  }
};

export const updateSessionFromAuth = ({ user, token }) => {
  if (!user) return;

  sessionExpiryNotified = false;
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
    accessToken = token;
    localStorage.removeItem('token');
  }
};

export const clearSession = () => {
  accessToken = '';
  sessionExpiryNotified = false;
  localStorage.clear();
};

export const AUTH_STORAGE_KEYS = {
  isLoggedIn: 'isLoggedIn',
  currentUser: 'current_user',
  currentUserInfo: 'current_user_info',
};

export const getStoredIsLoggedIn = () => localStorage.getItem(AUTH_STORAGE_KEYS.isLoggedIn) === 'true';

export const getStoredCurrentUser = () => localStorage.getItem(AUTH_STORAGE_KEYS.currentUser) || '';

export const getStoredCurrentUserInfo = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.currentUserInfo);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const persistAuthState = (user) => {
  const username = typeof user === 'string' ? user : user?.username || '';
  const userInfo = typeof user === 'string' ? { username: user } : user || null;

  localStorage.setItem(AUTH_STORAGE_KEYS.isLoggedIn, 'true');
  localStorage.setItem(AUTH_STORAGE_KEYS.currentUser, username);
  if (userInfo) {
    localStorage.setItem(AUTH_STORAGE_KEYS.currentUserInfo, JSON.stringify(userInfo));
  }
};

export const clearAuthState = () => {
  localStorage.removeItem(AUTH_STORAGE_KEYS.isLoggedIn);
  localStorage.removeItem(AUTH_STORAGE_KEYS.currentUser);
  localStorage.removeItem(AUTH_STORAGE_KEYS.currentUserInfo);
};

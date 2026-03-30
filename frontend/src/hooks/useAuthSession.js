import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCurrentUser, logoutRequest } from '../lib/api';
import {
  clearAuthState,
  getStoredCurrentUser,
  getStoredCurrentUserInfo,
  getStoredIsLoggedIn,
  persistAuthState,
} from '../lib/authStorage';

const DEFAULT_LOGOUT_TIMEOUT = 30 * 60 * 1000;

export function useAuthSession(logoutTimeout = DEFAULT_LOGOUT_TIMEOUT) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => getStoredIsLoggedIn());
  const [currentUser, setCurrentUser] = useState(() => getStoredCurrentUser());
  const [currentUserInfo, setCurrentUserInfo] = useState(() => getStoredCurrentUserInfo());
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const logoutTimerRef = useRef(null);

  const applyCurrentUser = useCallback((user) => {
    const username = typeof user === 'string' ? user : user?.username || '';
    const userInfo = typeof user === 'string' ? { username: user } : user || null;

    if (userInfo) {
      persistAuthState(userInfo);
    }
    setIsLoggedIn(Boolean(username));
    setCurrentUser(username);
    setCurrentUserInfo(userInfo);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (e) {}

    clearAuthState();
    setIsLoggedIn(false);
    setCurrentUser('');
    setCurrentUserInfo(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const res = await fetchCurrentUser();
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.user?.username) {
      applyCurrentUser(data.user);
      return data.user;
    }

    clearAuthState();
    setIsLoggedIn(false);
    setCurrentUser('');
    setCurrentUserInfo(null);
    return null;
  }, [applyCurrentUser]);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      try {
        const user = await refreshCurrentUser();
        if (!active && user) return;
      } catch {
        if (!active) return;
        clearAuthState();
        setIsLoggedIn(false);
        setCurrentUser('');
        setCurrentUserInfo(null);
      } finally {
        if (active) setIsAuthChecking(false);
      }
    };

    bootstrapSession();

    return () => {
      active = false;
    };
  }, [refreshCurrentUser]);

  const resetLogoutTimer = useCallback(() => {
    if (!isLoggedIn) return;
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      alert('由于长时间未操作，系统已自动退出登录。');
      handleLogout();
    }, logoutTimeout);
  }, [handleLogout, isLoggedIn, logoutTimeout]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((eventName) => window.addEventListener(eventName, resetLogoutTimer));
    resetLogoutTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetLogoutTimer));
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [isLoggedIn, resetLogoutTimer]);

  const completeLogin = useCallback((user) => {
    applyCurrentUser(user);
  }, [applyCurrentUser]);

  const updateCurrentUserInfo = useCallback((user) => {
    applyCurrentUser(user);
  }, [applyCurrentUser]);

  return {
    isLoggedIn,
    currentUser,
    currentUserInfo,
    isAuthChecking,
    handleLogout,
    completeLogin,
    refreshCurrentUser,
    updateCurrentUserInfo,
  };
}

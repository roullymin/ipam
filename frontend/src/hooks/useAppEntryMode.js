import { useCallback, useEffect, useState } from 'react';

const DEFAULT_TAB = 'dashboard';

const readRoute = () => {
  if (typeof window === 'undefined') {
    return {
      activeTab: DEFAULT_TAB,
      isResidentIntakeMode: false,
      isChangeRequestIntakeMode: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    activeTab: params.get('view') || DEFAULT_TAB,
    isResidentIntakeMode: params.get('resident-intake') === '1',
    isChangeRequestIntakeMode: params.get('change-request-intake') === '1',
  };
};

export function useAppRouter() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(readRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveTab = useCallback((nextTab, options = {}) => {
    const tab = typeof nextTab === 'function' ? nextTab(readRoute().activeTab) : nextTab;
    if (!tab) return;

    setRoute((previous) => ({ ...previous, activeTab: tab }));
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('view', tab);
    const method = options?.replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', url);
  }, []);

  return {
    ...route,
    setActiveTab,
  };
}

export function useAppEntryMode() {
  const {
    isResidentIntakeMode,
    isChangeRequestIntakeMode,
  } = useAppRouter();
  return {
    isResidentIntakeMode,
    isChangeRequestIntakeMode,
  };
}

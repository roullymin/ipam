import { useMemo } from 'react';

export function useAppEntryMode() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        isResidentIntakeMode: false,
        isChangeRequestIntakeMode: false,
        isDcOverviewMode: false,
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      isResidentIntakeMode: params.get('resident-intake') === '1',
      isChangeRequestIntakeMode: params.get('change-request-intake') === '1',
      isDcOverviewMode: params.get('dc-overview') === '1',
    };
  }, []);
}

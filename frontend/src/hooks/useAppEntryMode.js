import { useMemo } from 'react';

export function useAppEntryMode() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        isResidentIntakeMode: false,
        isChangeRequestIntakeMode: false,
        isDcOverviewMode: false,
        isDcElevationMode: false,
      };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      isResidentIntakeMode: params.get('resident-intake') === '1',
      isChangeRequestIntakeMode: params.get('change-request-intake') === '1',
      isDcOverviewMode: params.get('dc-overview') === '1',
      isDcElevationMode: params.get('dc-elevation') === '1',
    };
  }, []);
}

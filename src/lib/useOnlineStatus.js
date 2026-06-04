import { useState, useEffect, useCallback } from 'react';

export const useOnlineStatus = (onStatusChange) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (onStatusChange) onStatusChange(true);
  }, [onStatusChange]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    if (onStatusChange) onStatusChange(false);
  }, [onStatusChange]);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
};

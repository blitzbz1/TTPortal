import { useContext } from 'react';
import { NotificationContext } from '../contexts/NotificationProvider';
import type { NotificationContextValue } from '../contexts/NotificationProvider';

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

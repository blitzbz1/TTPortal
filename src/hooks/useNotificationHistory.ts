import { useNotifications } from './useNotifications';
import type { NotificationContextValue, NotificationRecord } from '../contexts/NotificationProvider';

export type { NotificationRecord };
export { PAGE_SIZE } from '../contexts/NotificationProvider';

export type UseNotificationHistoryReturn = NotificationContextValue;

export function useNotificationHistory(): UseNotificationHistoryReturn {
  return useNotifications();
}

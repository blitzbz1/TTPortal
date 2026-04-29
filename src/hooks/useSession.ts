import { useContext } from 'react';
import {
  SessionContext,
  type SessionContextValue,
} from '../contexts/SessionProvider';

/**
 * Hook to access the session/auth context.
 * Must be used within a SessionProvider.
 * @returns The session context value with auth state and methods.
 * @throws {Error} If used outside of a SessionProvider.
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

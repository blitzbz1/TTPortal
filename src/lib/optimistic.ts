import { logger } from './logger';

export interface OptimisticOptions<T> {
  setState: (next: T | ((prev: T) => T)) => void;
  current: T;
  next: T | ((prev: T) => T);
  mutate: () => Promise<{ error?: { message: string } | null } | { error?: unknown } | void>;
  onError?: (err: unknown) => void;
}

export async function withOptimistic<T>(opts: OptimisticOptions<T>): Promise<boolean> {
  const { setState, current, next, mutate, onError } = opts;
  setState(next);
  try {
    const result = await mutate();
    const error = (result as { error?: unknown } | void)?.error;
    if (error) {
      setState(current);
      onError?.(error);
      logger.warn('withOptimistic: mutation failed, rolling back', { error });
      return false;
    }
    return true;
  } catch (err) {
    setState(current);
    onError?.(err);
    logger.warn('withOptimistic: threw, rolling back', err as Record<string, unknown>);
    return false;
  }
}

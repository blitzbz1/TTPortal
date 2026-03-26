type LogData = Record<string, unknown>;

/**
 * Structured logger for the application.
 * Wraps console methods with consistent formatting.
 * In production, these could be routed to a remote logging service.
 */
export const logger = {
  /** Dev-only verbose details. */
  debug(msg: string, data?: LogData): void {
    if (__DEV__) console.debug(`[DEBUG] ${msg}`, data ?? '');
  },

  /** Business events (user signed in, session restored). */
  info(msg: string, data?: LogData): void {
    console.info(`[INFO] ${msg}`, data ?? '');
  },

  /** Recoverable issues (retry succeeded, fallback used). */
  warn(msg: string, data?: LogData): void {
    console.warn(`[WARN] ${msg}`, data ?? '');
  },

  /** Failures requiring attention. */
  error(msg: string, error: unknown, data?: LogData): void {
    console.error(`[ERROR] ${msg}`, error, data ?? '');
  },

  /** User actions for analytics. */
  track(event: string, data?: LogData): void {
    if (__DEV__) console.info(`[TRACK] ${event}`, data ?? '');
  },
};

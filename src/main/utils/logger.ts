// Logger utility that respects NODE_ENV
// In production, only errors are logged to avoid console noise

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

export const logger = {
  log: (...args: unknown[]) => isDev && console.log('[FeedbackFlow]', ...args),
  warn: (...args: unknown[]) => isDev && console.warn('[FeedbackFlow]', ...args),
  error: (...args: unknown[]) => console.error('[FeedbackFlow Error]', ...args),
}

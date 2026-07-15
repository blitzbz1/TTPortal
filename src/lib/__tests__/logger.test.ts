// @ts-expect-error -- __DEV__ is set globally by React Native runtime
globalThis.__DEV__ = true;

 
import { logger } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debug logs with [DEBUG] prefix in dev mode', () => {
    logger.debug('test message', { key: 'value' });
    expect(console.debug).toHaveBeenCalledWith('[DEBUG] test message', { key: 'value' });
  });

  it('debug logs with empty string when no data provided', () => {
    logger.debug('msg');
    expect(console.debug).toHaveBeenCalledWith('[DEBUG] msg', '');
  });

  it('info logs with [INFO] prefix', () => {
    logger.info('user signed in', { email: 'a@b.com' });
    expect(console.info).toHaveBeenCalledWith('[INFO] user signed in', { email: 'a@b.com' });
  });

  it('warn logs with [WARN] prefix', () => {
    logger.warn('retry succeeded');
    expect(console.warn).toHaveBeenCalledWith('[WARN] retry succeeded', '');
  });

  it('error logs with [ERROR] prefix and error object', () => {
    const err = new Error('oops');
    logger.error('failed', err, { context: 'auth' });
    expect(console.error).toHaveBeenCalledWith('[ERROR] failed', err, { context: 'auth' });
  });

  it('track logs with [TRACK] prefix in dev mode', () => {
    logger.track('button_pressed', { button: 'login' });
    expect(console.info).toHaveBeenCalledWith('[TRACK] button_pressed', { button: 'login' });
  });
});

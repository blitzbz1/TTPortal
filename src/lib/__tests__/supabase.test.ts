jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import { supabase } from '../supabase';

describe('supabase client', () => {
  it('exports a valid Supabase client object', () => {
    expect(typeof supabase).toBe('object');
    expect(supabase).not.toBeNull();
  });

  it('has an auth property with expected methods', () => {
    expect(typeof supabase.auth).toBe('object');
    expect(typeof supabase.auth.signUp).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
    expect(typeof supabase.auth.signOut).toBe('function');
    expect(typeof supabase.auth.onAuthStateChange).toBe('function');
    expect(typeof supabase.auth.resetPasswordForEmail).toBe('function');
    expect(typeof supabase.auth.signInWithIdToken).toBe('function');
  });

  it('has a from method for database queries', () => {
    expect(typeof supabase.from).toBe('function');
  });
});

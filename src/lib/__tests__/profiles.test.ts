import * as fs from 'fs';
import * as path from 'path';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/001_create_profiles.sql'
);

describe('profiles migration SQL', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('migration file exists at supabase/migrations/001_create_profiles.sql', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('creates the public.profiles table', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.profiles/);
  });

  it('defines id as UUID primary key referencing auth.users', () => {
    expect(sql).toMatch(
      /id\s+UUID\s+PRIMARY KEY\s+REFERENCES\s+auth\.users\(id\)/
    );
  });

  it('defines full_name as TEXT NOT NULL', () => {
    expect(sql).toMatch(/full_name\s+TEXT\s+NOT NULL/);
  });

  it('defines email as TEXT UNIQUE', () => {
    expect(sql).toMatch(/email\s+TEXT\s+UNIQUE/);
  });

  it('defines avatar_url as nullable TEXT', () => {
    expect(sql).toMatch(/avatar_url\s+TEXT/);
    // Ensure no NOT NULL constraint on avatar_url
    expect(sql).not.toMatch(/avatar_url\s+TEXT\s+NOT NULL/);
  });

  it('defines city as nullable TEXT', () => {
    expect(sql).toMatch(/city\s+TEXT/);
    expect(sql).not.toMatch(/city\s+TEXT\s+NOT NULL/);
  });

  it("defines lang as TEXT NOT NULL with default 'ro'", () => {
    expect(sql).toMatch(/lang\s+TEXT\s+NOT NULL\s+DEFAULT\s+'ro'/);
  });

  it('defines auth_provider as TEXT NOT NULL', () => {
    expect(sql).toMatch(/auth_provider\s+TEXT\s+NOT NULL/);
  });

  it('defines created_at as TIMESTAMPTZ with default now()', () => {
    expect(sql).toMatch(
      /created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+now\(\)/
    );
  });

  it('enables Row Level Security on profiles', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.profiles ENABLE ROW LEVEL SECURITY/
    );
  });

  it('creates handle_new_user trigger function', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/
    );
    expect(sql).toMatch(/RETURNS TRIGGER/);
    expect(sql).toMatch(/LANGUAGE plpgsql SECURITY DEFINER/);
  });

  it('trigger inserts into profiles with id, full_name, email, auth_provider', () => {
    expect(sql).toMatch(/INSERT INTO public\.profiles\s*\(id,\s*full_name,\s*email,\s*auth_provider\)/);
    expect(sql).toMatch(/NEW\.id/);
    expect(sql).toMatch(/NEW\.email/);
    expect(sql).toMatch(/NEW\.raw_user_meta_data\s*->>\s*'full_name'/);
    expect(sql).toMatch(/NEW\.raw_user_meta_data\s*->>\s*'auth_provider'/);
  });

  it('creates on_auth_user_created trigger on auth.users', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER on_auth_user_created/
    );
    expect(sql).toMatch(/AFTER INSERT ON auth\.users/);
    expect(sql).toMatch(/EXECUTE FUNCTION public\.handle_new_user\(\)/);
  });

  it('uses ON DELETE CASCADE for foreign key', () => {
    expect(sql).toMatch(/REFERENCES\s+auth\.users\(id\)\s+ON DELETE CASCADE/);
  });
});

describe('Supabase auth config supports session refresh', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('../supabase');

  it('supabase client is configured with autoRefreshToken enabled', () => {
    // The Supabase client constructor accepts auth.autoRefreshToken.
    // We verify the client was created (it wouldn't start auto-refresh
    // without this option). The source file sets autoRefreshToken: true.
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, '../supabase.ts'),
      'utf-8'
    );
    expect(sourceCode).toMatch(/autoRefreshToken:\s*true/);
  });

  it('supabase client is configured with persistSession enabled', () => {
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, '../supabase.ts'),
      'utf-8'
    );
    expect(sourceCode).toMatch(/persistSession:\s*true/);
  });

  it('supabase client has auth methods needed for session management', () => {
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.auth.refreshSession).toBe('function');
    expect(typeof supabase.auth.onAuthStateChange).toBe('function');
  });

  it('supabase config.toml specifies JWT expiry and refresh token rotation', () => {
    const configPath = path.resolve(
      __dirname,
      '../../../supabase/config.toml'
    );
    const config = fs.readFileSync(configPath, 'utf-8');
    expect(config).toMatch(/jwt_expiry\s*=\s*3600/);
    expect(config).toMatch(/refresh_token_rotation_enabled\s*=\s*true/);
  });
});

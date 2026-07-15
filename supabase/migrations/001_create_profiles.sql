-- Migration: 001_create_profiles
-- Creates the public.profiles table and auto-creation trigger for new auth users.

-- Profiles table stores app-specific user data alongside Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  city TEXT,
  lang TEXT NOT NULL DEFAULT 'ro',
  auth_provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (policies added in a future migration).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger function: auto-create a profile row when a new auth user signs up.
-- Extracts full_name and auth_provider from user metadata set during registration.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, auth_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'auth_provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users table.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

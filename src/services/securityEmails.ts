import { supabase } from '../lib/supabase';

type PasswordChangedEmailResponse = {
  success?: boolean;
  error?: string;
  code?: string;
};

type PasswordChangedEmailResult = {
  data: PasswordChangedEmailResponse | null;
  error: { message: string; code?: string; status?: number } | null;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const passwordChangedEndpoint = `${supabaseUrl}/functions/v1/send-password-changed-email`;

function parseFunctionResponse(rawText: string): PasswordChangedEmailResponse | null {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText) as PasswordChangedEmailResponse;
  } catch {
    return { error: rawText };
  }
}

export async function sendPasswordChangedEmail(): Promise<PasswordChangedEmailResult> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      data: null,
      error: {
        message: 'Unauthorized',
        code: 'unauthorized',
        status: 401,
      },
    };
  }

  const response = await fetch(passwordChangedEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const rawText = await response.text();
  const payload = parseFunctionResponse(rawText);

  if (!response.ok) {
    return {
      data: payload,
      error: {
        message: payload?.error ?? `HTTP ${response.status}`,
        code: payload?.code,
        status: response.status,
      },
    };
  }

  return {
    data: payload,
    error: null,
  };
}

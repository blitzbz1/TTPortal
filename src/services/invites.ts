import { supabase } from '../lib/supabase';

type InviteFunctionResponse = {
  success?: boolean;
  error?: string;
  code?: string;
};

type InviteFunctionResult = {
  data: InviteFunctionResponse | null;
  error: { message: string; code?: string; status?: number } | null;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const inviteEndpoint = `${supabaseUrl}/functions/v1/send-app-invite`;

function parseInviteResponse(rawText: string): InviteFunctionResponse | null {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText) as InviteFunctionResponse;
  } catch {
    return { error: rawText };
  }
}

export async function sendAppInviteEmail(email: string): Promise<InviteFunctionResult> {
  const normalizedEmail = email.trim().toLowerCase();
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

  const response = await fetch(inviteEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const rawText = await response.text();
  const payload = parseInviteResponse(rawText);

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

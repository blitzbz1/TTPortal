import { supabase } from '../lib/supabase';

export type UserFeedbackCategory = 'bug' | 'feature' | 'general';

export interface SubmitUserFeedbackInput {
  userId: string;
  userEmail: string | null;
  page: string;
  category: UserFeedbackCategory;
  message: string;
  /** Only used when category === 'feature'. Falls back to the first line of message. */
  featureTitle?: string;
}

/**
 * Route feedback to the appropriate table:
 * - bug/general → public.user_feedback
 * - feature     → public.feature_requests (existing board with voting)
 */
export async function submitUserFeedback(input: SubmitUserFeedbackInput) {
  const { userId, userEmail, page, category, message, featureTitle } = input;
  const trimmed = message.trim();

  if (category === 'feature') {
    const title = (featureTitle?.trim() || trimmed.split('\n')[0] || '').slice(0, 200);
    return supabase
      .from('feature_requests')
      .insert({
        title,
        description: trimmed,
        category: 'General',
        author_id: userId,
        author_email: userEmail,
      })
      .select()
      .single();
  }

  return supabase
    .from('user_feedback')
    .insert({
      user_id: userId,
      page,
      category,
      message: trimmed,
    })
    .select()
    .single();
}

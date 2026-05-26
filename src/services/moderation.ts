import { supabase } from '../lib/supabase';

export type ReportContentType =
  | 'review'
  | 'venue'
  | 'checkin'
  | 'photo'
  | 'profile';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'misinformation'
  | 'other';

/**
 * Submit a moderation report for a piece of UGC. Same user reporting the
 * same item twice updates the existing row instead of creating a duplicate.
 */
export async function reportContent(
  contentType: ReportContentType,
  contentId: string | number,
  reason: ReportReason,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('report_content', {
    p_content_type: contentType,
    p_content_id: String(contentId),
    p_reason: reason,
    p_notes: notes ?? null,
  });
  return { data: data as number | null, error };
}

export async function blockUser(targetUserId: string) {
  return supabase.rpc('block_user', { p_target_id: targetUserId });
}

export async function unblockUser(targetUserId: string) {
  return supabase.rpc('unblock_user', { p_target_id: targetUserId });
}

export type BlockedUser = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

export async function getBlockedUsers() {
  const { data, error } = await supabase.rpc('get_blocked_users');
  return { data: (data as BlockedUser[] | null) ?? [], error };
}

export type ContentReport = {
  id: number;
  reporter_id: string;
  content_type: ReportContentType;
  content_id: string;
  reason: ReportReason;
  notes: string | null;
  created_at: string;
};

/**
 * Admin-only: list unresolved content reports. Returns empty list to
 * non-admins because RLS on content_reports limits SELECT to admin
 * profiles (plus reporter-self).
 */
export async function getUnresolvedReports() {
  const { data, error } = await supabase
    .from('content_reports')
    .select('id, reporter_id, content_type, content_id, reason, notes, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  return { data: (data as ContentReport[] | null) ?? [], error };
}

export async function resolveReport(reportId: number, resolution: string) {
  return supabase
    .from('content_reports')
    .update({ resolved_at: new Date().toISOString(), resolution })
    .eq('id', reportId);
}

import { supabase } from '../lib/supabase';

export type ChallengeCategory =
  | 'craft_player'
  | 'spin_artist'
  | 'first_attack_burst'
  | 'footwork_engine'
  | 'table_guardian'
  | 'serve_lab'
  | 'competitor'
  | 'explorer';

export type VerificationType = 'self' | 'other';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';
export type BadgeLevel = 'none' | 'bronze' | 'silver' | 'gold' | 'master';

export interface DbChallenge {
  id: string;
  code: string;
  legacy_code: string | null;
  title_key: string | null;
  category: ChallengeCategory;
  title: string;
  description: string | null;
  verification_type: VerificationType;
  requires_proof: boolean;
}

export interface UserBadgeProgress {
  id: string;
  user_id: string;
  category: ChallengeCategory;
  completed_count: number;
  approved_count: number;
  xp: number;
  badge_level: BadgeLevel;
  last_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeSubmission {
  id: string;
  user_id: string;
  challenge_id: string;
  assignment_id: string | null;
  event_id: number | null;
  status: SubmissionStatus;
  verification_type: VerificationType;
  occurred_at: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  proof_text: string | null;
  proof_urls: unknown[];
  notes: string | null;
  auto_review_reason: string | null;
  reviewer_user_id: string | null;
  metadata: Record<string, unknown>;
}

export interface PendingChallengeValidation {
  validation_id: string;
  submission_id: string;
  submitter_user_id: string;
  submitter_name: string;
  challenge_id: string;
  challenge_code: string;
  challenge_legacy_code: string | null;
  challenge_title_key: string | null;
  challenge_title: string;
  category: ChallengeCategory;
  event_id: number | null;
  event_title: string | null;
  created_at: string;
}

export interface EventChallengeSubmission {
  submission_id: string;
  submitter_user_id: string;
  submitter_name: string;
  challenge_id: string;
  challenge_code: string;
  challenge_legacy_code: string | null;
  challenge_title_key: string | null;
  challenge_title: string;
  category: ChallengeCategory;
  status: SubmissionStatus;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface ApprovedChallengeCompletion {
  id: string;
  challenge_id: string;
  event_id: number | null;
  status: Extract<SubmissionStatus, 'approved' | 'auto_approved'>;
  submitted_at: string;
  reviewed_at: string | null;
  challenges: {
    category: ChallengeCategory;
  } | { category: ChallengeCategory }[] | null;
}

export interface BadgeAward {
  id: string;
  user_id: string;
  category: ChallengeCategory;
  tier: Extract<BadgeLevel, 'bronze' | 'silver' | 'gold'>;
  completed_count: number;
  awarded_at: string;
  source_submission_id: string | null;
  created_at: string;
}

export async function getMonthlyStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [checkinsRes, reviewsRes] = await Promise.all([
    supabase
      .from('checkins')
      .select('venue_id')
      .eq('user_id', userId)
      .gte('started_at', startOfMonth),
    supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth),
  ]);

  const checkins = checkinsRes.data ?? [];
  const uniqueVenues = new Set(checkins.map((c) => c.venue_id));

  return {
    monthCheckins: checkins.length,
    monthVenues: uniqueVenues.size,
    monthReviews: (reviewsRes.data ?? []).length,
  };
}

export async function getChallengeChoices(category: ChallengeCategory, limitCount = 4) {
  return supabase.rpc('get_challenge_choices', {
    v_category: category,
    v_limit_count: limitCount,
  });
}

export async function getUserBadgeProgress(userId: string) {
  return supabase
    .from('user_badge_progress')
    .select('*')
    .eq('user_id', userId);
}

export async function getChallengeById(challengeId: string) {
  return supabase
    .from('challenges')
    .select('id, code, legacy_code, title_key, category, title, description, verification_type, requires_proof')
    .eq('id', challengeId)
    .single();
}

export async function getUserPendingChallengeSubmissions(userId: string) {
  return supabase
    .from('challenge_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');
}

export async function getUserApprovedChallengeCompletions(userId: string) {
  return supabase
    .from('challenge_submissions')
    .select('id, challenge_id, event_id, status, submitted_at, reviewed_at, challenges(category)')
    .eq('user_id', userId)
    .in('status', ['approved', 'auto_approved'])
    .order('submitted_at', { ascending: true });
}

export async function getUserBadgeAwards(userId: string) {
  return supabase
    .from('badge_awards')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: true });
}

export async function createChallengeSubmission(input: {
  userId: string;
  challengeId: string;
  verificationType: VerificationType;
  eventId?: number | null;
  metadata?: Record<string, unknown>;
}) {
  return supabase
    .from('challenge_submissions')
    .insert({
      user_id: input.userId,
      challenge_id: input.challengeId,
      verification_type: input.verificationType,
      event_id: input.eventId ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
}

export async function addChallengeToEvent(eventId: number, challengeId: string) {
  return supabase.rpc('add_challenge_to_event', {
    v_event_id: eventId,
    v_challenge_id: challengeId,
  });
}

export async function completeSelfChallenge(challengeId: string) {
  return supabase.rpc('complete_self_challenge', {
    v_challenge_id: challengeId,
  });
}

export async function approveSelfSubmission(submissionId: string) {
  return supabase.rpc('approve_self_submission', {
    v_submission_id: submissionId,
  });
}

export async function requestOtherPlayerValidation(submissionId: string, validatorUserId: string) {
  return supabase.rpc('request_other_player_validation', {
    v_submission_id: submissionId,
    v_validator_user_id: validatorUserId,
  });
}

export async function getPendingChallengeValidations() {
  return supabase.rpc('get_pending_challenge_validations');
}

export async function respondToChallengeValidation(
  submissionId: string,
  status: 'approved' | 'rejected',
  comment?: string,
) {
  return supabase.rpc('respond_to_validation', {
    v_submission_id: submissionId,
    v_status: status,
    v_comment: comment ?? null,
  });
}

export async function getEventChallengeSubmissions(eventId: number) {
  return supabase.rpc('get_event_challenge_submissions', {
    v_event_id: eventId,
  });
}

export async function awardEventChallengeSubmission(submissionId: string) {
  return supabase.rpc('award_event_challenge_submission', {
    v_submission_id: submissionId,
  });
}

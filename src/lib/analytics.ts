import { logger } from './logger';
import { trackEvent } from './telemetry';

type AnalyticsData = Record<string, unknown>;

/**
 * Product analytics (T081). Dev: console via logger.track. Prod: batched to
 * the ingest-telemetry Edge Function → Grafana Loki (existing stack — no
 * third-party analytics SDK). Honors the GDPR opt-out inside trackEvent.
 *
 * Event schema convention: snake_case names; flat data payloads with ids
 * only (no names/emails — the telemetry scrubber also enforces this).
 */
export function trackProductEvent(event: string, data?: AnalyticsData) {
  logger.track(event, data);
  if (!__DEV__) trackEvent(event, data);
}

export const ProductEvents = {
  // Challenges
  challengeSelected: 'challenge_selected',
  challengeCompleted: 'challenge_completed',
  challengeInviteStarted: 'challenge_invite_started',
  // Events funnel
  eventOpened: 'event_opened',
  eventJoined: 'event_joined',
  eventCreated: 'event_created',
  eventChallengeAttached: 'event_challenge_attached',
  eventChallengeAwarded: 'event_challenge_awarded',
  // Map → check-in funnel (T081)
  mapVenueOpened: 'map_venue_opened',
  mapNearMeToggled: 'map_near_me_toggled',
  checkinCompleted: 'checkin_completed',
  checkinQueuedOffline: 'checkin_queued_offline',
  // Acquisition / retention markers (T081)
  signupCompleted: 'signup_completed',
  onboardingCompleted: 'onboarding_completed',
  sessionStart: 'session_start',
  // Content + sharing
  reviewSubmitted: 'review_submitted',
  favoriteToggled: 'favorite_toggled',
  shareInitiated: 'share_initiated',
  profileChallengeCtaPressed: 'profile_challenge_cta_pressed',
} as const;

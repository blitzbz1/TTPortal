import { logger } from './logger';

type AnalyticsData = Record<string, unknown>;

export function trackProductEvent(event: string, data?: AnalyticsData) {
  logger.track(event, data);
}

export const ProductEvents = {
  challengeSelected: 'challenge_selected',
  challengeCompleted: 'challenge_completed',
  challengeInviteStarted: 'challenge_invite_started',
  eventOpened: 'event_opened',
  eventJoined: 'event_joined',
  eventChallengeAttached: 'event_challenge_attached',
  eventChallengeAwarded: 'event_challenge_awarded',
  mapVenueOpened: 'map_venue_opened',
  mapNearMeToggled: 'map_near_me_toggled',
  profileChallengeCtaPressed: 'profile_challenge_cta_pressed',
} as const;

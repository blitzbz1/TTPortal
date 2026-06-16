// F063: coach directory domain barrel.
export {
  applyToCoach,
  getCoachProfile,
  getVenueCoaches,
  getCoachingVenueIds,
} from '../../services/coaches';
export {
  useCoachProfileQuery,
  coachProfileQueryKey,
} from './hooks/useCoachProfileQuery';
export {
  useVenueCoachesQuery,
  venueCoachesQueryKey,
} from './hooks/useVenueCoachesQuery';
export {
  useCoachingVenueIdsQuery,
  coachingVenueIdsQueryKey,
} from './hooks/useCoachingVenueIdsQuery';
export type {
  CoachProfile,
  CoachStatus,
  CoachApplicationInput,
  VenueCoach,
} from '../../types/database';

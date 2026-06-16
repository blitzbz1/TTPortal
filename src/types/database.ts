import type { SkillLevel, PlayGoal } from '../lib/playerAttributes';

// ── Table row types ──

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  lang: string;
  auth_provider: string | null;
  created_at: string;
  username: string | null;
  is_admin: boolean;
  is_moderator: boolean;
  skill_level: SkillLevel | null;
  play_goals: PlayGoal[];
  home_venue_id: number | null;
  show_as_regular: boolean;
}

export interface City {
  id: number;
  name: string;
  county: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  venue_count: number | null;
  active: boolean;
}

export type VenueType = 'parc_exterior' | 'sala_indoor';
export type VenueCondition =
  | 'buna'
  | 'acceptabila'
  | 'deteriorata'
  | 'necunoscuta'
  | 'profesionala';

export interface Venue {
  id: number;
  name: string;
  type: VenueType;
  city: string;
  city_id: number;
  county: string | null;
  sector: string | null;
  address: string;
  lat: number;
  lng: number;
  tables_count: number | null;
  condition: VenueCondition | null;
  hours: string | null;
  description: string | null;
  tags: string[] | null;
  photos: string[] | null;
  free_access: boolean | null;
  night_lighting: boolean | null;
  nets: boolean | null;
  verified: boolean;
  tariff: string | null;
  website: string | null;
  submitted_by: string | null;
  approved: boolean;
  created_at: string;
}

export interface Review {
  id: number;
  venue_id: number;
  user_id: string;
  reviewer_name: string | null;
  rating: number;
  body: string;
  flagged: boolean;
  flag_count: number;
  created_at: string;
}

export interface Favorite {
  id: number;
  user_id: string;
  venue_id: number;
  created_at: string;
}

export interface Checkin {
  id: number;
  user_id: string;
  venue_id: number;
  table_number: number | null;
  started_at: string;
  ended_at: string | null;
  friends: string[] | null;
  open_to_play?: boolean;
  session_note?: string | null;
}

export type ConditionVoteValue = 'buna' | 'acceptabila' | 'deteriorata';

export interface ConditionVote {
  id: number;
  user_id: string;
  venue_id: number;
  condition: ConditionVoteValue;
  photo_url: string | null;
  /** Optional free-text note attached to the rating (migration 113). */
  note: string | null;
  created_at: string;
}

export type VenueChangeRequestStatus =
  | 'pending'
  | 'applied'
  | 'partially_applied'
  | 'dismissed';

export interface VenueChangeRequest {
  id: number;
  venue_id: number;
  submitted_by: string;
  // proposed values; null = no change proposed for that field
  proposed_nets: boolean | null;
  proposed_night_lighting: boolean | null;
  proposed_tables_count: number | null;
  mark_unavailable: boolean;
  note: string | null;
  photo_url: string | null;
  status: VenueChangeRequestStatus;
  resolution: Record<string, string> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export type EventStatus = 'open' | 'confirmed' | 'closed' | 'cancelled' | 'completed';
export type EventType = 'casual' | 'tournament';
export type RecurrenceRule = 'daily' | 'weekly' | 'monthly';
export type EventVisibility = 'public' | 'friends' | 'private';

export interface Event {
  id: number;
  title: string;
  description: string | null;
  venue_id: number;
  table_number: number | null;
  organizer_id: string;
  starts_at: string;
  ends_at: string | null;
  max_participants: number | null;
  status: EventStatus;
  event_type: EventType;
  visibility: EventVisibility;
  created_at: string;
  recurrence_rule: RecurrenceRule | null;
  recurrence_day: number | null;
  parent_event_id: number | null;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: string;
  joined_at: string;
  hours_played: number;
}

export interface EventFeedback {
  id: number;
  event_id: number;
  user_id: string;
  reviewer_name: string | null;
  rating: number;
  body: string | null;
  created_at: string;
}

export type EventFeedbackInsert = Omit<EventFeedback, 'id' | 'created_at'>;

export type RubberColor = 'red' | 'black' | 'pink' | 'blue' | 'purple' | 'green';
export type DominantHand = 'right' | 'left';
export type PlayingStyle = 'attacker' | 'defender' | 'all_rounder';
export type Grip = 'shakehand' | 'penhold' | 'other';
export type EquipmentCategory = 'blade' | 'rubber';

export interface EquipmentManufacturer {
  id: string;
  name: string;
  models: string[];
}

export interface EquipmentSelection {
  id: number;
  user_id: string;
  blade_manufacturer_id: string;
  blade_manufacturer: string;
  blade_model: string;
  forehand_rubber_manufacturer_id: string;
  forehand_rubber_manufacturer: string;
  forehand_rubber_model: string;
  forehand_rubber_color: RubberColor;
  backhand_rubber_manufacturer_id: string;
  backhand_rubber_manufacturer: string;
  backhand_rubber_model: string;
  backhand_rubber_color: RubberColor;
  dominant_hand: DominantHand;
  playing_style: PlayingStyle;
  grip: Grip;
  created_at: string;
}

export type EquipmentSelectionInsert = Omit<EquipmentSelection, 'id' | 'created_at'>;

// ── View types ──

export interface VenueStats {
  venue_id: number;
  avg_rating: number | null;
  review_count: number;
  checkin_count: number;
  favorite_count: number;
}

export interface LeaderboardCheckins {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  total_checkins: number;
  unique_venues: number;
  rank: number;
}

export interface LeaderboardReviews {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  total_reviews: number;
  avg_given_rating: number | null;
  rank: number;
}

export interface LeaderboardVenues {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  venues_added: number;
  rank: number;
}

// ── Insert types (omit id, created_at) ──

export type VenueInsert = Omit<Venue, 'id' | 'created_at' | 'verified' | 'approved' | 'submitted_by'> & Partial<Pick<Venue, 'verified' | 'approved' | 'submitted_by'>>;

export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'flagged' | 'flag_count'> & Partial<Pick<Review, 'flagged' | 'flag_count'>>;

export type EventInsert = Pick<Event, 'title' | 'organizer_id' | 'starts_at'> &
  Partial<Omit<Event, 'id' | 'created_at' | 'title' | 'organizer_id' | 'starts_at'>>;

export type ConditionVoteInsert = Omit<ConditionVote, 'id' | 'created_at'>;

export type CheckinInsert = Omit<Checkin, 'id'>;

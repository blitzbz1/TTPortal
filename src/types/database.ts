// ── Table row types ──

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  lang: string | null;
  auth_provider: string | null;
  created_at: string;
  username: string | null;
  is_admin: boolean;
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
  city: string | null;
  county: string | null;
  sector: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
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
  body: string | null;
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
}

export type ConditionVoteValue = 'buna' | 'acceptabila' | 'deteriorata';

export interface ConditionVote {
  id: number;
  user_id: string;
  venue_id: number;
  condition: ConditionVoteValue;
  photo_url: string | null;
  created_at: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export type EventStatus = 'open' | 'confirmed' | 'cancelled' | 'completed';
export type EventType = 'casual' | 'tournament';
export type RecurrenceRule = 'daily' | 'weekly' | 'monthly';

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
}

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

export type VenueInsert = Omit<Venue, 'id' | 'created_at' | 'verified' | 'approved'> & Partial<Pick<Venue, 'verified' | 'approved'>>;

export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'flagged' | 'flag_count'> & Partial<Pick<Review, 'flagged' | 'flag_count'>>;

export type EventInsert = Pick<Event, 'title' | 'organizer_id' | 'starts_at'> &
  Partial<Omit<Event, 'id' | 'created_at' | 'title' | 'organizer_id' | 'starts_at'>>;

export type ConditionVoteInsert = Omit<ConditionVote, 'id' | 'created_at'>;

export type CheckinInsert = Omit<Checkin, 'id'>;

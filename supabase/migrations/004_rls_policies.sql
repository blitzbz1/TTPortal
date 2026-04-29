-- Migration: 004_rls_policies
-- Enable RLS and add policies for all tables.

-- Cities: public read
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cities are publicly readable" ON public.cities;
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);

-- Venues: public read (approved), authenticated insert, owner update
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approved venues are publicly readable" ON public.venues;
CREATE POLICY "Approved venues are publicly readable" ON public.venues FOR SELECT USING (approved = true);
DROP POLICY IF EXISTS "Admins can view all venues" ON public.venues;
CREATE POLICY "Admins can view all venues" ON public.venues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;
CREATE POLICY "Authenticated users can insert venues" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);
DROP POLICY IF EXISTS "Owners can update own venues" ON public.venues;
CREATE POLICY "Owners can update own venues" ON public.venues FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);
DROP POLICY IF EXISTS "Admins can update any venue" ON public.venues;
CREATE POLICY "Admins can update any venue" ON public.venues FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Admins can delete venues" ON public.venues;
CREATE POLICY "Admins can delete venues" ON public.venues FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Reviews: public read, authenticated insert, owner manage
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;
CREATE POLICY "Reviews are publicly readable" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Favorites: own only
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own favorites" ON public.favorites;
CREATE POLICY "Users can read own favorites" ON public.favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Check-ins: own read/insert, public read for active (friends feature)
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own checkins" ON public.checkins;
CREATE POLICY "Users can read own checkins" ON public.checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Active checkins are readable" ON public.checkins;
CREATE POLICY "Active checkins are readable" ON public.checkins FOR SELECT TO authenticated
  USING (ended_at > now());
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.checkins;
CREATE POLICY "Users can insert own checkins" ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own checkins" ON public.checkins;
CREATE POLICY "Users can update own checkins" ON public.checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Condition votes: public read, authenticated insert
ALTER TABLE public.condition_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Condition votes are publicly readable" ON public.condition_votes;
CREATE POLICY "Condition votes are publicly readable" ON public.condition_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.condition_votes;
CREATE POLICY "Authenticated users can vote" ON public.condition_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Friendships: participants only
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own friendships" ON public.friendships;
CREATE POLICY "Users can read own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Addressees can update friendship status" ON public.friendships;
CREATE POLICY "Addressees can update friendship status" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Events: public read, authenticated insert, organizer manage
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;
CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;
CREATE POLICY "Organizers can delete own events" ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = organizer_id);

-- Event participants: public read, authenticated join/leave
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event participants are publicly readable" ON public.event_participants;
CREATE POLICY "Event participants are publicly readable" ON public.event_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can join events" ON public.event_participants;
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave events" ON public.event_participants;
CREATE POLICY "Users can leave events" ON public.event_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


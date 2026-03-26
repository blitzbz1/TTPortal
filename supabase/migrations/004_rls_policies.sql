-- Migration: 004_rls_policies
-- Enable RLS and add policies for all tables.

-- Cities: public read
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);

-- Venues: public read (approved), authenticated insert, owner update
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved venues are publicly readable" ON public.venues FOR SELECT USING (approved = true);
CREATE POLICY "Admins can view all venues" ON public.venues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Authenticated users can insert venues" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Owners can update own venues" ON public.venues FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Admins can update any venue" ON public.venues FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete venues" ON public.venues FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Reviews: public read, authenticated insert, owner manage
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are publicly readable" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Favorites: own only
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own favorites" ON public.favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Check-ins: own read/insert, public read for active (friends feature)
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own checkins" ON public.checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Active checkins are readable" ON public.checkins FOR SELECT TO authenticated
  USING (ended_at IS NULL);
CREATE POLICY "Users can insert own checkins" ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Condition votes: public read, authenticated insert
ALTER TABLE public.condition_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Condition votes are publicly readable" ON public.condition_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON public.condition_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Friendships: participants only
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressees can update friendship status" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Events: public read, authenticated insert, organizer manage
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id);
CREATE POLICY "Organizers can delete own events" ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = organizer_id);

-- Event participants: public read, authenticated join/leave
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event participants are publicly readable" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave events" ON public.event_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

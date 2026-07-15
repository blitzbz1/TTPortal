-- Migration: 011_seed_notifications
-- Seed notification data for development (runs after notifications table is created in 009).

INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, read, data, created_at) VALUES
  -- Friend requests / acceptances for Andrei
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000009', 'friend_accepted', 'Cerere acceptată', 'Alexandru Stan ți-a acceptat cererea de prietenie.', true, '{}', '2026-01-10T12:05:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000010', 'friend_request', 'Cerere de prietenie', 'Diana Preda vrea să fie prietenul tău.', false, '{}', '2026-03-20T10:05:00Z'),
  -- Event reminders
  ('a1000000-0000-0000-0000-000000000001', NULL, 'event_reminder', 'Eveniment mâine', 'Weekend Challenge Herăstrău începe mâine la 10:00.', false, '{"event_id":4}', '2026-04-04T18:00:00Z'),
  -- Event joined notifications
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'event_joined', 'Participant nou', 'Maria Ionescu s-a înscris la Weekend Challenge Herăstrău.', true, '{"event_id":4}', '2026-03-25T14:05:00Z'),
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000007', 'event_joined', 'Participant nou', 'Vlad Constantinescu s-a înscris la Weekend Challenge Herăstrău.', false, '{"event_id":4}', '2026-03-26T09:05:00Z'),
  -- Checkin nearby
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'checkin_nearby', 'Prieten în zonă', 'Mihai Radu a făcut check-in la Parcul IOR.', true, '{"venue_id":3}', '2026-03-05T14:05:00Z'),
  -- Review on a venue Andrei submitted
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000010', 'review_on_venue', 'Recenzie nouă', 'Diana Preda a scris o recenzie la Parcul Tineretului.', false, '{"venue_id":11}', '2026-03-15T12:00:00Z'),
  -- Notifications for Maria
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'friend_accepted', 'Cerere acceptată', 'Andrei Popescu ți-a acceptat cererea de prietenie.', true, '{}', '2025-11-10T12:05:00Z'),
  ('a1000000-0000-0000-0000-000000000002', NULL, 'event_reminder', 'Eveniment mâine', 'Dublu Mixt Parcul Tineretului începe pe 15 aprilie.', false, '{"event_id":7}', '2026-04-14T18:00:00Z')
ON CONFLICT DO NOTHING;

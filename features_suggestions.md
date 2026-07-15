# TTPortal — New Feature Suggestions

**Date:** 2026-06-10 · **Grounded against:** the implemented app surface at commit `9a48d1e` (57 shipped features inventoried from code) and all existing plans (`improvements.md` — fully shipped; `mspec.md` B2B monetization phases; `monitoring.md`; `appstore_requirements.md`).

**Method:** Six ideation lenses (social/community, competitive play, discovery & logistics, gamification/retention, B2B venue synergy, training & utility) generated 46 proposals; near-duplicates were merged, anything already implemented or already planned was dropped, and the survivors were scored against the mission — *find venues, organize play, broadcast where you're playing, find people to play with* — and against the venues-pay/users-free monetization strategy. Result: **30 features in 6 themes**, ordered by strategic importance.

Every feature includes a backend sketch grounded in the existing schema (migration numbers reference patterns already in `supabase/migrations/`). All notification-bearing features deliberately reuse the existing push pipeline (in-app rows + Expo push, fetch-on-focus) — **no Realtime**, per the egress postmortem.

---

## Recommended build order (dependency-aware)

```
Foundation (small, unblocks everything):
  Skill Level & Play Goals ──┐
  Match Recording ───────────┤
                             ├──► Open Play Broadcast, Find Players, Elo Rating
  Live Busyness ◄── (pure read RPCs over existing check-ins; independent)
  Free-Table Reports, Amenities ◄── (small; feed the B2B data flywheel immediately)

Rating chain:  Match Recording → Elo Rating → Head-to-Head → City Ladder → Brackets
Social chain:  Find Players / Open Play → DMs → Clubs
Retention:     Streaks, Quests, Weekly Recap (independent; any order)
```

Cross-cutting prerequisites from `improvement_suggestions.md`: ship the **check-in privacy controls** (§9.5) and **notification preference center** (§9.7) before the presence-broadcasting features, and the **moderation hardening** (§9.10) before DMs/Moments/Boards.

---

## Theme 1 — Find Players & Play Together Now (real-time matchmaking on the map)

### 1.1 Open Play Broadcast — "looking for players", now and later · **must-have, large**
The check-in duration modal gains a "Looking for players" toggle plus an optional 120-char note; open sessions render as a pulsing ring on the venue's map pin, a "Playing now — join them" row in the map bottom sheet, and on venue detail. A sibling "Plan a session" action broadcasts future intent (now / in 1 hour / tonight / tomorrow + note, friends-only or public), shown as "3 players planning to play tonight" with avatars. Others tap "I'm in", which notifies the broadcaster; once 2+ players are in, one tap converts the broadcast into a pre-filled event via the existing create-event flow. Broadcasts auto-expire with the check-in or time window.

**Why:** The most direct push on the core mission — a check-in stops being passive presence and becomes an invitation, with far lower friction than creating an event; it solves cold-start at quiet venues. For B2B it creates forward-looking demand data ("expected visitors tonight") that no competitor has — a flagship metric for the paid venue dashboard.

**Backend:** `ALTER checkins ADD open_to_play boolean, session_note text`; new `play_intents` + joins tables with RLS; `get_open_play(p_city)` RPC; notification triggers (008/009/012 pattern) targeting in-city friends and venue-favoriters gated by a new `profiles.notify_play_broadcasts` preference; one-active-broadcast guard mirroring the simultaneous-check-in guard; `rate_limit_config` rows (047); pg_cron expiry sweep. Client: extend `CheckinDurationModal`, map pins, and the venue detail bundle (044).

### 1.2 Skill Level & Play Goals on profile + venue player-mix snapshot · **must-have, small**
Two quick profile pickers: skill level (new player / casual / club / competitive) and what you're looking for (casual rallies, competitive matches, training partner, doubles) — also offered as onboarding step 2, **finally persisting the currently-discarded interest selections** (flagged half-built in the code inventory). Level chips appear on player profiles and friend lists; venue detail shows an anonymized mix ("Mostly casual & club players") once ≥5 distinct recent visitors have set a level.

**Why:** Beginners' top fear is being outclassed; level chips make "find people to play with" actually work. For B2B, audience composition is a headline chart for the paid analytics tiers — collected free via a feature players want anyway. This is the data substrate the directory and rating system build on, so it ships first.

**Backend:** Two columns on `profiles` (`skill_level` enum, `play_goals text[]`); persist onboarding step 2; venue-mix RPC honoring the mspec 5-user aggregation threshold; chips added to the `profile_stats` RPC (051) and friends payloads.

### 1.3 Find Players — opt-in city directory with skill/style/availability matching · **high, large**
A "Find players" entry on the Friends screen opens an opt-in, city-scoped directory of players who enabled a "Discoverable to nearby players" toggle (off by default): avatar, skill chip, playing style/grip/handedness badges pulled from the **existing equipment profile**, availability windows, top check-in venues, and a played-this-week freshness dot. Filters: skill, sought style (attacker/defender/penholder/lefty), availability, park/indoor — and rating proximity once ratings ship. A "Challenge" button sends a match invite (venue + proposed time) which, on accept, auto-creates a private 2-person event via the existing event machinery, so reminders come free.

**Why:** Today the only way to find a person is exact @username lookup or meeting them at an event — a dead end for newcomers in a new city. Style-aware matching is what differentiates a TT app from a generic meetup tool (lefty and penhold practice partners are genuinely scarce), and it socially activates equipment data the app already collects.

**Backend:** `profiles.discoverable boolean default false`; `partner_preferences` table; `find_players(city, filters)` RPC joining profiles + current equipment + ratings + recent activity, excluding `user_blocks` (072) and existing friends; `match_invites` table with an accept RPC transactionally creating a private event (058 visibility); notification trigger + rate limits (e.g. 5 invites/day).

### 1.4 Direct Messages (1:1 partner chat) · **high, large**
A "Message" button on profiles of friends and event co-participants; a simple thread screen (bubbles, day separators, pull-to-refresh) and a Messages inbox (paper-plane icon next to the bell) with unread badges. New messages arrive as push notifications deep-linking into the thread; threads refetch on push receipt and AppState foreground — explicitly **poll/push-driven, no websockets**, per the egress postmortem. Blocked users can't start or continue threads; long-press to report.

**Why:** Every "find a partner" surface (broadcasts, directory, crossed paths, participant lists) currently dead-ends at a friend request — there is no way to say "Saturday 10am?". DMs are the connective tissue that converts social features into real sessions, and the strongest retention driver in this set.

**Backend:** `dm_threads` (UNIQUE pair) + `dm_messages` with participant-scoped RLS; a `can_message()` check (accepted friendship OR shared event, AND no block); insert trigger reusing `send_push_notification`; per-user rate limits; `content_reports` type `dm_message` (extends 072) surfaced in the existing admin Reports tab.

### 1.5 Crossed Paths — "you played at the same place" · **medium, small**
A card strip atop the Friends screen: players whose check-ins overlapped yours at the same venue in the last 30 days (excluding friends and blocked users) — avatar, shared venue ("2× at Stadtpark"), Add / Dismiss.

**Why:** People already meet strangers at tables; the app just forgets it happened. Near-zero-effort conversion of physical encounters into connections, computed entirely from data `checkins` already holds.

**Backend:** `get_crossed_paths()` RPC (self-join on checkins with `tstzrange` overlap), a `suggestion_dismissals` table, and an index on `checkins(venue_id, started_at)`. No push needed for v1.

---

## Theme 2 — Live Venue Intelligence (richer, fresher venue data — the B2B data flywheel)

### 2.1 Live Busyness + typical-hours histogram · **must-have, medium**
Venue detail gains a Busyness block: a live line ("3 players here now · 5 tables") from active check-ins plus a Google-style per-hour histogram with weekday selector ("usually busy around 19:00"). Map callouts and list rows show a live-presence dot with an **anonymous count** whenever a venue has active check-ins (generalizing the existing friends-presence badge to counts-only for everyone). Empty state: "not enough data yet — check in to help."

**Why:** Turns check-in exhaust into the core "should I go now?" decision signal. Makes every check-in visibly useful to the community → more check-ins → richer data for the paid analytics tiers. Shares aggregation infrastructure with the planned mspec Phase 2 peak-hours heatmap — build the aggregates once, serve both surfaces.

**Backend:** `get_venue_busyness(venue_id)` RPC over a `venue_busyness_hourly` materialized view (12-week trailing window, daily pg_cron refresh per the 018 pattern); a light `get_live_venue_counts(city_id)` RPC for pin dots; live count folded into the venue detail bundle (044). Counts only, no identities.

### 2.2 One-tap free-table reports · **must-have, small**
The check-in success sheet and venue detail prompt: "How many tables are free? 0 / 1 / 2 / 3+" (scaled to the venue's known table count), with an optional group-size stepper. The latest fresh report shows as "1 table free · reported 12 min ago", decaying after ~90 minutes. Anonymous to viewers.

**Why:** Answers the single biggest logistics question — will I get a table when I arrive — with one tap from someone on site. For B2B it converts the planned Pro/Business analytics from *inferred* to *measured* (occupancy, group size), making the paid dashboard dramatically more credible.

**Backend:** `table_reports` table with insert-own RLS + rate limiting (047); latest-fresh aggregate joined into the venue bundle (044) and `get_live_venue_counts`; pg_cron cleanup after 24h.

### 2.3 Structured amenities, fees & access info · **must-have, small**
The venue info grid grows a second section: paddle/ball rental, ball vending, showers/lockers, parking, wheelchair access, café/water, entry fee (free / day pass / membership), "bring your own net". Each field shows ✓ / ✗ / "unknown — know this? Tell us", which opens the **existing Suggest-an-Edit modal** extended with these fields, flowing through the same admin review queue. Search gains "Free entry" and "Rental available" chips.

**Why:** Removes the biggest real-world friction (showing up without a net or entry money) and creates exactly the structured data layer the paid Verified Venue Profile is built on — owners seeing crowd-sourced (sometimes wrong) facts about their business is built-in lead-gen for the claiming funnel.

**Backend:** `venues.amenities jsonb` (or a `venue_amenities` table) included in `get_venues_delta` (045) and the venue bundle (044); extend the `venue_change_requests` payload (078/080) and the admin apply function. No new services.

### 2.4 Weather-aware outdoor play assistant · **high, medium**
Outdoor venues show a weather chip on venue detail and on events held there ("18° · dry until 20:00"; wind warnings >25 km/h, since wind ruins outdoor play). When rain is imminent in the selected city, a dismissible Map banner offers "Rain expected ~17:00 — show indoor venues?" that one-tap applies the existing Indoor filter chip.

**Why:** Most OSM-imported venues are outdoor public tables, and weather is their #1 plan-killer. The rain prompt steers users toward indoor halls — exactly the venues the B2B model targets — a discovery feature with a monetization-funnel side effect.

**Backend:** A `weather-proxy` edge function calling Open-Meteo (free, keyless) keyed off the city catalog's map-center lat/lng, with a `weather_cache` table at ~30-min TTL following the `amatur_cache` pattern (022). No venue schema changes.

### 2.5 Venue board & Q&A · **medium, medium**
A "Board" section on venue detail (below reviews) for short venue-scoped notes and questions: "Anyone here Tuesday evenings?", "Is it lit at night?". One level of replies with a helpful-vote; the asker gets a push when an answer lands; posts older than 60 days collapse. Each question card reserves space for a future "Answered by venue" badge; report/block reuse the review moderation patterns.

**Why:** Regulars have no way to coordinate or leave knowledge for newcomers — reviews are the wrong tool (one per user, rating-centric). Creates micro-communities around the map's core object. For B2B it's a strong claiming hook: unanswered customer questions are an itch owners can't ignore, and "answer as the venue" becomes a headline claimed-profile benefit.

**Backend:** `venue_posts` table (self-FK for replies, soft delete) with RLS; block filtering via `user_blocks`; `content_reports` type `venue_post` into the moderator queue (072/081); answer-notification trigger; rate limits; paged read RPC kept **separate** from the venue bundle to keep it light.

### 2.6 Home venue & regulars · **medium, small**
Users pick a "home venue" (auto-suggested from their most-checked-in venue); it shows on their profile ("@dana · plays at Prater Park") and player cards. Venue detail gets a "Regulars" row: count + opt-in avatar list. A settings toggle controls public visibility.

**Why:** Gives every venue a visible community and newcomers an instant answer to "who plays here?". For B2B, declared home-venue counts are the clearest measure of a venue's loyal base — the audience number that sells venue notifications and loyalty programs — and regulars are the natural first followers when a venue gets claimed. (Distinct from the planned mspec Phase 4 Follow system, which is a notification subscription; this is public identity.)

**Backend:** `profiles.home_venue_id` + `profiles.show_as_regular`; privacy-filtered regulars in the venue bundle (044); auto-suggestion query over existing check-in history.

### 2.7 City guide for traveling players · **medium, medium**
An "Explore {city}" guide from the city picker: hero stats, best outdoor tables, indoor halls, free-access list, this week's events, recurring sessions, and the city leaderboard podium — exposed as a **public shareable web route** (`/city/[id]`), so a player planning a Vienna trip can read it before installing.

**Why:** Traveling players are a high word-of-mouth segment; guides repackage existing data into a zero-marginal-cost discovery artifact, double as an SEO/acquisition surface, and give indoor venues a visible listing worth claiming.

**Backend:** One anon-readable `get_city_guide(city_id)` RPC aggregating existing data (070 city counts, events, 040 weekly leaderboard). No new tables.

---

## Theme 3 — Competitive Play: Matches, Ratings & Tournaments

### 3.1 Match recording with opponent confirmation · **must-have, medium**
A "Log Match" button on the venue action row (when checked in), on event detail, and on friends' profiles. Pick the opponent, enter per-set scores via a fast stepper (best-of-3/5/7 presets), optionally tag venue/event. The opponent gets a push + an inline Confirm/Dispute notification card (the same interaction as inline friend-request accept); only confirmed matches count. Auto-confirm after 72h; twice-disputed matches void. A "Matches" row on Profile lists W/L-coded results.

**Why:** The foundational primitive the entire competitive layer builds on — ratings, head-to-head, ladders, brackets all derive from it. Closes the loop on sessions that already happen via check-ins/events and creates a durable personal record. **Productizes the half-built peer-validation service layer** (`requestOtherPlayerValidation`/`respondToChallengeValidation` exist with no UI). For B2B, matches-played is a flagship venue vitality metric.

**Backend:** `matches` table (players, winner, `sets jsonb`, venue/event refs, status lifecycle) with participant-only RLS; confirm/dispute RPCs modeled on the existing challenge-validation pattern; notification trigger (008/009); rate limits (047); pg_cron auto-confirm; `get_player_matches` RPC; venue stats extension (044).

### 3.2 TTPortal skill rating (Elo) with history · **high, medium**
Every player gets a rating starting at 1200, updated automatically on match confirmation; shown as a chip on profiles, the identity card, and event participant lists ("Provisional" under 10 matches). The profile gains current/peak rating, a 90-day sparkline, and last-5 delta; a celebration sheet shows the change when the opponent confirms.

**Why:** Table tennis players are rating-obsessed (USATT/TTR/Elo culture is core to the sport) — a number that moves with every confirmed match is the strongest retention loop available, and it powers matchmaking, ladder seeding, and bracket seeding downstream. Simple v1 Elo in plpgsql; deterministic and recomputable, no ML.

**Backend:** `player_ratings` + `rating_history` tables; one plpgsql `apply_match_rating(match_id)` (K=40 provisional / K=20 after), invoked from the match-confirmation trigger; recompute function for dispute reversals.

### 3.3 Head-to-head records and rivals · **high, small**
On a profile of someone you've played: W-L record, set ratio, current streak ("You've won 3 straight"), last 5 as tappable W/L dots. Your own profile gains a "Rivals" section — top 5 most-played opponents with a Challenge button deep-linking into the match-invite flow.

**Why:** Rivalries are the emotional engine of amateur table tennis — everyone knows exactly who they can't beat at their park. Surfacing the record gives a concrete reason to organize the next session. Pure derivation over `matches`; very cheap once 3.1 exists.

**Backend:** No new tables — `get_head_to_head` and `get_rivals` RPCs over `matches`, respecting block filtering.

### 3.4 Tournament brackets and round-robin on events · **high, large**
For `event_type='tournament'`, the organizer gets "Set up bracket": single-elimination or round-robin, seeded by rating (unrated last, randomized). Participants see a scrollable bracket (or standings table) inside event detail with their own path highlighted. Scores entered per tile feed the normal `matches` table, so ratings update; completed tournaments show a podium on past-event detail and a profile trophy for the winner.

**Why:** Events already have a tournament type and the AmaTur feed proves demand — but organizers currently run the actual competition on paper or WhatsApp. In-app brackets make TTPortal the operating system for venue tournaments, drive every participant to open the app between rounds, and are the wedge for the B2B relationship: venues that host tournaments are the venues that pay.

**Backend:** `tournament_brackets` + `bracket_matches` tables; `generate_bracket(event_id, format)` (organizer-only, handles byes) and `report_bracket_result` advancing the bracket transactionally and inserting into `matches`; "your next match is ready" notification; refetch-on-focus, no Realtime.

### 3.5 City ladder with quarterly seasons · **medium, medium**
A "Ladder" tab on the existing Leaderboards screen: per-city standings from confirmed matches this season (rank, rating, W-L); 5 confirmed matches to place (an "In placement — 3/5" section until then). Quarterly seasons with a countdown pill; season end fires a notification + a shareable recap card (final rank, peak rating, most-played venue) rendered with the **orphaned ShareCard** view-shot component; top-3 get permanent profile trophies.

**Why:** Seasons convert the rating into a recurring competition with stakes, deadlines, and a quarterly fresh start — the classic ranked-retention mechanic, mapping perfectly onto TT league mentality. Builds entirely on matches + ratings + the existing leaderboard screen.

**Backend:** `seasons` + `season_results` snapshot tables; `get_city_ladder` RPC; pg_cron season rollover (close, snapshot, open, notify).

### 3.6 Quick Match QR pairing · **low, small**
On Log Match, "Scan opponent" opens the camera; the opponent shows a personal QR from their Profile. Scanning fills both players + venue (from the scanner's active check-in) and drops straight into the score stepper — works for two strangers who just met at a park table. The QR encodes the existing player-profile deep link with `?logMatch=1`, so scanning with a normal camera app opens the web profile — a side-effect acquisition channel.

**Why:** The biggest friction in match recording is identifying an opponent you just met — exactly the "find new people to play" scenario the app exists for. Five-second logging protects rating integrity and doubles as word-of-mouth growth at the table.

**Backend:** Essentially none — reuses the player deep link and matches insert; client-side QR render + scan. The opponent must still confirm, so v1 can skip signed tokens.

---

## Theme 4 — Clubs, Community & Growth

### 4.1 Clubs & groups · **high, large**
Create a club: name, avatar, description, city, optional home venue → generates a 6-char join code / share link. Club screen: member list with admin/member roles, home venue card, upcoming club events. Create-event gains a "Club" visibility option so club events appear automatically in members' Events tabs with a push ("TT Club Vienna scheduled Tuesday training"). Admins remove members / rotate the code.

**Why:** Real-world TT life is organized around clubs and recurring training groups; today organizers must hand-invite friends to every recurring event. One organizer becomes a retention anchor for 10–30 members — and a club with a home venue is that venue's best customer, the natural unit for the B2B story. Builds directly on event visibility (058) and recurrence (016).

**Backend:** `clubs` + `club_members` tables with RLS; `ALTER events ADD club_id` and extend the 058–060 visibility policies with a `club` scope; `join_club_by_code` / `get_my_clubs` / `get_club_detail` RPCs; fan-out notification trigger; avatar via the existing image pipeline.

### 4.2 Referral links with auto-friend on join · **medium, medium**
An "Invite friends" row shows a personal code (`ttportal.org/join/RADU42`) with native share. Signing up via the link (or typing the code at sign-up) auto-connects the pair as accepted friends with a push to both. The inviter gets an "Invited: 3 players" counter and a Recruiter badge at 1/5/10 via the existing badge system.

**Why:** The existing email invite has no attribution and lands new users in an empty app with zero friends — the worst possible first session. Auto-friendship means every referred signup starts with a live friend feed and friend-presence pins, compounding every other social feature.

**Backend:** `profiles.referral_code` (generated like usernames, 035); `referrals` table; `claim_referral(p_code)` RPC inserting an accepted friendship + badge awards; embed the code in `send-app-invite` emails; deep-link handling via the existing returnTo infra; self-referral/re-claim guards.

### 4.3 Session moments (photo + caption on check-in) · **medium, medium**
From the check-in success sheet, "Add a moment" attaches one photo + short caption. Moments appear in the friend activity feed as photo cards — **finally giving the built-but-orphaned ActivityFeedScreen a reason to be routed** — and venue detail gains a "Recent moments" strip under the photo carousel. Long-press to report; authors can delete.

**Why:** Photos are the highest-signal proof a venue is alive and the cheapest shareable artifact for organic growth; moments crowdsource fresh venue imagery without opening the admin-only venue gallery to abuse.

**Backend:** `checkin_moments` table (UNIQUE per check-in, soft delete) with RLS; a `moments` Storage bucket reusing `imageUpload.ts`/CDN transforms; a third UNION branch in the `friend_feed` RPC (extends 052); latest-N in the venue bundle (044); `content_reports` type + rate limits.

---

## Theme 5 — Habit, Retention & Reactivation

### 5.1 Weekly play streaks · **high, medium**
A flame counter for consecutive weeks with ≥1 check-in or attended event — chip on the Profile identity card and inside the CheckinSuccessSheet ("Week 6 streak — keep it alive!"). Tap for current/best streak and which day still counts this week. One push nudge when a week is about to lapse; one auto-applied streak freeze per month so a single missed week doesn't wipe months of habit.

**Why:** The highest-leverage retention mechanic, hung on the app's perfect atomic action (check-in). Weekly granularity matches real TT play frequency, and keeping the streak feeds the presence/busyness data the B2B tiers sell. No streak mechanic exists or is planned.

**Backend:** `user_streaks` table maintained by triggers on check-ins/event attendance (025's badge-sync pattern); one weekly pg_cron job to expire/freeze and enqueue reminder pushes; streak folded into `profile_stats` (051).

### 5.2 Venue explorer quests · **high, medium**
An "Explore" section on the Challenges tab with city-scoped quests: "Visit 5 different venues in Vienna" (bronze/silver/gold at 5/10/20), "Park Hopper: 3 outdoor tables", "Indoor Initiate: play at a verified club". Progress rings show venues already counted; "Find one" jumps to the Map pre-filtered via the existing chips. Tier completion fires the existing earned-badge modal; map callouts show a "New to you" tag on venues never visited.

**Why:** Converts gamification directly into the core mission — venue discovery. Hundreds of OSM-imported venues per city go unseen; quests give a reason to visit venue #4 and #5, spreading check-in data across more venues for the B2B analytics base. Distinct-venue progress is trivially computable from existing check-ins.

**Backend:** A quest-definitions table (venue predicate: park/indoor/verified; tier targets) + `get_explorer_progress` RPC (`COUNT(DISTINCT venue_id)` joined to venues); awards reuse the badge infrastructure (025).

### 5.3 Weekly recap — "Your week in TT" · **high, medium**
Monday morning push for users who played: "Your week: 3 sessions, 4h 30m, 2 venues, #5 in Vienna." Opens a one-screen recap (sessions, hours, venues with new-venue callout, friends played with, rank delta, streak) ending in "Share my week" rendering a branded image via the already-installed `react-native-view-shot` + the orphaned ShareCard. Users who didn't play get nothing — no guilt spam.

**Why:** The proven Strava/Duolingo re-engagement hook; every number already lives in checkins, event hours (029), and the weekly leaderboard RPCs (040).

**Backend:** `get_weekly_recap(user_id, week_start)` RPC over existing tables; one Monday pg_cron job inserting notifications + pushes only for active users.

### 5.4 Milestone moments with shareable cards · **medium, medium**
Lifetime thresholds — 10th/50th/100th check-in, 10th/25th distinct venue, 50/100/250 hours, first review, 1-year anniversary — trigger a full-screen celebration (stacked after CheckinSuccessSheet when both fire) with confetti and a share card. Earned milestones form a strip on Profile next to the badge showcase, with locked next-milestone ghosts ("38/50 venues").

**Why:** Rewards the long tail that tiered challenge badges miss (lifetime totals vs per-category completions), gives every check-in a chance of a dopamine moment, and the ghosts telegraph the next goal. Cheap: totals are one query away, celebration/share UI patterns already shipped.

**Backend:** `user_milestones` table populated by AFTER INSERT triggers (025 style); definitions in client code like `badgeChallenges.ts`; `profile_stats` (051) extended with lifetime counters.

### 5.5 TT Wrapped — year in review · **medium, large**
Dec 15–Jan 15: a banner on Profile announces "Your TT Wrapped is ready" → a swipeable 5–6-card story: total hours/sessions, top venue with photo, most-played month, partner of the year, badges/milestones, and a rule-based archetype card ("The Park Regular", "The Explorer"). Every card shares as a story-format image; one teaser push at unlock.

**Why:** The single most-shared retention artifact in consumer apps, landing exactly when outdoor players churn — doubling as reactivation for lapsed users and January acquisition through share cards. Pure aggregation over existing data.

**Backend:** A `year_in_review(user_id, year)` RPC over existing tables; one pg_cron notification; optional jsonb precompute for heavy users.

---

## Theme 6 — Training & Gear Utility

### 6.1 Training session log (drills, duration, focus areas) · **medium, medium**
"Log training" on Profile and the check-in success sheet: session type (solo, partner, multiball, robot), duration (reusing the LogHoursModal preset pattern), 1–3 focus chips (serves, receive, footwork, FH/BH loop, blocking, match play), optional venue (pre-filled from active check-in) and partner. Sessions appear as a new row type in the existing PlayHistoryScreen day breakdown, with a focus-distribution bar on the period summary.

**Why:** Turns TTPortal from "where I played" into "how I trained" — the retention loop for ambitious players who already use Play History; it also creates the play-hours substrate the rubber wear tracker consumes.

**Backend:** `training_sessions` table (owner-write/friend-read RLS mirroring equipment_history); extend the play-history query path; rate limit row; MMKV cache per the playHistoryCache pattern.

### 6.2 Rubber wear tracker with replacement reminders · **medium, medium**
EquipmentScreen gains an "installed on" date per rubber (defaulting from equipment_history) and a wear card: estimated play hours since install (summed from check-in durations + event hours + training sessions) against an adjustable expected lifespan (default 60h). Pushes at 80% and 100% ("Your FH Hurricane 3 has ~58h — time to re-rubber?") deep-link to Equipment; saving a new rubber resets the clock.

**Why:** Rubber degradation is a genuine, money-relevant obsession for TT players and no consumer app tracks it against *actual* play time — TTPortal uniquely owns that signal. Motivates more check-ins (accuracy) and feeds the future equipment-brand partnership path (mspec 9.3).

**Backend:** `equipment_wear_settings` table (side, installed_at, expected_hours); `get_rubber_wear` RPC summing the three hour sources; nightly pg_cron threshold notifications with a sent-flag.

### 6.3 Equipment database with community reviews · **medium, medium**
Every blade/rubber in the **existing delta-synced catalog** becomes tappable into a model page: aggregate stars, speed/spin/control bars, "N TTPortal players use this", and reviews where each author's playing style/grip from their real equipment profile shows alongside. Only users with the model in their equipment_history can review (stars + three 0–10 sliders + time used + text); report/block reuse the venue-review patterns. A "Gear" browse entry by manufacturer.

**Why:** Rubber/blade research is one of the highest-engagement behaviors in the TT community (revspin/tabletennisdb traffic proves it), and TTPortal already owns the catalog *plus* knows each reviewer's real style and play volume — more credible than anonymous web ratings. Pulls users in between sessions; seeds the brand-partnership path.

**Backend:** `equipment_reviews` table (UNIQUE per user+model, owned-it check against equipment_history); `get_equipment_model_summary` RPC; `content_reports` type in the admin tab; rate limit row.

### 6.4 Coach directory (verified coach profiles per city) · **medium, medium**
An "I coach" application form: bio, experience, levels taught, languages, indicative price range, contact method, up to 3 venues. Submissions land in the **existing admin approval queue**; approved coaches get a Coach badge and a pinned card atop their player profile showing their real TTPortal activity for credibility. Venue detail gains "Coaches here"; map filters gain a "Coaching" chip. No booking/payments in v1.

**Why:** Coach discovery serves the largest underserved cohort (improvers) with zero payments infrastructure, and seeds the B2B funnel: coaches are usually venue staff or club regulars with a selfish reason to keep venue data fresh — and featured coach listings are a future paid surface consistent with venues-pay.

**Backend:** `coach_profiles` (status lifecycle, public-read-when-approved RLS) + `coach_venues`; admin approve/reject RPCs as a new AdminModerationScreen tab (073/074 pattern); coach chips in the venue bundle and `profile_stats`.

---

## What was deliberately left out

- Everything in **mspec.md** (venue claiming, verified profiles, analytics dashboard tiers, promoted events, venue follow/notifications, loyalty, sponsored challenges, reservations, market reports) — already specified; several features above are designed to *feed* it.
- Everything in **improvements.md** — all 19 UI/UX items verified as shipped.
- One raw proposal ("Daily Spotlight Challenge") was dropped as duplicative of the existing monthly community challenge rotation.
- Realtime-websocket-based anything — the egress postmortem stands; every feature above uses push + fetch-on-focus.

## Final note on sequencing vs. the improvements doc

The three privacy/security findings about presence leakage (`improvement_suggestions.md` §1.2–1.3) should land **before** Theme 1 ships: Open Play Broadcast and Find Players intentionally widen presence visibility, and that only works if visibility is opt-in and RLS-enforced rather than leaking by default. Likewise, DMs/Moments/Boards (Themes 1 & 4) should wait for the moderation-scale groundwork (§9.10) — each proposal above already includes its `content_reports` hook for that reason.

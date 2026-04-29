# TTPortal Monetization Specification

**Version:** 1.0
**Date:** 2026-04-02
**Status:** Draft

---

## 1. Executive Summary

TTPortal is a free mobile app for table tennis players to discover venues, check in, review, track play history, and coordinate with friends. The app generates valuable behavioral data (check-ins, session duration, recurrence, favorites, event participation) that can help venue owners understand and grow their business.

The monetization strategy is B2B: venues pay for analytics, reach, and engagement tools. The app remains completely free for players. User data is never sold individually — only aggregated, anonymized insights are provided to venues.

### Revenue Streams

| Stream | Model | Target Price Range | Priority |
|---|---|---|---|
| Verified Venue Profile | Annual subscription | €49–99/year | Phase 1 |
| Venue Analytics Dashboard | Monthly subscription (tiered) | €0/29/59 per month | Phase 2 |
| Promoted Events | Pay-per-campaign | €5–15 per promotion | Phase 3 |
| Venue Notifications | Pay-per-send | €0.02–0.05 per user reached | Phase 4 |
| Loyalty Programs | Monthly add-on | €19–29/month | Phase 5 |
| Sponsored Challenges | Per-campaign | €30–80 per challenge | Phase 6 |

---

## 2. Venue Claiming & Onboarding

Before any monetization feature can work, venues must be "claimed" by their owner or manager.

### 2.1 Claim Flow

1. A venue owner opens the venue detail page in the app and taps "Is this your venue? Claim it."
2. The app collects: full name, role (owner/manager/staff), email, phone number.
3. Verification methods (at least one required):
   - **Email verification:** The owner provides a business email matching the venue's known domain. We send a verification code.
   - **Photo verification:** The owner uploads a photo of themselves at the venue holding a unique code displayed in the app (prevents remote false claims).
   - **Manual review:** For edge cases, our team reviews and approves the claim within 48 hours.
4. Upon approval, the user's account is linked to the venue as an admin. They gain access to the Venue Manager section.

### 2.2 Venue Manager Roles

| Role | Permissions |
|---|---|
| Owner | Full access: analytics, promotions, notifications, billing, transfer ownership |
| Manager | Analytics, promotions, notifications. Cannot manage billing or transfer ownership. |
| Staff | View-only analytics. Cannot send promotions or notifications. |

An owner can invite managers and staff by email. Each invited user must have a TTPortal account.

### 2.3 Venue Manager Interface

Two access points:
- **In-app:** A "Manage Venue" tab visible only to claimed venue admins, accessible from the venue detail screen.
- **Web dashboard (Phase 2+):** A responsive web app at a subdomain (e.g., venues.ttportal.app) for desktop access to analytics and campaign management. Authenticated via the same Supabase account.

---

## 3. Verified Venue Profile (Phase 1)

### 3.1 What It Is

A premium venue listing with enhanced credibility and visibility. This is the lowest-effort, highest-trust-building monetization step — it gives venue owners a reason to claim their venue and start paying.

### 3.2 Features

| Feature | Free Venue | Verified Venue |
|---|---|---|
| Appears on map | Yes | Yes |
| User-submitted reviews | Yes | Yes |
| Venue description | Auto-generated from data | Custom-written by owner |
| Photos | User-submitted only | Owner-curated gallery (up to 10 photos) + user photos |
| Contact info (phone, website, social) | Not shown | Prominently displayed |
| Operating hours | Not shown | Displayed with open/closed indicator |
| Verified badge on map pin and detail | No | Yes (green checkmark) |
| Search ranking boost | Standard | +15% relevance boost |
| Link to external booking/website | No | Yes, with tap tracking |

### 3.3 Pricing

- **€49/year** (introductory, first 6 months after launch)
- **€99/year** (standard)
- Billed annually via Stripe. 14-day free trial upon claiming.

### 3.4 Technical Requirements

- `venues` table: add columns `claimed_by UUID`, `claimed_at TIMESTAMPTZ`, `verified BOOLEAN DEFAULT false`, `business_phone TEXT`, `business_website TEXT`, `business_hours JSONB`, `custom_description TEXT`
- `venue_managers` table: `venue_id`, `user_id`, `role ENUM('owner','manager','staff')`, `invited_at`, `accepted_at`
- `venue_photos` table: extend with `uploaded_by_owner BOOLEAN DEFAULT false`, `sort_order INT`
- `subscriptions` table: `venue_id`, `plan TEXT`, `status TEXT`, `stripe_subscription_id TEXT`, `current_period_start`, `current_period_end`
- Stripe integration for payment processing
- Photo upload flow for owner-curated gallery (reuse existing photo upload infrastructure)

---

## 4. Venue Analytics Dashboard (Phase 2)

### 4.1 What It Is

A data dashboard that gives venue owners actionable insights about their visitors, derived from anonymized, aggregated check-in data. This is the core revenue driver.

### 4.2 Data Privacy Framework

**Fundamental rules:**
1. All metrics shown to venues are aggregated. No individual user names, profiles, or identifiers are ever exposed.
2. A metric is only shown if it is derived from at least **5 unique users** in the time period. Below this threshold, the metric displays "Not enough data" to prevent de-anonymization.
3. Users can opt out of contributing to venue analytics in Settings. Their check-ins still work for personal history but are excluded from venue aggregations.
4. The app's privacy policy and Terms of Service clearly explain what data is aggregated and how venues use it.
5. Venue owners never see: who favorited them, who checked in (by name), individual session durations, or any demographic data about specific users.

### 4.3 Metrics — Free Tier

Available to any claimed venue, no payment required. This demonstrates value and drives upgrades.

| Metric | Description | Data Source |
|---|---|---|
| Total check-ins (this month) | Simple count of check-ins | `checkins` table |
| Average rating | Star rating from reviews | `reviews` table |
| Review count | Total number of reviews | `reviews` table |
| Favorites count | How many users have this venue favorited | `favorites` table |

### 4.4 Metrics — Pro Tier (€29/month)

| Metric | Description | Calculation |
|---|---|---|
| Daily / weekly / monthly visitor count | Unique users who checked in per period | `COUNT(DISTINCT user_id)` grouped by day/week/month |
| Peak hours heatmap | Distribution of check-ins by hour of day and day of week | `started_at` bucketed by hour and weekday, displayed as a heatmap grid |
| Average session duration | Mean time between check-in and check-out | `AVG(ended_at - started_at)` for completed check-ins |
| Session duration distribution | Breakdown: <30min, 30-60min, 1-2h, 2h+ | Bucketed histogram of session lengths |
| Visit recurrence rate | Percentage of visitors who return within 30 days | Users with 2+ check-ins within a rolling 30-day window / total unique visitors |
| New vs returning visitors | Ratio of first-time vs repeat visitors per period | First check-in ever at this venue vs subsequent |
| Trend lines | All above metrics plotted over time (last 3 months) | Time-series aggregation |
| Event attendance | For each event at this venue: RSVPs vs actual check-ins during event time window | Join `event_participants` with `checkins` by venue + time overlap |

### 4.5 Metrics — Business Tier (€59/month)

Everything in Pro, plus:

| Metric | Description | Calculation |
|---|---|---|
| Estimated group size | Average number of concurrent check-ins in overlapping time windows | Cluster check-ins at same venue within ±15 min of each other, count cluster sizes |
| Favorites-to-visit conversion | % of users who favorited and later checked in within 30 days | Users in both `favorites` and `checkins` for this venue within window |
| Competitive positioning | Relative ranking among venues in same city: "Top 20% for visit recurrence", "Top 30% for session duration" | Percentile rank across city venues, never showing competitor names or absolute numbers |
| Catchment area | Top 3 cities/regions visitors come from (as percentages) | User `city` from `profiles`, aggregated (only shown if 5+ users per city) |
| Day-of-week comparison | Which days outperform vs underperform the venue's own average | Standard deviation analysis per weekday |
| Churn indicator | "X% of previously regular visitors haven't returned in 60 days" | Users with 3+ historical check-ins who have no check-in in last 60 days |
| CSV/PDF export | Download reports for stakeholders or landlords | Server-generated file |

### 4.6 Dashboard UI

The dashboard displays:
- **Summary cards** at the top: visitors this month (with trend arrow), avg session, recurrence rate, avg rating
- **Peak hours heatmap**: 7-day × 24-hour grid, color-coded by check-in density
- **Trend chart**: line chart of daily unique visitors over last 90 days
- **Visit recurrence funnel**: visual showing 1-visit → 2-visit → 3+ visit breakdown
- **Event performance table**: list of past events with RSVP count, attendance, and attendance rate
- **Competitive positioning radar** (Business tier): spider chart with 5 axes (traffic, recurrence, session length, rating, favorites)

### 4.7 Technical Requirements

- Materialized views or scheduled queries for aggregated metrics (refresh daily or hourly)
- Row-level security: venue admins can only query aggregated data for their own venue
- Minimum-threshold enforcement (5-user minimum) at the query layer, not the UI layer
- Stripe subscription management with plan upgrades/downgrades
- Webhook to activate/deactivate features based on subscription status
- Web dashboard: Next.js or Expo Web, authenticated via Supabase, responsive

---

## 5. Promoted Events (Phase 3)

### 5.1 What It Is

Venue owners can pay to boost visibility of their events to a wider audience beyond their existing visitors.

### 5.2 How It Works

1. Venue creates an event normally through the app.
2. In the Venue Manager section, they tap "Promote this event."
3. They choose a target audience:
   - **City-wide:** All users in the same city.
   - **Interest-based:** Users who have checked in at any table tennis venue in the city (higher intent, higher price).
   - **Favorites+:** Users who have the venue favorited OR have checked in before (retargeting).
4. They set a budget (minimum €5) and see an estimated reach based on the audience size.
5. The promoted event appears:
   - At the top of the Events tab for targeted users, labeled "Promoted"
   - In a "Happening near you" section on the home/map screen
   - Optionally, as a push notification (if the user has opted in to event suggestions)

### 5.3 Pricing

| Audience Type | Price per 1,000 impressions (CPM) | Minimum spend |
|---|---|---|
| City-wide | €3 | €5 |
| Interest-based | €5 | €5 |
| Favorites+ (retargeting) | €8 | €5 |

Alternatively, a flat fee model for simplicity:
- **Small promotion** (€5): shown to up to 200 users for 3 days
- **Medium promotion** (€10): shown to up to 500 users for 5 days
- **Large promotion** (€15): shown to up to 1,000 users for 7 days

### 5.4 User Experience

- Promoted events are clearly labeled with a "Promoted" badge. Never disguised as organic.
- Users can tap "Not interested" to dismiss and reduce future similar promotions.
- Users can disable promoted events entirely in Settings → Notifications → "Event suggestions."
- Maximum 1 promoted event shown per session to avoid clutter.
- Promoted events must comply with content guidelines (no misleading info, actual events only).

### 5.5 Reporting for Venues

After a promotion ends, the venue sees:
- Impressions (how many users saw it)
- Taps (how many opened the event detail)
- RSVPs (how many joined)
- Check-ins during event (if applicable)
- Cost per RSVP

### 5.6 Technical Requirements

- `promoted_events` table: `event_id`, `venue_id`, `audience_type`, `budget_cents`, `start_date`, `end_date`, `status`, `impressions`, `taps`
- `promotion_impressions` table: `promotion_id`, `user_id`, `shown_at`, `tapped_at` (for deduplication and reporting)
- Targeting query: filter users by city, check-in history, favorites
- Frequency cap: max 1 promoted event per user per day
- Stripe one-time charge per promotion
- Admin review queue for promoted events (prevent abuse)

---

## 6. Venue Notifications / Follow System (Phase 4)

### 6.1 What It Is

A "Follow" system where users can subscribe to updates from specific venues. Followed venues can send push notifications about promotions, schedule changes, and news.

### 6.2 Follow Mechanics

- On every venue detail page: a "Follow" button (bell icon), independent from "Favorite" (heart icon).
  - **Favorite** = "I want to save this for later" (personal, private)
  - **Follow** = "I want to hear from this venue" (opt-in to notifications)
- Users can follow a venue without favoriting it, and vice versa.
- Following is explicit opt-in. Never auto-enabled.
- Users manage all follows in Settings → "Followed Venues" with one-tap unfollow.

### 6.3 What Venues Can Send

| Notification Type | Example | Frequency Cap |
|---|---|---|
| Promotion / Discount | "50% off table rentals this Friday 5-7pm" | 2 per week |
| Schedule change | "Closed for maintenance Dec 24-26" | Unlimited (operational) |
| New equipment / renovation | "We just installed 4 new Butterfly tables!" | 1 per week |
| Event announcement | "Saturday tournament — sign up now" | 2 per week |

**Total cap:** Maximum 4 notifications per venue per week, enforced server-side. Venues cannot bypass this.

### 6.4 Notification Creation Flow

1. Venue manager opens Venue Manager → "Send Update"
2. Selects notification type from template categories
3. Writes a short message (max 160 characters — keeps it concise and non-spammy)
4. Optionally attaches a deep link (to their venue page, an event, or external URL)
5. Previews the notification as users will see it
6. Confirms and sends. Delivery is within 5 minutes.

### 6.5 Pricing

- **Included in Pro/Business analytics subscription:** 2 free notifications per week
- **Additional notifications:** €0.03 per user reached per notification
- **Example:** A venue with 200 followers sends a 3rd notification in a week → 200 × €0.03 = €6

### 6.6 Anti-Spam Safeguards

- Server-side frequency caps (venues cannot send more than 4/week regardless of payment)
- Users can unfollow from the notification itself (one-tap)
- If >20% of followers unfollow after a notification, the venue receives a warning
- After 2 warnings, notification privileges are suspended pending review
- Content guidelines: no third-party ads, no misleading claims, must be relevant to the venue

### 6.7 Technical Requirements

- `venue_follows` table: `user_id`, `venue_id`, `followed_at`
- `venue_notifications` table: `id`, `venue_id`, `type`, `title`, `body`, `deep_link`, `sent_at`, `recipient_count`
- `venue_notification_deliveries` table: `notification_id`, `user_id`, `delivered_at`, `opened_at`
- Push notification sending via existing Expo push notification infrastructure
- Rate limiting middleware on the notification-send API
- Unfollow rate tracking and warning system

---

## 7. Loyalty Programs (Phase 5)

### 7.1 What It Is

Venue owners define reward rules, and the app automatically tracks progress using check-in data. Users earn rewards without punch cards or separate apps.

### 7.2 How It Works

**Venue setup:**
1. Venue manager opens Venue Manager → "Loyalty Program"
2. Creates a reward rule:
   - **Type:** "Every X check-ins" or "X check-ins within Y days"
   - **Reward:** Free text (e.g., "1 free hour of play", "Free drink at the bar", "20% off next session")
   - **Example:** "Every 10th check-in → 1 free hour"
3. Activates the program. It appears on their venue detail page.

**User experience:**
1. User sees a loyalty progress card on the venue detail page: "3/10 check-ins — 7 more for a free hour!"
2. Progress updates automatically with each check-in. Animated progress bar fills.
3. When a reward is earned: celebration animation + push notification + a "Reward earned!" badge on the venue.
4. User shows the reward screen to the venue staff to redeem. Staff taps "Confirm redemption" in the app (requires staff-level venue access).
5. Redeemed reward is logged and archived.

### 7.3 Pricing

- **€19/month** as an add-on to any paid analytics plan
- Or bundled into a "Business+" plan at €69/month (Business analytics + Loyalty + enhanced notifications)

### 7.4 Technical Requirements

- `loyalty_programs` table: `id`, `venue_id`, `rule_type`, `checkins_required`, `time_window_days` (nullable), `reward_description`, `active`
- `loyalty_progress` table: `user_id`, `program_id`, `qualifying_checkins INT`, `earned_at` (nullable), `redeemed_at` (nullable)
- Trigger or function that updates loyalty progress on each check-in
- Redemption flow: QR code or simple button with staff confirmation
- UI: progress card component on venue detail, reward earned modal

---

## 8. Sponsored Challenges (Phase 6)

### 8.1 What It Is

Venues or brands sponsor app-wide challenges that appear in the challenge system alongside organic monthly challenges.

### 8.2 Examples

| Sponsor | Challenge | Reward | Duration |
|---|---|---|---|
| Club Tenis Timisoara | "Check in 5 times at Club Tenis this month" | "Free entry to our Saturday tournament" | 30 days |
| Butterfly (equipment brand) | "Play at 10 different venues this quarter" | "20% off Butterfly equipment at partner store" | 90 days |
| City sports department | "Try 3 new venues in Cluj this month" | "Featured in our Player of the Month spotlight" | 30 days |

### 8.3 How It Works

1. Sponsor contacts TTPortal team (or self-serve portal in later phases).
2. Challenge is configured: title, description, criteria (check-in count, venue count, specific venues, time window), reward description, sponsor branding.
3. Challenge appears in the ChallengeBanner and a dedicated Challenges section.
4. Users who complete the challenge receive the reward (digital or redeemable code).

### 8.4 Pricing

- **€30** for a single-venue challenge (shown to users who have visited or favorited the venue)
- **€50** for a city-wide challenge (shown to all users in the city)
- **€80** for a national/app-wide challenge (shown to all users)
- Custom pricing for brand partnerships (equipment manufacturers, sports organizations)

### 8.5 Technical Requirements

- `sponsored_challenges` table: extends challenge system with `sponsor_venue_id` (nullable), `sponsor_name`, `sponsor_logo_url`, `budget_cents`, `reward_type`, `reward_code`, `target_audience`
- Challenge completion tracking (reuse existing challenge progress system)
- Sponsor branding in the ChallengeBanner (small "Sponsored by X" label)
- Reward redemption: generate unique codes or deep-link to sponsor's redemption flow

---

## 9. Future Considerations

### 9.1 Anonymized Market Reports

Sell quarterly aggregate reports to:
- City sports departments ("Table tennis activity in your city grew 23% this quarter")
- Tourism boards ("Top 10 most visited sports venues by tourists")
- Table tennis federations ("Player engagement trends across Romania")

All data fully anonymized and aggregated at city level. No venue-specific or user-specific data. Pricing: custom, per-report.

### 9.2 Table Reservation Integration

If venues want to accept reservations through the app:
- Users book a table for a specific time slot
- Venue confirms or auto-accepts
- Revenue model: €0.50–1.00 booking fee per reservation (paid by venue, not user) or monthly flat fee

This is a significant feature build and should only be pursued once the analytics dashboard proves venues are willing to pay.

### 9.3 Equipment Brand Partnerships

Table tennis equipment brands (Butterfly, Stiga, Joola, DHS) could:
- Sponsor badges ("Butterfly Player" badge for users who check in at 20+ venues)
- Advertise in a non-intrusive "Shop" section
- Offer exclusive discounts to active players (based on check-in streak)

Revenue: sponsorship deals, affiliate commissions.

---

## 10. Pricing Summary

### For Venues

| Plan | Monthly | Annual (20% off) | Includes |
|---|---|---|---|
| Claimed (free) | €0 | €0 | Basic stats, claim badge |
| Verified Profile | — | €99/year | Custom profile, contact info, hours, verified badge, search boost |
| Pro Analytics | €29/mo | €279/year | Full analytics dashboard, 2 free notifications/week |
| Business Analytics | €59/mo | €569/year | Pro + competitive benchmarking, group size, catchment, exports |
| Business+ | €69/mo | €669/year | Business + Loyalty program |

### A La Carte

| Feature | Pricing |
|---|---|
| Promoted Event | €5–15 per campaign |
| Extra notifications (beyond 2/week) | €0.03 per user reached |
| Sponsored Challenge | €30–80 per campaign |

---

## 11. User Data Rights & Transparency

### What Users See

A "Your Data" section in Settings that clearly shows:
- "Your check-ins contribute to anonymized venue statistics (e.g., 'this venue had 45 visitors this week'). No venue ever sees your name or profile."
- Toggle: "Contribute to venue analytics" (on by default, easily toggled off)
- Toggle: "Receive event suggestions" (for promoted events)
- List of followed venues with unfollow buttons
- "Download my data" button (GDPR compliance)
- "Delete my account and all data" button

### What We Commit To

1. We never sell individual user data to any third party.
2. Venues only see aggregated, anonymized metrics with a minimum threshold of 5 users.
3. Users can opt out of analytics contribution at any time without losing any app functionality.
4. All promotional notifications require explicit opt-in (Follow) and are easily dismissed.
5. We comply with GDPR, including right to access, rectification, and erasure.

---

## 12. Implementation Roadmap

| Phase | Scope | Estimated Effort | Revenue Start |
|---|---|---|---|
| 1 | Venue claiming + Verified Profile | 3-4 weeks | Month 2 |
| 2 | Analytics Dashboard (Pro + Business) | 5-6 weeks | Month 3 |
| 3 | Promoted Events | 2-3 weeks | Month 4 |
| 4 | Follow system + Venue Notifications | 3-4 weeks | Month 5 |
| 5 | Loyalty Programs | 3-4 weeks | Month 7 |
| 6 | Sponsored Challenges | 2-3 weeks | Month 8 |

### Key Dependencies

- **Stripe integration** needed before Phase 1 launches (payment processing)
- **Web dashboard** can start as in-app screens (Phase 1-2) and expand to web later
- **Push notification infrastructure** already exists (Expo push) — Phase 4 extends it
- **Venue claiming** is the foundation — must be solid before anything else

---

## 13. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Venues claimed | 30% of active venues in top 3 cities |
| Verified venues | 15% of claimed venues |
| Paid analytics subscribers | 10% of claimed venues |
| Monthly recurring revenue | €500–1,000 |
| Promoted events per month | 10–20 |
| User opt-out rate (analytics) | <5% |
| Venue notification unfollow rate | <10% per notification |

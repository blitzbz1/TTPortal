# TT Portal — Business Specification

**Version:** 1.0
**Last updated:** 2026-03-26
**Status:** Active development

---

## 1. Product Overview

### 1.1 Vision
TT Portal is a community-driven platform for discovering, reviewing, and sharing table tennis (ping pong) venues across Romania. It connects players with nearby tables — in public parks and indoor clubs — and adds a social layer where friends can check in, find each other on the map, and build play history together.

### 1.2 Target Audience
- **Recreational players** looking for nearby outdoor tables in parks
- **Club players** searching for indoor facilities with professional equipment
- **Social players** who want to coordinate games with friends
- **Contributors** who add new venues and keep information up to date

### 1.3 Core Value Proposition
- **Find:** Locate table tennis venues on an interactive map with real-time condition data
- **Share:** Add new venues, upload photos, and write reviews for the community
- **Play together:** See where friends are checked in, coordinate meetups, and track play history

---

## 2. Platform & Technology

### 2.1 Architecture
| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (single-page application) |
| Maps | Leaflet 1.9.4 with OpenStreetMap tiles |
| Backend / Database | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Geocoding | Photon (Komoot) — primary; Nominatim (OSM) — fallback |
| Hosting | GitHub Pages (static) |
| Typography | Google Fonts — Syne (headings), DM Sans (body) |

### 2.2 Design System
| Token | Value |
|-------|-------|
| Primary green | `#14532d` (dark), `#166534` (mid), `#22c55e` (light) |
| Cream / background | `#fafaf8` (base), `#f4f4ef` (dark), `#ecece4` (mid) |
| Ink / text | `#111810` (primary), `#4a4f47` (muted), `#9ca39a` (faint) |
| Orange / CTA | `#c2410c` (deep), `#ea580c` (bright) |
| Blue / indoor | `#1e40af` (dark), `#eff6ff` (pale) |
| Purple / social | `#7c3aed` (dark), `#a78bfa` (mid), `#f3f0ff` (pale) |
| Border | `#e2e4de` (standard), `#eceee8` (light) |
| Radius | 6px (sm), 10px (md), 14px (lg) |

### 2.3 Mobile-First Approach
The design targets iPhone 14 dimensions (390 x 844 px). The current web implementation is responsive at a 768px breakpoint — below that, the sidebar becomes a bottom sheet and the detail panel goes full-width.

---

## 3. User Flows & Screens

### 3.0 Signup / Login (Screen 00)
**Purpose:** Authenticate users before accessing social features.

#### 3.0.1 Registration
- **Fields:** Full name, email, password (with show/hide toggle)
- **Validation:** Email format, password minimum length
- **Social auth:** Google OAuth, Apple Sign-In
- **Language:** RO/EN toggle preserved from splash

#### 3.0.2 Login
- Tab switcher between "Înregistrare" (Sign up) and "Conectare" (Sign in)
- Same form layout minus the name field
- "Forgot password" link → navigates to Forgot Password screen (09)

#### 3.0.3 Terms & Privacy
- Registration implies acceptance of Terms of Service and Privacy Policy
- Links displayed below the submit button

---

### 3.1 Splash / City Picker (Screen 01)
**Purpose:** First-run entry point. Determines the user's city context before loading venues.

#### 3.1.1 Location Detection
- GPS geolocation button ("Folosește locația mea")
- On success: find nearest city from the `cities` table, switch to it, enable "Near me" sort
- On failure: show error toast, keep city grid visible

#### 3.1.2 City Grid
- Displays top 8 cities ordered by `venue_count` descending
- Each button shows city name + venue count badge
- Tapping a city stores it in `localStorage` and bypasses splash on next visit

#### 3.1.3 Language Toggle
- RO (default) / EN
- Persisted in `localStorage` as `ttportal-lang`
- Applies to all UI strings via the `STRINGS` i18n dictionary

#### 3.1.4 Skip Logic
- If `ttportal-city` exists in localStorage, splash is skipped and the saved city loads directly

---

### 3.2 Map View — Main Screen (Screen 02)
**Purpose:** Primary navigation interface. Interactive map + searchable venue list.

#### 3.2.1 Header Bar
| Element | Behavior |
|---------|----------|
| Logo (TT PORTAL) | Tap resets view to city center, clears filters |
| City switcher | Opens city modal; shows current city or "Toată România" |
| Language toggle | EN/RO (desktop only — hidden on mobile) |
| "Adaugă" button | Opens Add Venue modal (orange CTA) |

#### 3.2.2 Map Layer
- **Tile provider:** OpenStreetMap via Leaflet
- **Markers:** Color-coded circles based on venue condition (`stare`):
  - Green (`#22c55e`) — Good condition (`buna`)
  - Amber (`#f59e0b`) — Fair condition (`acceptabila`)
  - Red (`#ef4444`) — Poor condition (`deteriorata`)
  - Gray (`#94a3b8`) — Unknown condition (`necunoscuta`)
  - Blue (`#1a5080`) — Indoor venue / Professional (`profesionala`)
- **Marker icons:** 🏓 for parks, 🏢 for indoor
- **Selected marker:** Enlarged (34px vs 28px) with thicker border and stronger shadow
- **Unfiltered markers:** Displayed as small gray dots at 40% opacity
- **Legend:** Top-right overlay explaining marker colors
- **Zoom controls:** Bottom-right
- **User position:** Blue circle marker when location is active

#### 3.2.3 Friend Check-In Avatars (Planned)
- Small purple/pink circular avatars (22px) displayed near venue markers
- Show initials of friends currently checked in at that venue
- White border to separate from map background

#### 3.2.4 Venue List Panel
- **Mobile:** Bottom sheet with drag handle, collapsible (48vh height)
- **Desktop:** Left sidebar (380px)

| Component | Details |
|-----------|---------|
| Search bar | Filters by name, address, city, sector, tags |
| "Near me" button | Requests geolocation, sorts by distance, shows distance badges |
| Filter chips | All, Parks (🌳), Indoor (🏢), Verified (✓) |
| List header | Shows count: "X locații afișate" |
| Venue cards | Name, type badge, meta (city/sector/tables/condition), star rating, tags, distance |

#### 3.2.5 City Switcher Modal
- Search input to filter cities by name or county
- "Toată România" option to show all venues nationwide
- Each city shows name, county, and venue count
- Active city highlighted in green

---

### 3.3 Venue Detail (Screen 03)
**Purpose:** Full information about a single venue.

#### 3.3.1 Photo Strip
- Horizontal scrollable strip of venue photos
- Tap to open lightbox overlay
- Upload button in edit mode (max 5MB per file, stored in Supabase Storage at `venue-photos/{venueId}/`)

#### 3.3.2 Venue Information
| Field | Source |
|-------|--------|
| Name | `venues.name` |
| Type badge | Outdoor park / Indoor venue |
| Condition badge | Color-coded status |
| Verified badge | Green "✓ verified" if `verificat = true` |
| Distance badge | Calculated from user position if available |
| City badge | Shown when viewing all of Romania |
| Address | Full address string |
| Table count | Number of tables or "Count unconfirmed" |
| Hours | Operating hours text |
| Pricing | "Acces gratuit" or tariff string |
| Night lighting | Yes/No |
| Nets | Present/Missing (outdoor parks only) |
| Website | Clickable link |
| Description | Free text |
| Tags | Comma-separated tags displayed as pills |

#### 3.3.3 Friends Here Section (Planned)
- Purple-themed section showing friends currently checked in
- Each friend: avatar circle (initials), name, "checked in X min ago"
- "Check in" button to announce your presence at this venue
- Visible only when logged in

#### 3.3.4 Directions
Three deep-link buttons:
- **Google Maps** — `https://maps.google.com/maps/dir/?api=1&destination={lat},{lng}`
- **Apple Maps** — `https://maps.apple.com/?daddr={lat},{lng}&dirflg=d`
- **Waze** — `https://waze.com/ul?ll={lat},{lng}&navigate=yes`

#### 3.3.5 Reviews
- Aggregate rating (1–5 stars) with review count
- Chronological list of community reviews (newest first)
- Each review: author name (or "Anonim"), star rating, text, date
- "Scrie o recenzie" button to open review modal

#### 3.3.6 Edit Mode
- Available to any user (community-driven editing)
- Full edit form including all venue fields, coordinates, photos, checkboxes
- Geocode button for address resolution
- Manual lat/lng input as fallback

---

### 3.4 Add Venue — Bottom Sheet (Screen 04)
**Purpose:** Community-contributed venue submission.

#### 3.4.1 Required Fields
- Name (`*`)
- Venue type: "Parc exterior" or "Sală indoor" (`*`)
- City (`*`)
- Address (`*`)

#### 3.4.2 Optional Fields
- County, Sector/Zone, Table count, Hours, Notes

#### 3.4.3 Geocoding Flow
1. User enters address and city
2. "Localizează" button triggers geocoding via Photon API
3. Results filtered to Romania bounding box (lat 43.5–48.5, lng 20–30)
4. Fallback to Nominatim if Photon fails
5. If both fail: show "Not found" with Google Maps link + manual coordinate inputs
6. If no coordinates at submission: enter crosshair mode — user clicks map to place marker

#### 3.4.4 Defaults
- Condition: "necunoscuta" (unknown)
- Free access: auto-set to `true` for outdoor parks
- Tags: ["nou adăugat"]

---

### 3.5 Write Review — Modal (Screen 05)
**Purpose:** Submit a community review for a venue.

#### 3.5.1 Fields
| Field | Required | Details |
|-------|----------|---------|
| Name | No | Placeholder "Poreclă sau prenume", defaults to "Anonim" |
| Rating | Yes | 1–5 star tap selector |
| Review text | Yes | Textarea with placeholder "Starea meselor? Atmosferă?" |

#### 3.5.2 Submission
- Saves to `reviews` table with `venue_id`, `name`, `rating`, `text`
- Auto-refreshes venue detail panel and list card ratings
- Toast confirmation: "Recenzie publicată!"

---

### 3.6 Profile (Screen 06)
**Purpose:** User's personal dashboard with stats, activity, and settings.

#### 3.6.1 User Identity
- Avatar circle with initials (88px)
- Online status indicator (green dot)
- Full name, @username, city
- Badges: "Jucător activ", "Top contributor" (earned based on activity thresholds)

#### 3.6.2 Stats Cards
| Stat | Description |
|------|-------------|
| Check-ins | Total number of venue check-ins |
| Recenzii | Total reviews written |
| Locații adăugate | Total venues contributed |

#### 3.6.3 Quick Action Buttons
- **Prieteni** (green) — navigates to Friends screen
- **Istoric joc** (purple) — navigates to Play History screen
- **Favorite** (orange) — navigates to saved/favorited venues (future)

#### 3.6.4 Recent Activity Feed
Chronological list of recent actions:
- Check-ins (green pin icon)
- Reviews (orange star icon)
- Social interactions (purple users icon)

Each entry: icon, title, subtitle with timestamp

#### 3.6.5 Settings Menu
| Setting | Type |
|---------|------|
| Notificări | Toggle |
| Limbă | Display current (RO) |
| Confidențialitate | Navigation |
| Deconectare | Destructive action (red text) |

---

### 3.7 Friends & Invites (Screen 07)
**Purpose:** Social connections management — friend list, invitations, discovery.

#### 3.7.1 Search
- Full-width search bar: "Caută prieteni..."
- Searches by name or username

#### 3.7.2 Tabs
| Tab | Content |
|-----|---------|
| Toți (24) | All friends, active tab (green underline) |
| Online (5) | Only friends currently online |
| În așteptare (3) | Pending invitations (incoming + outgoing) |

#### 3.7.3 Pending Invitations
- Purple-themed cards (`#f3f0ff` background, `#a78bfa` border)
- Each card: avatar (initials), name, mutual friend count
- Actions: "Acceptă" button (green) + dismiss (X icon)

#### 3.7.4 Friend List
Each friend row contains:
- Avatar circle with initials (44px) and optional online dot (green, 12px)
- Name
- Status line:
  - **Online + checked in:** Green pin icon + venue name + time ("Parcul Herăstrău · acum")
  - **Online:** Green dot only
  - **Offline:** Gray text "Ultima activitate: ieri"
- Message icon button (chat — future feature)

#### 3.7.5 Share Invite Section
- Green-themed card (`#f0fdf4`)
- "Invită prieteni" — share invitation link via WhatsApp, SMS, or email
- Share icon + chevron for navigation

#### 3.7.6 Header Actions
- Back arrow (navigation)
- "Invită" button (green pill with user-plus icon)

---

### 3.8 Play History (Screen 08)
**Purpose:** Personal check-in log with stats and timeline.

#### 3.8.1 Stats Summary
Three color-coded cards:
| Stat | Color | Example |
|------|-------|---------|
| Check-ins | Green (`#f0fdf4`) | 47 |
| Locații (unique venues) | Purple (`#f3f0ff`) | 18 |
| Timp jucat (total time) | Orange (`#fff7ed`) | 32h |

#### 3.8.2 Streak Indicator
- Flame icon + "Serie activă: X zile consecutive!"
- Gamification element to encourage daily play

#### 3.8.3 Timeline
Grouped by date with visual timeline (left border line + date dot markers):

**Date headers:**
- "Azi — 26 Martie" (green dot for today)
- "Ieri — 25 Martie" (gray dot)
- Older dates (gray dot)

**Each entry:**
| Field | Details |
|-------|---------|
| Venue icon | Color-coded square (green = park, blue = indoor) with map-pin |
| Venue + table | "Parcul Herăstrău — Masa 3" |
| Time range | "14:30 – 16:00" |
| Duration | Clock icon + "1h 30m" |
| Friends | Purple users icon + "cu Radu C., Elena V." (if played with friends) |
| Navigation | Chevron-right to open venue detail |

#### 3.8.4 Load More
- "Mai vechi" button to load older history entries
- Paginated — prevents loading entire history at once

#### 3.8.5 Date Filter
- Calendar icon + current month ("Mar 2026") in header
- Tap to filter by month/date range

### 3.9 Forgot Password (Screen 09)
**Purpose:** Allow users to reset their password via email link.

#### 3.9.1 Layout
- Dark green background matching Auth screen (00)
- TT PORTAL logo at top
- Lock icon in circular green container
- "Resetează parola" title + descriptive text

#### 3.9.2 Form
- Email input field with mail icon
- "Trimite link de resetare" green CTA button with send icon
- Info hint: "Verifică inbox-ul și folderul spam. Link-ul expiră în 60 de minute."

#### 3.9.3 Navigation
- "Înapoi la conectare" back link → returns to Auth screen (00)
- Accessed from: Auth screen login tab (future "Ai uitat parola?" link)

---

### 3.10 Condition Voting (Screen 10)
**Purpose:** Crowdsourced table condition evaluation — users vote on the current state of a table.

#### 3.10.1 Layout
- Bottom sheet overlay on dimmed map background (same pattern as screens 04, 05)
- Drag handle + "Starea mesei" title + close button

#### 3.10.2 Venue Context
- Venue name + table number ("Parcul Herăstrău — Masa 3")
- Last evaluation date ("Ultima evaluare: acum 14 zile")

#### 3.10.3 Voting Options
Three condition choices (radio-style selection):
| Option | Color | Description |
|--------|-------|-------------|
| Bună | Green (`#22c55e` border, selected) | "Masa e dreaptă, suprafață netedă, fileul intact" |
| Acceptabilă | Amber | "Folosibilă dar cu mici defecte vizibile" |
| Deteriorată | Red | "Suprafață deteriorată, fileul lipsă sau rupt" |

#### 3.10.4 Photo Upload
- Optional photo section with dashed-border camera button
- "Fotografiază masa" CTA

#### 3.10.5 Vote Statistics
- Aggregate bar: "23 evaluări · ultima: acum 14 zile · 78% «Bună»"
- Vote stats icon + text in gray card

#### 3.10.6 Footer Actions
- "Anulează" (outlined) + "Trimite vot" (green filled with send icon)
- Accessed from: Venue Detail screen (03) "Evaluează starea mesei" button

---

### 3.11 Event Scheduling (Screen 11)
**Purpose:** Organize and discover table tennis meetups and tournaments.

#### 3.11.1 Header
- Back arrow + "Evenimente" title
- Orange "Creează" button with plus icon

#### 3.11.2 Tabs
| Tab | Content |
|-----|---------|
| Viitoare (4) | Upcoming events (active tab, orange underline) |
| Trecute | Past events |
| Ale mele | Events created by the user |

#### 3.11.3 Event Cards
Each event card contains:
| Element | Details |
|---------|---------|
| Date box | Colored square with day number + month abbreviation |
| Title | Event name (bold) |
| Time | Day of week + time range |
| Venue | Map-pin icon + venue name + table number |
| Capacity | Badge showing filled/total slots (e.g., "4/6 locuri") |
| Attendees | Overlapping avatar stack + overflow count |
| Action | "Participă" button (green filled for first event, outlined for others) |
| Type badge | "Indoor" badge for indoor events |

#### 3.11.4 Navigation
- Accessible via bottom tab bar (all screens with tab bar)
- Back arrow returns to previous screen

---

### 3.12 Leaderboards (Screen 12)
**Purpose:** Community rankings to gamify venue check-ins and contributions.

#### 3.12.1 Header
- Back arrow + "Clasament" title
- City filter pill ("București") with map-pin icon

#### 3.12.2 Tabs
| Tab | Ranking Criteria |
|-----|-----------------|
| Check-ins | Total venue check-ins (active, green underline) |
| Recenzii | Total reviews written |
| Locații | Total venues contributed |

#### 3.12.3 Podium (Top 3)
- Centered layout with emoji medals (🥇🥈🥉)
- Circular avatars with initials (64px for #1, 52px for #2/#3)
- Name + score below each avatar
- #1 has green border ring and green score text

#### 3.12.4 Rank List (Positions 4+)
- Numbered rows with avatar, name, and score
- Standard list layout with 36px avatars

#### 3.12.5 My Rank Footer
- Fixed green bar at bottom showing user's own position
- "#15" rank number + avatar + name + score
- Trending-up icon indicating progress

#### 3.12.6 Navigation
- Accessible via bottom tab bar
- Back arrow returns to previous screen

---

### 3.13 Admin Moderation (Screen 13)
**Purpose:** Admin panel for reviewing user-submitted venues and flagged reviews.

#### 3.13.1 Header
- Dark green background (matches app branding, distinct from standard white headers)
- Back arrow + "Moderare" title + green "Admin" badge pill

#### 3.13.2 Stats Dashboard
Three summary cards:
| Stat | Color | Value |
|------|-------|-------|
| În așteptare | Orange (`#fff7ed`) | Pending venue count |
| Aprobate | Green (`#f0fdf4`) | Approved venue count |
| Raportate | Red (`#fef2f2`) | Flagged review count |

#### 3.13.3 Pending Venues Section
- "LOCAȚII ÎN AȘTEPTARE" section header
- Venue card with amber border (`#f59e0b`)
- "Nou" badge, submitter info (@username, time, location)
- Three action buttons:
  - "Aprobă" (green filled with check icon)
  - "Editează" (outlined with pencil icon)
  - "Respinge" (red outlined with X icon)

#### 3.13.4 Flagged Reviews Section
- "RECENZII RAPORTATE" section header
- Review card with red border (`#ef4444`)
- Report count badge ("2 rapoarte")
- Italic quoted review text
- Two action buttons:
  - "Păstrează" (outlined)
  - "Șterge" (red filled with trash icon)

#### 3.13.5 Navigation
- Accessed from: Profile screen (06) Settings → "Moderare" row (admin-only, with "Admin" badge)
- Back arrow returns to Profile

---

### 3.14 Favorites (Screen 14)
**Purpose:** Saved/bookmarked venues for quick access.

#### 3.14.1 Header
- Back arrow + "Favorite" title
- Sort button ("Recent") with arrow-up-down icon

#### 3.14.2 Favorite Cards
Each card contains:
| Element | Details |
|---------|---------|
| Venue icon | Color-coded map-pin in rounded square (green = park, blue = indoor) |
| Name | Venue name (bold) |
| Meta badges | Type badge + condition dot + star rating |
| Subtitle | City, table count, save date |
| Heart icon | Red filled heart (tap to unfavorite) |

#### 3.14.3 Navigation
- Accessible via bottom tab bar + Profile quick action "Favorite"
- Back arrow returns to previous screen

---

### 3.15 Global Navigation (Tab Bar)
**Purpose:** Persistent bottom navigation for all primary screens.

#### 3.15.1 Tab Bar Component
- Reusable component (`Component/TabBar`, node `LiSjK`)
- 56px height, white background, top border (`#e2e4de`)
- 5 tabs with icon + label (10px DM Sans)

#### 3.15.2 Tabs
| Tab | Icon | Target Screen | Color (active) |
|-----|------|--------------|----------------|
| Hartă | `map` | 02 — Map View | `#14532d` |
| Evenimente | `calendar` | 11 — Event Scheduling | `#14532d` |
| Clasament | `trophy` | 12 — Leaderboards | `#14532d` |
| Favorite | `heart` | 14 — Favorites | `#14532d` |
| Profil | `user` | 06 — Profile | `#14532d` |

#### 3.15.3 Active State
- Active tab: icon + label in dark green (`#14532d`), fontWeight 600
- Inactive tabs: icon + label in muted gray (`#9ca39a`), fontWeight 500

#### 3.15.4 Screens with Tab Bar
Present on: 02 (Map), 06 (Profile), 11 (Events), 12 (Leaderboards), 14 (Favorites)
**Not** present on: 00 (Auth), 01 (Splash), 03 (Detail), 04 (Add Venue), 05 (Review), 07 (Friends), 08 (Play History), 09 (Forgot Password), 10 (Condition Voting), 13 (Admin)

---

## 4. Data Model

### 4.1 Database Tables

#### `cities`
| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| name | text | City name (e.g., "București") |
| county | text | County/region |
| lat | float | City center latitude |
| lng | float | City center longitude |
| zoom | int | Default map zoom level |
| venue_count | int | Cached count of venues in city |
| active | boolean | Whether city is shown in picker |

#### `venues`
| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| name | text | Venue display name |
| type | enum | `parc_exterior` or `sala_indoor` |
| city | text | City name |
| county | text | County |
| sector | text | Sector or zone (nullable) |
| address | text | Full street address |
| lat | float | Latitude |
| lng | float | Longitude |
| tables | int | Number of tables (nullable) |
| stare | enum | `buna`, `acceptabila`, `deteriorata`, `necunoscuta`, `profesionala` |
| hours | text | Operating hours |
| description | text | Free-text description |
| tags | text[] | Array of tags |
| photos | text[] | Array of photo URLs |
| acces_gratuit | boolean | Free access flag |
| nocturna | boolean | Night lighting available |
| fileuri | boolean | Nets present |
| verificat | boolean | Community-verified |
| tarif | text | Pricing info (nullable) |
| website | text | External URL (nullable) |
| created_at | timestamp | Auto-set |

#### `reviews`
| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| venue_id | int (FK) | References `venues.id` |
| name | text | Reviewer display name |
| rating | int | 1–5 |
| text | text | Review body |
| created_at | timestamp | Auto-set |

#### `users` (Planned)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Supabase Auth UID |
| full_name | text | Display name |
| username | text (unique) | @handle |
| avatar_url | text | Profile photo URL (nullable) |
| city | text | Home city |
| lang | enum | `ro` or `en` |
| created_at | timestamp | Auto-set |

#### `friendships` (Planned)
| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| requester_id | uuid (FK) | User who sent the request |
| addressee_id | uuid (FK) | User who received the request |
| status | enum | `pending`, `accepted`, `declined` |
| created_at | timestamp | Auto-set |

#### `checkins` (Planned)
| Column | Type | Description |
|--------|------|-------------|
| id | int (PK) | Auto-increment |
| user_id | uuid (FK) | References `users.id` |
| venue_id | int (FK) | References `venues.id` |
| table_number | int | Optional table identifier |
| started_at | timestamp | Check-in time |
| ended_at | timestamp | Check-out time (nullable — still active if null) |
| friends | uuid[] | Array of friend user IDs who played together |

### 4.2 Storage Buckets
| Bucket | Path Pattern | Access |
|--------|-------------|--------|
| `venue-photos` | `venues/{venueId}/{timestamp}.{ext}` | Public read, authenticated write |
| `avatars` (planned) | `avatars/{userId}.{ext}` | Public read, owner write |

---

## 5. Feature Status

### 5.1 Implemented (v1.0 — Current)
- [x] Splash screen with GPS detection and city picker
- [x] Interactive Leaflet map with color-coded venue markers
- [x] Venue list with search, filtering (type, verified), and "Near me" sort
- [x] Venue detail panel with full info, directions, reviews, photos
- [x] Add venue form with dual geocoding (Photon + Nominatim) and map-click fallback
- [x] Edit venue with all fields including photo upload
- [x] Write review modal with star rating
- [x] City switcher with search
- [x] Bilingual UI (Romanian + English) with full i18n dictionary
- [x] Language persistence in localStorage
- [x] City persistence in localStorage
- [x] Responsive layout (desktop sidebar ↔ mobile bottom sheet)
- [x] Photo lightbox viewer
- [x] Seed data for București (14 venues)

### 5.2 Designed — Not Yet Implemented
- [ ] **User authentication** — Email/password + Google + Apple (Screen 00)
- [ ] **Forgot password** — Email-based password reset flow (Screen 09)
- [ ] **User profiles** — Avatar, stats, badges, activity feed (Screen 06)
- [ ] **Friend system** — Send/accept invites, friend list with online status (Screen 07)
- [ ] **Check-in system** — Announce presence at a venue (Screen 03 "Friends Here" section)
- [ ] **Friend map avatars** — Purple dots showing friend locations on the map (Screen 02)
- [ ] **Play history** — Check-in log with timeline, stats, streaks (Screen 08)
- [ ] **Condition voting** — Crowdsourced table condition evaluation (Screen 10)
- [ ] **Event scheduling** — Organize meetups and tournaments (Screen 11)
- [ ] **Leaderboards** — Community rankings by check-ins, reviews, venues (Screen 12)
- [ ] **Admin moderation** — Review pending venues and flagged reviews (Screen 13)
- [ ] **Favorites** — Save/bookmark venues with dedicated screen (Screen 14)
- [ ] **Global tab bar** — Bottom navigation across primary screens (Component)
- [ ] **Notifications** — Push/in-app notifications for friend activity
- [ ] **In-app messaging** — Chat with friends (message icons in friend list)

### 5.3 Future Considerations (Not Yet Designed)
- [ ] Push notifications via Supabase Realtime or web push
- [ ] Native mobile apps (iOS/Android) or PWA wrapper
- [ ] Venue claim by owners (for indoor clubs)
- [ ] In-app route/navigation

---

## 6. Internationalization (i18n)

### 6.1 Supported Languages
| Code | Language | Status |
|------|----------|--------|
| `ro` | Romanian | Default, complete |
| `en` | English | Complete |

### 6.2 Implementation
- All user-facing strings stored in `STRINGS` object (`js/ui.js`)
- Dynamic strings use function values: `shown: (n) => n + ' locații afișate'`
- Language selected via `LANG` variable, persisted in `localStorage`
- `s(key, ...args)` helper resolves strings with automatic English fallback

### 6.3 UI Content Language
- Venue data (names, addresses, descriptions) is in Romanian regardless of UI language
- System labels, buttons, and messages are translated

---

## 7. Non-Functional Requirements

### 7.1 Performance
- Initial load targets < 3s on 4G mobile
- Map tiles lazy-loaded by Leaflet
- Venue list renders incrementally (no pagination yet — all venues in memory)
- Photos use `loading="lazy"` attribute

### 7.2 Accessibility
- Semantic HTML structure
- Keyboard navigable modals and buttons
- Sufficient color contrast (dark green on white, white on green)
- Touch targets ≥ 44px on mobile

### 7.3 Security
- Supabase anon key used for public read/write (community-driven model)
- Photo uploads limited to 5MB per file
- Geocoding restricted to Romania bounding box
- No personal data collected currently (anonymous venue adds + reviews)
- Future: Supabase Auth for user identity; Row Level Security (RLS) for user-specific data

### 7.4 Offline Behavior
- Currently requires internet (no service worker or caching)
- localStorage used only for language and city preferences
- Future: Consider PWA with offline map tile caching

### 7.5 Browser Support
- Modern browsers (Chrome, Safari, Firefox, Edge — last 2 versions)
- Mobile Safari (iOS 15+) and Chrome Mobile (Android 10+)
- No IE11 support

---

## 8. Design Screens Inventory

| # | Screen | Node ID | Dimensions | Tab Bar | Status |
|---|--------|---------|------------|---------|--------|
| 00 | Signup / Login | `YOQkr` | 390 x 844 | No | Designed |
| 01 | Splash / City Picker | `Jxo75` | 390 x 844 | No | Implemented |
| 02 | Map View (Main) | `dSLXo` | 390 x 844 | Yes (Hartă) | Implemented |
| 03 | Venue Detail | `TPyeF` | 390 x 844 | No | Implemented |
| 04 | Add Venue (Bottom Sheet) | `CXyxO` | 390 x 844 | No | Implemented |
| 05 | Write Review (Modal) | `OdSGE` | 390 x 844 | No | Implemented |
| 06 | Profile | `YQLVn` | 390 x 844 | Yes (Profil) | Designed |
| 07 | Friends & Invites | `jwip1` | 390 x 844 | No | Designed |
| 08 | Play History | `zD8fn` | 390 x 844 | No | Designed |
| 09 | Forgot Password | `Bj2GF` | 390 x 844 | No | Designed |
| 10 | Condition Voting | `FE5FK` | 390 x 844 | No | Designed |
| 11 | Event Scheduling | `Tni7y` | 390 x 844 | Yes (Evenimente) | Designed |
| 12 | Leaderboards | `yeolP` | 390 x 844 | Yes (Clasament) | Designed |
| 13 | Admin Moderation | `N4EHa` | 390 x 844 | No | Designed |
| 14 | Favorites | `4ADa7` | 390 x 844 | Yes (Favorite) | Designed |

### 8.1 Reusable Components

| Component | Node ID | Used On |
|-----------|---------|---------|
| Component/TabBar | `LiSjK` | Screens 02, 06, 11, 12, 14 |

### 8.2 Navigation Map

```
┌─────────────┐
│  01 Splash   │
└──────┬───────┘
       │
┌──────▼───────┐     ┌───────────────┐
│  00 Auth      │────▶│ 09 Forgot Pwd │
└──────┬───────┘     └───────────────┘
       │
       ▼
┌══════════════════════════════════════════════════════════┐
║                    BOTTOM TAB BAR                        ║
╠════════╦════════════╦════════════╦══════════╦════════════╣
║02 Map  ║11 Events   ║12 Leaders  ║14 Favs   ║06 Profile  ║
╚═══╤════╩════════════╩════════════╩══════════╩═══╤════════╝
    │                                              │
    ├──▶ 03 Venue Detail ──▶ 05 Write Review       ├──▶ 07 Friends
    │         │                                    ├──▶ 08 Play History
    │         ├──▶ 10 Condition Voting             └──▶ 13 Admin (settings)
    │         └──▶ Check-in (in-screen)
    │
    └──▶ 04 Add Venue
```

**Design file:** `design.pen` (Pencil format, accessible via MCP tools only)

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Masă de tenis | Table tennis table |
| Parc exterior | Outdoor park venue |
| Sală indoor | Indoor venue/club |
| Stare | Condition rating of tables |
| Verificat | Community-verified venue |
| Fileuri | Table tennis nets |
| Nocturna | Night lighting at venue |
| Check-in | Announcing presence at a venue |
| Recenzie | Community review |
| Locație | Venue/location |

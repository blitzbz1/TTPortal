# UI Contracts: User Authentication

**Branch**: `001-user-auth` | **Date**: 2026-03-26

These contracts define the interface between UI components and the auth system. They specify what each screen/component expects and produces, without prescribing internal implementation.

---

## Screen: Auth (sign-in.tsx)

**Route**: `/sign-in`
**Protected**: No (accessible without session)

### Props / Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| returnTo | string | No | Route to navigate to after successful auth (for gated action redirects) |
| initialTab | `'signup'` \| `'login'` | No | Which tab to show initially. Default: `'signup'` |

### State

| State | Type | Description |
|-------|------|-------------|
| activeTab | `'signup'` \| `'login'` | Currently visible form |
| fullName | string | Registration only |
| email | string | Email input value |
| password | string | Password input value |
| passwordVisible | boolean | Show/hide password toggle |
| loading | boolean | Submission in progress |
| error | string \| null | Current error message (localized) |

### User Actions → Outcomes

| Action | Outcome |
|--------|---------|
| Toggle tab | Switch between signup/login forms; clear error |
| Submit signup | Validate → create account → navigate to map (or `returnTo`) |
| Submit login | Validate → authenticate → navigate to map (or `returnTo`) |
| Tap Google | Initiate Google OAuth → on success, navigate to map (or `returnTo`) |
| Tap Apple | Initiate Apple auth → on success, navigate to map (or `returnTo`) |
| Tap "Ai uitat parola?" | Navigate to `/forgot-password` |
| Tap Terms/Privacy links | Open external URL |
| Toggle language | Switch app language (RO/EN) |

### Validation Contract

| Field | Rule | Error (RO) | Error (EN) |
|-------|------|------------|------------|
| fullName | Non-empty (signup only) | "Numele este obligatoriu" | "Name is required" |
| email | Valid email format | "Email invalid" | "Invalid email" |
| password | Min 8 characters | "Minim 8 caractere" | "Minimum 8 characters" |
| server | Duplicate email | "Acest email este deja folosit" | "This email is already in use" |
| server | Invalid credentials | "Email sau parola incorectă" | "Incorrect email or password" |
| server | Network error | "Eroare de conexiune. Încearcă din nou." | "Connection error. Try again." |

---

## Screen: Forgot Password (forgot-password.tsx)

**Route**: `/forgot-password`
**Protected**: No

### State

| State | Type | Description |
|-------|------|-------------|
| email | string | Email input value |
| loading | boolean | Submission in progress |
| sent | boolean | Whether reset email was sent (shows success state) |
| error | string \| null | Current error message |

### User Actions → Outcomes

| Action | Outcome |
|--------|---------|
| Submit email | Send reset link → show success message (same response regardless of email existence) |
| Tap "Înapoi la conectare" | Navigate back to `/sign-in` with `initialTab: 'login'` |

### Success Message

- RO: "Verifică inbox-ul și folderul spam. Link-ul expiră în 60 de minute."
- EN: "Check your inbox and spam folder. The link expires in 60 minutes."

---

## Component: Header Profile Icon

**Location**: Header bar (all screens with header)

### States

| Auth State | Icon | Tap Behavior |
|------------|------|-------------|
| Anonymous | Generic user icon (outline) | Navigate to `/sign-in` |
| Authenticated | Circle with user initials (filled, green bg) | Toggle profile popover |

### Profile Popover Contract

| Element | Content |
|---------|---------|
| User name | `session.user.full_name` or "User" fallback |
| User email | `session.user.email` (truncated if long) |
| Logout button | "Deconectare" / "Sign out" — ends session, closes popover, reverts icon to anonymous state |

### Popover Behavior

- Opens on tap of authenticated profile icon
- Closes on: tap outside, tap logout, scroll, navigation
- Positioned below header icon, right-aligned
- Does not cover header bar

---

## Auth Gate Contract

Defines behavior when an unauthenticated user attempts a protected action.

### Gated Actions

| Action | Trigger Point | Return Intent |
|--------|--------------|---------------|
| Add venue | "Adaugă" button in header | `returnTo: '/add-venue'` |
| Write review | "Scrie o recenzie" button in venue detail | `returnTo: '/review/{venueId}'` |
| Edit venue | Edit button in venue detail | `returnTo: '/venue/{venueId}?edit=true'` |

### Flow

1. User taps gated action
2. System checks auth state
3. If unauthenticated: navigate to `/sign-in?returnTo={intent}`
4. After successful auth: navigate to stored `returnTo` route
5. If user cancels auth (navigates back): return to previous screen (no action taken)

---

## Auth Context Contract

Provided by `SessionProvider` at root layout level.

### Exposed Values

| Value | Type | Description |
|-------|------|-------------|
| session | Session \| null | Current auth session (null if anonymous) |
| user | User \| null | Current user profile data |
| isLoading | boolean | True while initial session is being restored |
| signUp | (name, email, password) → Promise | Email registration |
| signIn | (email, password) → Promise | Email login |
| signInWithGoogle | () → Promise | Google OAuth flow |
| signInWithApple | () → Promise | Apple auth flow |
| signOut | () → Promise | End session |
| resetPassword | (email) → Promise | Send password reset email |

### Loading State

While `isLoading` is true (session being restored from storage on app launch), the app should show a splash/loading screen to prevent flicker between auth and unauthenticated states.

# Feature Specification: User Authentication

**Feature Branch**: `001-user-auth`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "User authentication - email/password signup and login with Google and Apple OAuth, forgot password flow, bilingual RO/EN support, based on TT Portal business spec screens 00 and 09"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Email Registration (Priority: P1)

A new visitor to TT Portal wants to create an account so they can access social features like check-ins, friends, and reviews tied to their identity. They navigate to the registration screen, enter their full name, email address, and a password. They submit the form and receive a confirmation that their account has been created.

**Why this priority**: Account creation is the foundational action — without it, no authenticated features can work. This is the minimum viable slice of the entire auth system.

**Independent Test**: Can be fully tested by completing the registration form and verifying the user can subsequently log in. Delivers the ability to create persistent user identities.

**Acceptance Scenarios**:

1. **Given** the user is on the registration screen, **When** they fill in a valid full name, email, and password and submit, **Then** their account is created and immediately active (no email verification required), and they are redirected to the main map view.
2. **Given** the user enters an email already associated with an account, **When** they submit the registration form, **Then** they see an error message indicating the email is already in use.
3. **Given** the user enters a password shorter than the minimum length, **When** they submit the form, **Then** they see a validation error on the password field.
4. **Given** the user enters an invalid email format, **When** they submit the form, **Then** they see a validation error on the email field.
5. **Given** the user has selected English as their language on the splash screen, **When** they view the registration form, **Then** all labels, buttons, and messages are displayed in English.

---

### User Story 2 - Email Login (Priority: P1)

A returning user wants to sign back into their TT Portal account. They switch to the login tab, enter their email and password, and gain access to their authenticated session.

**Why this priority**: Login is equally essential as registration — users must be able to return to their accounts. Together with Story 1, this completes the core email auth cycle.

**Independent Test**: Can be tested by logging in with previously created credentials and verifying the user reaches the authenticated map view with their identity preserved.

**Acceptance Scenarios**:

1. **Given** the user has an existing account, **When** they enter correct email and password on the login tab and submit, **Then** they are authenticated and redirected to the main map view.
2. **Given** the user enters an incorrect password, **When** they submit the login form, **Then** they see an error message indicating invalid credentials (without revealing whether the email exists).
3. **Given** the user is logged in, **When** they close the browser and reopen TT Portal, **Then** their session persists and they are not required to log in again (within a reasonable session duration).
4. **Given** the auth screen is displayed, **When** the user taps the tab switcher between "Inregistrare" and "Conectare", **Then** the form toggles between registration and login modes.

---

### User Story 3 - Google OAuth Sign-In (Priority: P2)

A user prefers to sign in with their Google account rather than creating a separate email/password credential. They tap the Google sign-in button on the auth screen, complete the Google consent flow, and are brought into TT Portal with their Google profile information.

**Why this priority**: Social login dramatically reduces registration friction. Google is the most widely used OAuth provider in Romania and should be prioritized over Apple.

**Independent Test**: Can be tested by tapping the Google sign-in button, completing the OAuth flow, and verifying the user is authenticated with their Google name and email populated.

**Acceptance Scenarios**:

1. **Given** the user is on the auth screen, **When** they tap the Google sign-in button, **Then** a Google OAuth consent screen is presented.
2. **Given** the user completes Google consent, **When** the OAuth callback completes, **Then** the user is authenticated and redirected to the main map view with their Google display name associated with their account.
3. **Given** the user previously signed up with email using the same address as their Google account, **When** they sign in with Google, **Then** the accounts are linked and the user accesses the same profile.

---

### User Story 4 - Apple Sign-In (Priority: P2)

An iOS user prefers to sign in with their Apple ID. They tap the Apple sign-in button, complete the Apple authentication flow, and gain access to TT Portal.

**Why this priority**: Apple Sign-In is expected by iOS users and may be required by App Store policies for future native apps. Grouping it with Google OAuth keeps the social auth story complete.

**Independent Test**: Can be tested by tapping the Apple sign-in button, completing the Apple auth flow, and verifying the user is authenticated.

**Acceptance Scenarios**:

1. **Given** the user is on the auth screen on a device that supports Apple Sign-In, **When** they tap the Apple sign-in button, **Then** the Apple authentication flow is initiated.
2. **Given** the user completes Apple authentication, **When** the callback completes, **Then** the user is authenticated and redirected to the main map view.
3. **Given** the user chose to hide their email during Apple Sign-In, **When** their account is created, **Then** the system stores the Apple relay email and the account functions normally.

---

### User Story 5 - Forgot Password (Priority: P3)

A user cannot remember their password. From the login screen, they tap "Ai uitat parola?" which takes them to the forgot password screen (Screen 09). They enter their email, receive a reset link, and follow it to set a new password.

**Why this priority**: Password reset is critical for user retention but is a secondary flow — users need to be able to register and log in before they can forget their password.

**Independent Test**: Can be tested by requesting a password reset, receiving the email, clicking the link, setting a new password, and successfully logging in with the new password.

**Acceptance Scenarios**:

1. **Given** the user is on the login tab, **When** they tap the "Ai uitat parola?" link, **Then** they are navigated to the forgot password screen (Screen 09).
2. **Given** the user is on the forgot password screen, **When** they enter a valid email and tap "Trimite link de resetare", **Then** they see a confirmation message and a reset email is sent.
3. **Given** the user received a reset email, **When** they click the reset link within 60 minutes, **Then** they are taken to a password reset form where they can set a new password.
4. **Given** the reset link has expired (older than 60 minutes), **When** the user clicks it, **Then** they see an error indicating the link has expired with an option to request a new one.
5. **Given** the user enters an email not associated with any account, **When** they submit the forgot password form, **Then** they see the same confirmation message as a valid email (to prevent email enumeration).

---

### User Story 6 - Logout (Priority: P3)

An authenticated user wants to sign out of their account. They tap their profile icon in the header bar, which opens a popover showing their name and a "Deconectare" button.

**Why this priority**: Logout completes the auth lifecycle and is important for shared devices, but is lower priority than the entry flows.

**Independent Test**: Can be tested by logging in, triggering logout, and verifying the user is returned to the auth screen and cannot access authenticated features.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** they tap the header profile icon, **Then** a popover appears showing their name and a "Deconectare" button.
2. **Given** the popover is open, **When** the user taps "Deconectare", **Then** their session is ended, the popover closes, and the header icon reverts to the anonymous state.
3. **Given** the user has logged out, **When** they attempt a gated action (add venue, write review, edit venue), **Then** they are redirected to the auth screen.

---

### Edge Cases

- What happens when the user's network connection drops during the OAuth flow? The system should show a connection error and allow retry.
- What happens when Google/Apple OAuth is temporarily unavailable? The email/password option remains functional; the OAuth buttons show an appropriate error.
- What happens when a user tries to register with an email that was used via Google/Apple OAuth? The system informs them an account already exists and suggests signing in with the associated provider.
- What happens when the user navigates directly to a deep link while unauthenticated? The system redirects to the auth screen and returns the user to the intended destination after login.
- What happens when the password reset link is used more than once? Only the first use succeeds; subsequent attempts show an "already used" message.
- What happens when the user's session expires while they are actively using the app? The system prompts re-authentication without losing the user's current context (e.g., venue they were viewing).
- What happens when an anonymous user taps "Adaugă", "Scrie o recenzie", or edit on a venue? The system shows the auth screen and, upon successful login/registration, returns the user to the action they originally intended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create accounts using full name, email address, and password.
- **FR-002**: System MUST validate email format and reject invalid addresses at submission time.
- **FR-003**: System MUST enforce a minimum password length of 8 characters.
- **FR-004**: System MUST provide a show/hide toggle on the password field.
- **FR-005**: System MUST prevent duplicate registrations with the same email address.
- **FR-006**: System MUST allow users to log in with email and password.
- **FR-007**: System MUST display generic error messages on failed login attempts (not revealing whether email exists).
- **FR-008**: System MUST persist user sessions across app restarts for at least 7 days of inactivity (per SC-008).
- **FR-009**: System MUST support Google OAuth as a sign-in method.
- **FR-010**: System MUST support Apple Sign-In as a sign-in method.
- **FR-011**: System MUST link OAuth accounts to existing email accounts when the email matches.
- **FR-012**: System MUST provide a "Forgot password" flow that sends a time-limited reset link (60-minute expiry) via email.
- **FR-013**: System MUST allow users to set a new password via the reset link.
- **FR-014**: System MUST invalidate used or expired password reset links.
- **FR-015**: System MUST allow authenticated users to log out, ending their session.
- **FR-016**: System MUST present a tab switcher between registration ("Inregistrare") and login ("Conectare") modes on the auth screen.
- **FR-017**: System MUST display all auth UI in the user's selected language (Romanian or English), preserving the language choice from the splash screen.
- **FR-018**: System MUST display Terms of Service and Privacy Policy links on the registration form.
- **FR-019**: System MUST redirect authenticated users to the main map view upon successful login or registration.
- **FR-020**: System MUST keep venue browsing, searching, and map navigation fully accessible without login.
- **FR-021**: System MUST handle the Apple "Hide My Email" relay address transparently.
- **FR-022**: System MUST require authentication before allowing users to add venues, write reviews, or edit venues. When an unauthenticated user attempts any of these actions, the system redirects to the auth screen and returns them to the intended action after successful login.
- **FR-023**: System MUST display a user/profile icon in the header bar. When the user is anonymous, tapping it navigates to the auth screen. When authenticated, tapping it opens a small popover showing the user's name and a "Deconectare" (logout) button.
- **FR-024**: The authenticated header icon MUST display the user's initials (matching the avatar circle pattern from the design system) to visually indicate logged-in state.

### Key Entities

- **User**: A person who has created an account. Key attributes: unique identifier, full name, email address, authentication method (email, Google, Apple), language preference, account creation date.
- **Session**: An active authenticated period for a user. Key attributes: user reference, creation time, expiry time, device/browser context.
- **Password Reset Token**: A time-limited single-use token for password recovery. Key attributes: user reference, token value, creation time, expiry time (60 minutes), used/unused status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete email registration in under 90 seconds from first seeing the form.
- **SC-002**: Users can complete email login in under 30 seconds.
- **SC-003**: Users can complete Google or Apple sign-in in under 20 seconds (excluding external provider time).
- **SC-004**: 95% of password reset emails are delivered within 2 minutes of request.
- **SC-005**: Password reset flow (from clicking link to setting new password) is completable in under 60 seconds.
- **SC-006**: Auth screens are fully functional in both Romanian and English with no untranslated strings.
- **SC-007**: Error messages are clear enough that 90% of users can self-resolve issues (wrong password, duplicate email) without support.
- **SC-008**: Session persistence keeps users logged in for at least 7 days of inactivity.

## Clarifications

### Session 2026-03-26

- Q: Is authentication mandatory to use TT Portal, or only required for social features? → A: Optional — anonymous users can browse and search venues; authentication is required only for social actions.
- Q: Which currently-anonymous write actions should require login? → A: All writes — adding venues, writing reviews, and editing venues all require authentication.
- Q: Must users verify their email before their account becomes active? → A: No — accounts are immediately active after registration with no email verification step.
- Q: Where should the auth screen be accessible from in the main UI? → A: A user/profile icon in the header bar navigates to the auth screen when anonymous, or to the profile screen when authenticated.
- Q: Where should the logout action live without a Profile screen? → A: Tapping the header profile icon (when authenticated) shows a small popover with user name and a "Deconectare" button.

## Assumptions

- Users have a stable internet connection (auth operations require network access).
- The existing splash/city picker flow (Screen 01) remains as the entry point; the auth screen is accessed after splash or when an authenticated feature is requested.
- Authentication is optional: venue browsing, searching, and map navigation remain fully accessible without login. Auth gates specific write actions and all future social features (check-ins, friends, profiles, favorites).
- The language preference selected on the splash screen is available to the auth screen via localStorage.
- Terms of Service and Privacy Policy pages exist as separate documents/URLs that can be linked from the registration form.
- Email delivery for password resets relies on the backend auth provider's built-in email service.
- No email verification is required at registration; accounts are immediately active. Email verification may be introduced in a future iteration if spam or abuse becomes a concern.
- The forgot password screen (Screen 09) follows the design specified in the business spec: dark green background, lock icon, email input, and back link to login.
- Since auth is optional, the splash screen navigates directly to the map view (skipping the auth screen). Users encounter auth via the header icon or when attempting a gated write action.
- Standard rate limiting on failed login attempts is assumed (e.g., temporary lockout after repeated failures) to prevent brute force attacks; specific thresholds are a planning-phase decision.

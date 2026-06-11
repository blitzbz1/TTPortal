# Auth email / SMTP production-readiness (T088) — operator runbook

**Status: NOT production-ready until this is done.** Supabase's built-in
auth email sender is rate-limited (~2/hour bursts) and lands in spam; with
it, password resets and signup confirmations silently fail under any real
load. This is dashboard configuration — nothing ships in the repo.

## Steps (Supabase Dashboard → Authentication → Emails → SMTP)

1. Pick a provider with a free tier that covers current volume:
   **Resend** (3k/month free) or **Brevo** (300/day free). Both stay within
   the no-paid-services constraint at current scale; SES is the cheap
   fallback when volume outgrows them.
2. Verify the sending domain (`ttportal.org`) — SPF + DKIM records at the
   DNS provider (coordinate with the AASA/universal-links DNS work, same
   zone, single change window).
3. Dashboard SMTP settings: host/port/user/password from the provider;
   sender `no-reply@ttportal.org`, name "TT Portal".
4. Raise the auth email rate limit (Authentication → Rate Limits) to the
   provider's real ceiling.
5. Localize the three templates (confirm signup / reset password / email
   change) — RO + EN at minimum; templates live in the dashboard.

## Verification (the load test)

- Trigger 10 password resets within an hour for a test account; all 10
  must arrive in the inbox (not spam) within ~2 minutes each.
- Check the provider dashboard for bounces/spam-rate after the first week.

## Config notes

`supabase/config.toml` controls only the LOCAL stack (inbucket captures
email locally — nothing to change). Production SMTP lives exclusively in
the dashboard; record the chosen provider + sender here when configured:

| Date | Provider | Sender | Configured by |
| --- | --- | --- | --- |
| _pending_ | | | |

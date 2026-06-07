# Resend SMTP for Supabase Auth (Axios Workouts)

Auth emails are sent by **Supabase**, not the mobile app. No API keys or SMTP settings belong in the Expo app.

## Prerequisites (Resend)

1. [Resend](https://resend.com) account
2. **API key** — Resend Dashboard → API Keys → Create (e.g. `re_...`)
3. **Verified domain** — Resend → Domains → add your domain and complete DNS (SPF, DKIM)
4. A sender address on that domain, e.g. `noreply@yourdomain.com`

Until a domain is verified, you can only send test mail to the email address on your Resend account.

## Option A — Supabase + Resend integration (easiest)

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Integrations** (or **Authentication** → **Emails** → connect provider)
3. Choose **Resend** and follow the prompts (API key + sender)

## Option B — Manual SMTP

1. Supabase Dashboard → **Authentication** → **Emails** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter:

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | Your Resend API key (`re_...`) |
| Sender email | `noreply@yourdomain.com` (must be on verified domain) |
| Sender name | `Axios Workouts` |

4. **Save**

## After enabling custom SMTP

1. **Authentication** → **Rate Limits** — raise **Email sent** (defaults to ~30/hour with custom SMTP; increase as needed)
2. **Authentication** → **URL Configuration** — keep app deep links:
   - Site URL: `workouttracker:///auth/callback` (note the **three** slashes)
   - Redirect URLs (add all):
     - `workouttracker:///auth/callback`
     - `workouttracker://auth/callback` (legacy links from before the fix)
     - `workouttracker://**`
     - `exp://**` (Expo Go only)
3. **Authentication** → **Email Templates** — optional: edit Confirm signup / Reset password copy

## Verify

### Expo Go (quick testing)

1. Start Metro: `npx expo start` — keep it running on your PC
2. Open the project in **Expo Go** on your phone (same Wi‑Fi as your PC)
3. Create a test account (Settings → Account → Create account)
4. Tap the confirmation link on the **same phone**, with Expo Go still reachable on the network
5. **Resend** the confirmation email if you changed redirect code — old emails still contain the previous `exp://` address

Expo Go links look like `exp://192.168.x.x:8081/--/auth/callback`. If your PC's IP changes, old confirmation emails stop working — resend after reconnecting.

Supabase **Redirect URLs** must include `exp://**`.

### Dev / production builds

1. Create a test account in the app
2. Tap the link on the **same device** — app should open and sign you in
3. After changing deep-link code, **rebuild** (`npx expo run:android` / `run:ios`)

## App code (already configured)

- `emailRedirectTo` / `redirectTo` → `exp://…/--/auth/callback` in Expo Go, `workouttracker:///auth/callback` in builds (`lib/auth/authRedirect.ts`)
- Deep link handling → `lib/auth/AuthProvider.tsx`, `app/auth/callback.tsx`

No Resend credentials in the mobile codebase.

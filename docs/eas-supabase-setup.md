# Supabase env vars for EAS builds

Local development reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`. That file is **not** uploaded to EAS Build, so internal testing and store builds will show **“Cloud accounts are not configured”** until you add the same variables in Expo.

The anon key is meant to ship in the client app (RLS protects data). Still use EAS env vars rather than committing keys to git.

## One-time setup

From the project root, with values from Supabase → **Project Settings → API**:

```bash
# Internal testing (eas build --profile preview)
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co"
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"

# Production / Play Store (when ready)
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co"
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
```

Optional, for dev client builds:

```bash
eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co"
eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
```

List what is configured:

```bash
eas env:list
```

## Rebuild required

Env vars are baked in at **build time**. After creating or changing them, run a new build:

```bash
eas build --profile preview --platform android
# or ios
```

Installing an older build will still show “not configured” even after you set env vars.

## Supabase Auth redirect URLs

For standalone builds (not Expo Go), add in Supabase → **Authentication → URL Configuration**:

- `workouttracker:///auth/callback`
- `workouttracker:///auth/reset-password`
- `workouttracker://auth/callback` (legacy path)

## Database migrations

Run SQL migrations in Supabase SQL Editor if you have not already:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_profiles_username.sql`
3. `supabase/migrations/003_delete_account.sql`

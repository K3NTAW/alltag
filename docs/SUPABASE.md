# Supabase and Supabase Auth

The app works fully signed out and offline. Local storage is the source of truth on the device. An account only adds sync: signed in, the app pushes and pulls rows and scene photos to Supabase.

## How the pieces fit

- **Supabase Auth is the identity provider.** The app signs in with email and password through supabase-js, on screens we draw ourselves (`src/screens/Account.tsx`). No third-party widget.
- **RLS keys everything on the JWT sub.** `public.current_user_id()` returns `auth.jwt()->>'sub'`, which Supabase Auth fills with the user id (a uuid). Every table has `user_id text` defaulting to it, and one policy per operation allows only `user_id = public.current_user_id()`. The anon role has no access.
- **Storage.** Private bucket `scenes`. Path convention: `<sub>/<sceneId>.jpg`. Storage policies allow a user only objects whose first folder is their sub. `scenes.image_path` stores that path.
- **Sync columns.** Every table has `updated_at` (set by the `set_updated_at` trigger) and `deleted_at` (soft delete), indexed on `(user_id, updated_at)` so a pull is "my rows changed since t".

| table | key | what |
| --- | --- | --- |
| `profiles` | `user_id` | level (A1 to B2), display name, settings |
| `items` | `id` uuid | kept phrases and SM-2 state in `srs` (interval, ease, reps, due) |
| `scenes` | `id` uuid | captured place, objects, task, photo path |
| `conversations` | `id` uuid | roleplay transcript lines, duration, kept count |

Row types for the client: `src/sync/schema.ts` (`ProfileRow`, `ItemRow`, `SceneRow`, `ConversationRow`, `TABLES`, `BUCKET`). The SQL is `supabase/migrations/20261010120000_init.sql`.

## Supabase Auth

- **Email and password only.** Sign in calls `signInWithPassword`, create account calls `signUp`. There are no magic links and no OAuth, so no redirect URLs need to be configured.
- **Password length.** The project setting Authentication > Providers > Email > minimum password length is the server-side floor (Supabase default 6). The app enforces at least 8 characters before it calls Supabase.
- **"Confirm email" setting.** Off on the live project (`enable_confirmations = false` in `supabase/config.toml`).
  - Off: `signUp` returns a session and the user is signed in at once. A second sign-up with the same address answers `user_already_exists`; the app says "there is already an account for this address. sign in instead." and switches to sign in.
  - On: `signUp` returns a user but no session. The app shows "check your inbox to confirm your address, then sign in here." with a way back to sign in. An existing address then comes back as a user with no identities; the app shows the same neutral line so nobody learns which addresses exist.
- **Sessions stay on the device** in localStorage under the key `alltag.auth` (works in the Capacitor webview). supabase-js refreshes the token on its own.
- **Sign out keeps local data.** Only the session is removed; words, scenes and conversations stay on the phone.
- **Sync goes through `withSession`** in `src/sync/supabase.ts`. Signed out, it returns null and makes no network call.

## Keys

Only public values go to the client, as `VITE_*` vars: the Supabase project URL and anon key. No service role key is used or stored anywhere in the repo.

## One-time setup (human)

The hosted project is `alltag` in region eu-central-2 (Zurich).

1. **Supabase dashboard**
   - Authentication > Providers > Email: enabled, "Confirm email" off, minimum password length at least 6 (the app asks for 8).
   - Or from the CLI: `supabase config push` (reads `supabase/config.toml`).
2. **Schema**
   - `supabase link --project-ref <ref>`
   - `pnpm db:push` (runs `supabase db push`). This creates the tables, policies and the `scenes` bucket.
   - Optional: `pnpm db:types` writes generated types to `src/sync/database.types.ts`.
3. **Env vars**, in `.env` locally and in the Vercel project settings:
   - `VITE_SUPABASE_URL`: Project Settings > API > Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Project Settings > API > anon public key.

Without these vars the app runs local-only and Settings says "sync is off in this build".

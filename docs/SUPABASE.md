# Supabase and Clerk

The app works fully signed out and offline. Local storage is the source of truth on the device. An account only adds sync: signed in, the app pushes and pulls rows and scene photos to Supabase.

## How the pieces fit

- **Clerk is the identity provider.** The browser signs in with Clerk and gets a Clerk session token (JWT).
- **Supabase accepts Clerk JWTs as third-party auth.** The client passes the Clerk token to supabase-js. With the Clerk Supabase integration on, the token carries `role: authenticated`, so Postgres runs the request as `authenticated`. Supabase Auth itself is not used for sign-in.
- **RLS keys everything on the Clerk sub.** `public.current_user_id()` returns `auth.jwt()->>'sub'` (the Clerk user id, `user_...`). Every table has `user_id text` defaulting to it, and one policy per operation allows only `user_id = public.current_user_id()`. The anon role has no access.
- **Storage.** Private bucket `scenes`. Path convention: `<sub>/<sceneId>.jpg`. Storage policies allow a user only objects whose first folder is their sub. `scenes.image_path` stores that path.
- **Sync columns.** Every table has `updated_at` (set by the `set_updated_at` trigger) and `deleted_at` (soft delete), indexed on `(user_id, updated_at)` so a pull is "my rows changed since t".

| table | key | what |
| --- | --- | --- |
| `profiles` | `user_id` | level (A1 to B2), display name, settings |
| `items` | `id` uuid | kept phrases and SM-2 state in `srs` (interval, ease, reps, due) |
| `scenes` | `id` uuid | captured place, objects, task, photo path |
| `conversations` | `id` uuid | roleplay transcript lines, duration, kept count |

Row types for the client: `src/sync/schema.ts` (`ProfileRow`, `ItemRow`, `SceneRow`, `ConversationRow`, `TABLES`, `BUCKET`). The SQL is `supabase/migrations/20261010120000_init.sql`.

## Keys

Only public keys go to the client, as `VITE_*` vars: the Supabase anon key and the Clerk publishable key. No service role key and no Clerk secret key are used or stored anywhere in the repo.

## One-time setup (human)

The hosted project is `alltag` in region eu-central-2.

1. **Clerk dashboard**
   - Create the application.
   - Enable the Supabase integration (Integrations > Supabase). This adds the `role: authenticated` claim to session tokens.
   - Copy the publishable key (`pk_...`) and the Frontend API domain (`https://<something>.clerk.accounts.dev` or your custom domain).
2. **Supabase dashboard**
   - Authentication > Sign In / Providers > Third Party Auth > add Clerk with that domain.
   - Or from the CLI: `CLERK_DOMAIN=<domain> supabase config push` (reads `supabase/config.toml`).
3. **Schema**
   - `supabase link --project-ref <ref>`
   - `pnpm db:push` (runs `supabase db push`). This creates the tables, policies and the `scenes` bucket.
   - Optional: `pnpm db:types` writes generated types to `src/sync/database.types.ts`.
4. **Env vars**, in `.env` locally and in the Vercel project settings:
   - `VITE_SUPABASE_URL`: Project Settings > API > Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Project Settings > API > anon public key.
   - `VITE_CLERK_PUBLISHABLE_KEY`: from step 1.

Without these vars the app runs local-only and hides sign-in.

# TechMemo

A technical accounting workspace for investigating accounting issues, collaborating on evidence, and preparing reviewed memos.

## Current behavior

- Every signed-in account has its own workspace. New accounts start with no projects.
- Accounting issues are private projects stored in Supabase Postgres. Only the owner and accepted invitees can access a project.
- Owners invite people by email and receive a link to share. Invitations expire after seven days, require the invited verified email, and are consumed atomically. Creating a link does **not** send an invitation email automatically.
- Collaborators can discuss, attach evidence, propose excerpts and start permitted private conversations. Only the owner can approve evidence and create/edit memo versions. Other participants can read shared memos and approved excerpts.
- Server-side membership checks protect every project read/write. Private conversations are visible only to selected participants. A proposed excerpt is explicitly sent to the project owner for review; approval shares only that excerpt with the project.
- Changes are saved to Supabase. Visible pages check for remote changes approximately every three seconds. Updates preserve unsent chat text, focus, cursor position and message scroll position. Sync pauses during memo editing, dialogs, local saves and text composition; hidden tabs pause requests. Returning to the tab checks immediately. Revision checks reject conflicting saves rather than overwriting someone else’s work. A conflict stops autosaving: keep any needed text, reload and reapply it.
- TechMemo and the account menu stay fixed in the sidebar; only navigation scrolls. The sidebar can collapse.

The old shared Northstar/Harbor organizations, demo identities and seeded accounting issues have been removed. Existing browser demo data is not imported or read. Google and password accounts with the same email are separate identities; they are not automatically linked.

## Activate project storage (required)

1. In your existing Supabase project, open **SQL Editor → New query**.
2. Paste and run [supabase/migrations/001_personal_projects.sql](supabase/migrations/001_personal_projects.sql) **once**. It creates project, membership and invitation tables plus atomic create/accept functions. Tables have RLS enabled and no public or authenticated-client access; only the server role can access them. Do not disable RLS or add permissive browser policies.
3. From **Supabase → Project Settings → API Keys**, obtain a **secret key** (starts `sb_secret_`; legacy `service_role` also works).
4. In **Vercel → TechMemo → Settings → Environment Variables → Production**, add `SUPABASE_SECRET_KEY`. This is a **server-only** key, distinct from `SUPABASE_PUBLISHABLE_KEY`. Never put it in browser code, chat or Git.
5. Keep `SUPABASE_URL`, `APP_URL` and `AUTH_SECRET`, then redeploy `main`.
6. Test with two separate accounts: each should start empty. Account A creates an issue, opens **Members**, enters B’s email and creates an invitation link. Send it to B. B opens it and explicitly accepts while signed in with that email. Both then see that project; their other projects remain private. A third account must not gain access to either the project URL/API or B’s invitation.

Until the migration and server-only key are installed, the workspace shows a setup error. It does not fall back to shared demo projects or pretend that local storage is secure project isolation.

### Access model

The Node.js project API verifies the app’s signed HTTP-only session and uses that identity for ownership and membership checks. Browser-supplied account IDs, owners and member lists are not trusted. Supabase’s secret key bypasses RLS, so the server API performs authorization itself; the database is closed to direct public/client access. Keep this key server-only. See [Supabase security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The schema supports existing Google account IDs and Supabase email-account IDs without requiring a Google user to have a Supabase Auth record. Display names and email addresses are read from verified sign-in sessions and saved with project memberships.

Private channel content remains private when a participant saves a filtered project snapshot. New messages/files must belong to the current author and an accessible channel; approval and memo-version changes are owner-only. Older versions/messages cannot be silently overwritten. Chat lists show project members by name and named group chats. Anyone can start a direct chat with another project member or create a group with selected members; the owner is not automatically included. Existing chats retain their current participants. Project data is capped at 2 MB and memo history at 100 versions in this proof of concept.

Company SSO and domain-restricted corporate invitations are not implemented. Current Google/email accounts can invite any email address. Removing collaborators, revoking invitations, WebSocket-based realtime editing and automated invitation emails are not implemented yet.

## Vercel deployment

Import `samensah/techmemo`, production branch **main**, repository root. `vercel.json` uses **Other**, runs `npm ci --ignore-scripts`, builds with `node scripts/build-static.mjs`, and publishes `dist/`. Node.js functions in `api/auth.js` and `api/projects.js` handle account and project requests. `.vercelignore` excludes the optional Python API and model dependencies.

| Environment variable | Purpose |
| --- | --- |
| `APP_URL` | `https://techmemo-smoky.vercel.app` (HTTPS origin only) |
| `AUTH_SECRET` | Private random session-signing secret, at least 32 bytes; generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SUPABASE_URL` | Your project URL, e.g. `https://project-ref.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key or legacy anon key, for email Auth |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key, for project database access |

Set variables in Vercel and redeploy after changing them. `.env.example` is documentation, not deployed configuration. Do not use Next.js `NEXT_PUBLIC_` prefixes for this project.

## Google sign-in

1. Create/select a Google Cloud project and complete **Google Auth Platform → Branding / Audience**. Choose External if supporting personal Google accounts; add test users when required by Google’s testing settings.
2. Create a **Web application** client. Leave **Use this client for an AI-powered agent** unchecked; this client only signs people in.
3. Register this exact authorized redirect URI:

   ```text
   https://techmemo-smoky.vercel.app/api/auth/callback
   ```

4. Add the two Google variables from the table above and redeploy. The flow requests only `openid email profile`, uses state/nonce/PKCE, verifies token signatures and claims, and issues a secure HTTP-only app session. Test login, reload and logout.

Reference: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Email/password signup and verification

1. In Supabase **Authentication → Sign In / Providers**, enable signups and the **Email** provider. Keep **Confirm email ON** and require passwords of at least 12 characters.
2. Set **Authentication → URL Configuration → Site URL** to `https://techmemo-smoky.vercel.app` without a trailing slash.
3. Keep the default confirmation email. Supabase verifies the address and redirects to TechMemo; the app removes returned provider tokens from the URL and asks for password login. No email-template editing is required.
4. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Vercel, keeping `APP_URL` and `AUTH_SECRET`, then redeploy.
5. Register with full name, email and a password (12 characters minimum, 128 bytes maximum). Confirm the email, then log in. Signup does not issue an app session. Unverified accounts cannot log in. `/#resend` requests a fresh confirmation email.

Supabase’s built-in email delivery only supports project-team addresses with strict limits. Configure **custom SMTP** in Supabase for other users. Provider rate limits apply; calls proxied through Vercel may share the server’s IP-based limits. See [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Optional: when template editing is available, [templates/confirm-signup.html](templates/confirm-signup.html) links to the custom confirmation page, which consumes the email token only after an explicit confirmation POST. Default templates remain supported.

Email accounts are stored and hashed by Supabase Auth. Password reset and account linking are not implemented. App sessions last eight hours and are not individually revocable: deleting/banning a user or changing a password does not invalidate an existing app cookie before expiry. Rotate `AUTH_SECRET` to invalidate all sessions when needed.

## Memo generation and attachments

Without a model service, memos use a deterministic outline from approved evidence; the UI labels this as a local template. Research links are starting points, not authoritative retrieved paragraph citations. Professionals must validate guidance and approve conclusions.

Projects store clipped extracted text, filenames and metadata, not uploaded binary files. PDF/DOCX/XLSX extraction requires the optional Python backend. An encrypted binary object-storage workflow, stronger accounting models and authoritative licensed research retrieval remain future work.

### Optional local Python model server

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

This experimental backend uses Hugging Face `gpt2` and `sentence-transformers/all-MiniLM-L6-v2`. It is not configured for the hosted project/auth APIs and accepts anonymous local requests: **do not expose it publicly**. GPT-2 is not a reliable accounting expert. Authentication and persistent workspace testing should use the Vercel deployment and its Node.js functions.

## Development and verification

```bash
npm ci
npm test
npm run build
```

Tests use mocked database requests and locally signed auth tokens. They do not substitute for applying the SQL migration and testing live accounts. See [tests/MANUAL_TESTS.md](tests/MANUAL_TESTS.md). A static file server can preview public pages, but cannot run account/project functions. The workspace requires sign-in and a configured database.

# TechMemo — collaborative accounting memo prototype

A responsive, interactive **index.html-first** proof of concept for an Overleaf-style technical accounting SaaS. The app has organization-scoped accounting issues, invitation-only workspaces, public/private conversations, an explicit **private evidence approval** process, memo drafting and Git-like version comparison.

> **Prototype warning:** This is not production software. The app uses demo identities and browser `localStorage`, not real SSO, database isolation or secure authorization. Do not upload confidential or live enterprise data. All example organizations, employees and facts are fictional. GPT-2 is an experimental general-purpose language model and is **not** a reliable accounting expert.

## Quickest way to preview

1. Open `index.html` directly in a browser (double-click it). No build or installation required.
2. Use the public navigation to explore Product, Pricing, Help & Resources, Log in and Sign up. Google sign-in works on Vercel after OAuth configuration (see below); email/password and work SSO remain preview forms. The demo workspace is still browser-local. Choose **Explore the demo** to enter the existing workspace.
3. Choose a demo identity via the lower-left profile menu; the sidebar displays only the selected employee's invited workspaces.
4. In the first workspace, review **General discussion**, **Legal Counsel** (private) and **Finance review** (private group).
5. Open **Evidence**, approve `EV-002` as the issue owner (Ava), then click **Generate draft**. The memo will use only the approved evidence.
6. Select **Compare** to see changed sections; use **History** to inspect earlier revisions.

Without the optional backend, the app generates a **local deterministic memo outline**, explicitly labeled as such — it does **not** pretend an LLM ran.

## Run with real small Hugging Face models

Python 3.10+ recommended. From the project root:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r api/requirements.txt
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

Open **http://127.0.0.1:8000**. The app detects `/api/health` and uses:

- **Generation:** [`gpt2`](https://huggingface.co/openai-community/gpt2) (same GPT-2 model family and weights; `gpt2` checkpoint in Transformers). An experimental continuation is appended in a separately labeled section.
- **Embeddings / retrieval ranking:** [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). It ranks **approved** evidence by semantic similarity to the issue.

The first generation downloads model weights to the Hugging Face local cache; internet is required on first run. Inference runs locally on CPU, so initial generation can take time. The app falls back to local template drafting if the server or models are unavailable. The backend extracts text from PDF, DOCX, XLSX, TXT, CSV, MD and JSON files. Binary files are **not** persisted by the prototype; only a clipped text extract and filename are held in browser state. Text is only sent to the model when explicitly approved as memo evidence.

> GPT-2 is not instruction-tuned and may produce nonsense or false statements. Model output is clearly separated from the memo's draft analysis. Do not use the prototype to make actual accounting decisions.

## Project structure

```text
techmemo/
├── index.html                # Public homepage and account screens
├── workspace.html            # Existing demo workspace
├── assets/
│   ├── public.css            # Public homepage and account screen styling
│   ├── public.js             # Public navigation and prototype account forms
│   ├── styles.css            # Responsive UI
│   └── app.js                # Local demo data, chat, evidence & memo versioning
├── api/
│   ├── main.py               # FastAPI + GPT-2 + all-MiniLM-L6-v2 + file text extraction
│   └── requirements.txt
├── .gitignore
└── README.md
```

## Main working features

- Separate fictional organizations and switchable demo identities; issue access is filtered by invitations.
- Pinned accounting issue summary, invited members, general discussion, 1:1 owner DMs and selected private group chats.
- Message composition, invite members, create issues/groups/direct messages and upload supporting files.
- Evidence proposal with an editable **exact excerpt** and owner-only approval. The raw private conversation is never included in the generator input.
- Approved-evidence-only memo generation, editable memo sections, immutable version snapshots, comparison with previous version, and Markdown download.
- Optional local Hugging Face inference, semantic retrieval ranking and document text extraction.
- Responsive layout for desktop/mobile. State is persisted locally using browser `localStorage`.

## Accounting standards / licensing

The app includes **high-level research cues and outbound source links**, not licensed verbatim standards content or a full IFRS retrieval pipeline. Source links point to IFRS Foundation and IAS Plus research entry points. The app does not fetch, scrape, redistribute or assert authoritative paragraph references from those resources. A future production research service must use a licensed authoritative content feed and source/version auditing.

## Production gaps (not yet implemented)

- Enterprise SSO (e.g. OIDC/Entra ID), real backend identity and authorization, tenant-isolated data store, secure file storage, durable audit log.
- Server-side evidence ACLs and sharing workflows, redaction and retention policies, confidential-evidence revocation and historic-access handling.
- Real-time multi-user sync (WebSocket/CRDT) and concurrent edit resolution.
- Proper primary accounting standards retrieval with licensed content, paragraph-level citation verification, reviewer approval and release workflow.
- Dependable accounting LLM. Replace GPT-2 with an appropriately evaluated accounting-capable model for real use.
- Word/PDF export, production observability, rate limits, background processing and security testing.

### Security note

The backend intentionally accepts anonymous model requests from localhost for demonstration. It trusts approved evidence supplied by the browser, so a malicious client could bypass the approval process. **Never expose this backend to the public internet** or claim it enforces enterprise privacy. Production must enforce workspace/conversation ACLs and evidence approval on the server before sending anything to any model.

## Deploy the proof of concept to Vercel

Import `samensah/techmemo`, select the **main** branch, and keep the repository root as the project root. `vercel.json` selects **Other** (no framework), runs `npm ci --ignore-scripts`, builds the static frontend with `node scripts/build-static.mjs`, and publishes `dist/`. A Node.js function serves `/api/auth/*` separately. Clear any conflicting dashboard build/output overrides.

The build copies only `index.html`, `workspace.html` and `assets/`. `.vercelignore` excludes Python API files and model requirements so Vercel does not create Python functions or install Torch/model dependencies. The Google authentication function in `api/auth.js` remains included. The demo works without environment variables; Google sign-in requires the four variables below.

- `/` opens the public homepage; `/#login` and `/#register` open the account previews.
- `/workspace.html` opens the interactive workspace. Explicit `.html` links are preserved.
- Memo drafting uses the browser-local template fallback. `/api/health` returns 404 on this deployment; the workspace handles that by selecting offline template mode. PDF/DOCX/XLSX text extraction and model inference require the optional backend.
- Google sign-in identifies a visitor using a verified session after configuration. Workspace data stays in each visitor's browser. Deployment does not add persistent user records, shared project storage or invitation enforcement; email/password and enterprise SSO remain previews.

To check the exact deployment output locally, run `node scripts/build-static.mjs`, then `python3 -m http.server 8080 --directory dist` and open `http://localhost:8080`.

### Adding a backend service later

The deployment contains a static frontend and a Node.js authentication function. It does not host Python inference. Keep the local Python API local until server-side authentication, workspace authorization and evidence validation are implemented. For hosted inference, choose a hosted model endpoint or a separately deployed backend appropriate for model loading and inference. Vercel can proxy `/api/:path*` to that service using a `rewrites` entry once its URL is known. Do not add an API catch-all rewrite to `index.html`, since API requests must return API responses. An external API also needs its own hosting, credentials and access controls; a rewrite only routes traffic.

Vercel references: [project configuration](https://vercel.com/docs/project-configuration/vercel-json), [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi).


## Configure Google sign-in

Google sign-in uses an OAuth authorization-code flow with PKCE, state and nonce validation. The server verifies Google ID-token signatures, issuer, audience, expiry and verified email, then issues an eight-hour signed `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Google tokens are not saved in browser storage. Logout clears the browser session; it does not log the user out of Google. There is no refresh token or database yet, and individual sessions cannot be revoked server-side before expiry (rotating `AUTH_SECRET` invalidates all sessions).

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project named **TechMemo**.
2. In **Google Auth Platform**, complete **Branding** with TechMemo, your support email and developer contact email. Choose **External** audience for personal and work Google accounts. For testing, add your Google account and any invited testers under **Audience → Test users** if Google shows the testing restriction.
3. Under **Clients**, create an OAuth client of type **Web application** named **TechMemo Vercel**. Add this exact **Authorized redirect URI**:

   ```text
   https://techmemo-smoky.vercel.app/api/auth/callback
   ```

   This server redirect flow does not require a JavaScript origin or the Google browser SDK. Request only `openid`, `email` and `profile` (the code already does this). No Drive/Gmail access is needed.
4. In **Vercel → TechMemo → Settings → Environment Variables**, add these values for **Production**:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Client ID from Google |
   | `GOOGLE_CLIENT_SECRET` | Client secret from Google |
   | `AUTH_SECRET` | A private random value generated with `openssl rand -base64 32` |
   | `APP_URL` | `https://techmemo-smoky.vercel.app` |

   Never put real secrets in source files or chat. `.env.example` lists names and placeholders only. `AUTH_SECRET` must be at least 32 bytes; keep it stable between deployments.
5. Redeploy the latest **main** commit. Open `https://techmemo-smoky.vercel.app/#login`, select **Log in with Google**, approve sign-in, and confirm your email appears above the demo workspace. **Sign up with Google** uses the same first-time/returning-user flow; no persistent user record is created yet. Check **Sign out**, then reload to confirm the session is cleared.

Use the canonical production domain for sign-in. Preview URLs, custom domains and localhost need their own matching Google redirect registration and environment configuration; this setup intentionally fixes the callback to `APP_URL`. Plain static servers and opening `index.html` as a file cannot execute the authentication function. You can still explore the demo that way.

Google login does **not** implement enterprise SSO or determine project permissions. A work Google account is only a verified identity here. Company domain restrictions, personal-account cross-domain invitations, account provisioning and tenant authorization must be implemented with persistent server-side project membership. The accessible demo and persona switcher remain explicitly fictional.

Run `npm ci`, `npm test` and `npm run build` for local code verification. OAuth tests use locally signed test tokens and mocked Google token exchange; live Google sign-in must be checked after the credentials are configured.

References: [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect verification](https://developers.google.com/identity/openid-connect/openid-connect), [Google Auth Platform setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

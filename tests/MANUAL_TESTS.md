# UI acceptance checklist

1. Open `index.html` directly. Confirm the public homepage appears first. Check Product, Pricing, Help & Resources, Log in and Sign up navigation, including the mobile menu.
   - Check email validation, full name, required fields, 12-character signup password minimum, password visibility and resend-verification navigation. Signup and login submit to the authentication function. Reset password and work SSO remain previews. Google buttons must navigate to `/api/auth/start`; without configuration they show a setup message.
   - Choose **Explore the demo**. The workspace must work in **Offline template mode** without model dependencies. Repeat via the optional FastAPI server to verify `/workspace.html` is served.
2. Open the **Legal Counsel** private chat, send a message, and choose **Propose as evidence**. Confirm that it is **pending**, not used automatically.
3. As Ava (workspace owner), approve the exact excerpt in **Evidence**. Regenerate the memo. The new version should include the approved fact and retain the previous version.
4. Open **Compare** and confirm changed memo sections are identified. Use **History** to inspect the older version.
5. Switch persona to Priya. Confirm the Legal Counsel conversation is invisible, and unapproved legal evidence is absent. Priya should not have an **Approve** button.
6. Switch to Olivia (another organization). Confirm that Northstar's workspace is hidden.
7. Create an issue, invite an employee from the same organization, start a private group and upload a text attachment.
8. Run the optional model server. The UI should show **Hugging Face backend**, and generated versions should include a separate, clearly labeled **GPT-2 experimental continuation** section.
9. Confirm that all model requests send **only** evidence whose status is `approved` in the demo state (inspect the browser network request). This is client-side only; a production server must enforce the rule independently.


## Google sign-in on Vercel

1. Configure Google OAuth and Production environment variables using the README; redeploy. Confirm Python dependencies are not installed and `/api/auth/session` returns JSON with `Cache-Control: no-store`.
2. On both login and signup, use the Google button. Confirm Google shows TechMemo and only identity permissions, then returns to `/workspace.html`. Confirm the banner shows your Google identity separately from fictional demo personas.
3. Reload; the session should persist. Sign out and reload; it should show demo mode. The public demo remains accessible intentionally.
4. Cancel Google sign-in; confirm a clear error and retry path. Visit `/api/auth/callback` with missing/invalid state; no session should be created.
5. Inspect cookies: session must be `HttpOnly`, `Secure`, `SameSite=Lax`, with no access/refresh/ID tokens in localStorage. No token/code/secret should be rendered in the UI.
6. Test unconfigured deployment and expired/invalid session: no false signed-in state. Company-domain project restrictions are not part of this change.


## Email/password accounts

1. Configure Supabase Auth, confirm-email setting, the default confirmation template (or optional custom template), email delivery and Production variables using the README; redeploy.
2. Register with a full name and email. Confirm the password is sent only in the POST body and no session is issued. Confirm a persistent unverified user record in Supabase. Try logging in before verification: it must be refused.
3. Open the default email link. Confirm it returns to the login screen with provider tokens removed from the address bar; no app session should be created until password login. With the optional custom template, loading the confirmation page must not consume the token; press **Confirm email address**, then log in. Confirm the saved full name and email in the account banner, and session persistence on reload.
4. Log out; sign in again with the correct password. Incorrect passwords must fail. Google login must still work independently.
5. Test a reused or expired link and the resend route; request a fresh link after provider cooldown. Duplicate signup should not reveal whether the address already exists. Check delivery failures, malformed fields and rate-limited responses.
6. Confirm no provider access/refresh tokens or passwords are placed in localStorage, response JSON, HTML, or account cookies. Supabase is the account store; accounting issue data remains browser-local.

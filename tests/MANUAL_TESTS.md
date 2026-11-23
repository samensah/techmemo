# Acceptance checks

## Accounts

1. Configure Google OAuth and/or Supabase email Auth, Vercel variables, the project migration and server secret using the README.
2. Check signup validation, email verification/resend, unverified-login rejection, Google login and logout. Confirm no tokens/passwords in localStorage or UI. Verify HTTP-only secure cookies.
3. Check default email redirects remove provider tokens from the URL. With the optional custom template, confirmation GET must not consume the token; POST must be required.

## Personal workspace and project sharing

1. Sign in as A. Confirm an empty workspace, actual account initials/name, no Northstar/Harbor or identity switcher, and a logo matching the public site. Create an issue and reload: it must persist.
2. Sign in as B in a separate browser/profile. Confirm no A projects or shared demo data. Check a third account C similarly. Direct API requests with another account's project ID must return 404, including writes and invites.
3. As A, create an invitation for B's email in **Members**. Copy/send the link. B must explicitly accept while signed in with that email. B now sees that project; A's other projects remain private. A must Refresh to see B's membership.
4. C cannot accept B's invitation, even with the link. Expired or already-used invitations must not grant C access. A signed-out invitee should be sent to login and retain the invitation in the same browser tab.
5. B can send messages and propose evidence. A sees them after Refresh. Only A can invite people, approve evidence or save memo versions.
6. Add a third project member. Create a private conversation excluding that member. Inspect their project API response: no private conversation, messages, files or pending excerpts may appear. Approving an excerpt shares that excerpt only. Saving a filtered snapshot must preserve others' private data.
7. Test simultaneous edits in two browsers. The second stale save must show a conflict and not overwrite the first. Preserve any needed text and reload before reapplying it.
8. Remove database configuration in a preview deployment: show a setup error, never shared seeded projects or local-storage isolation disguised as secure sharing.

## Sidebar and account menu

1. Scroll a long memo and an overflowing project list independently. TechMemo and the account control stay at the top and bottom of the viewport.
2. Collapse/expand the sidebar. The main view resizes; unsent chat text and memo edits remain. Hidden navigation must not receive keyboard focus.
3. Open the account menu: full name/email, Profile, Settings, Help, Upgrade Plan and Log out. Close with outside click, keyboard focus or Escape. Verify menu stability after project rerenders.
4. Check mobile's initially collapsed rail, expanded navigation, fixed account footer and on-screen account popup.

## Evidence and memos

1. Propose a selected private message/file excerpt; confirm it is pending and excluded from generation.
2. Owner approves the excerpt and generates a memo. Review source IDs, then add evidence and generate again. Compare and history preserve earlier snapshots.
3. Members cannot forge another author, modify previous messages/versions, approve evidence or access private channels through custom API requests.
4. Check attachments store metadata and extracted text only, with clear messaging when binary text extraction is unavailable. Validate Markdown export.

# Verification limits

Automated Node tests mock Supabase responses and cannot verify migration execution, real database permissions, live invitation acceptance or SMTP delivery. Run these multi-account checks after deployment. Realtime editing, invitation-email delivery, corporate SSO/domain rules, collaborator removal and secure binary uploads remain unimplemented.

# Acceptance checks

## Accounts

1. Configure Google OAuth and/or Supabase email Auth, Vercel variables, the project migration and server secret using the README.
2. Check signup validation, email verification/resend, unverified-login rejection, Google login and logout. Confirm no tokens/passwords in localStorage or UI. Verify HTTP-only secure cookies.
3. Check default email redirects remove provider tokens from the URL. With the optional custom template, confirmation GET must not consume the token; POST must be required.

## Personal workspace and project sharing

1. Sign in as A. Confirm an empty workspace, actual account initials/name, no Northstar/Harbor or identity switcher, and a logo matching the public site. Create an issue and reload: it must persist.
2. Sign in as B in a separate browser/profile. Confirm no A projects or shared demo data. Check a third account C similarly. Direct API requests with another account's project ID must return 404, including writes and invites.
3. As A, create an invitation for B's email in **Members**. Copy/send the link. B must explicitly accept while signed in with that email. B now sees that project; A's other projects remain private. A should see B's membership automatically within a few seconds.
4. C cannot accept B's invitation, even with the link. Expired or already-used invitations must not grant C access. A signed-out invitee should be sent to login and retain the invitation in the same browser tab.
5. B can send messages and propose evidence. A sees them automatically within a few seconds. Only A can invite people, approve evidence or save memo versions.
6. Add a third project member. Create a private conversation excluding that member. Inspect their project API response: no private conversation, messages or files may appear. Pending excerpts are visible to their participants and the owner reviewing the explicitly submitted excerpt. Approving an excerpt shares that excerpt only. Saving a filtered snapshot must preserve others' private data.
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


## Conversations

1. Check the conversation list shows project members by name, named groups and Everyone. Clicking a member opens or reuses a direct chat.
2. As a non-owner, start a direct chat with another non-owner. Confirm only those two accounts can see it.
3. Create a named group by selecting project members. Confirm the creator is included and the owner is included only when selected. Check the group member list.
4. Propose a selected private excerpt as evidence. Confirm the owner can review/approve that excerpt without seeing the raw private chat. Existing chats keep their existing membership.


## Automatic conversation updates

1. Open the same project/chat with two accounts. Send messages in both directions; they should arrive without page reload, usually within three seconds plus network time.
2. Keep an unsent draft with the cursor mid-text while the other account sends. The draft, focus and selection must remain intact. Scroll up to older messages and confirm incoming updates do not force you to the bottom.
3. Open a modal or edit a memo while another account sends. Updates should wait until the dialog/editor closes. Test text composition with an IME.
4. Hide the tab; background requests should pause. Return or focus it; check immediately for missed messages. Temporarily disconnect and reconnect; the last visible messages should stay and updates should resume automatically.
5. Send locally while a background GET is in flight. The older response must not remove your message or advance the revision baseline. Concurrent-save conflicts must still be reported rather than overwriting changes.

## Delete approved evidence

1. As owner, delete an approved item from Evidence, confirming or cancelling the dialog. Confirm the approved count updates, other members receive the change automatically and future generated drafts exclude it.
2. Existing memo versions and original source messages/files must remain intact. Manual edits of historic versions can retain their original references. Collaborators must have no Delete button and cannot delete approved evidence through API requests.

## Delete chats

1. Open a direct or group chat, select its delete icon, and confirm. It disappears from your chat list after reload as well; other participants retain their history and approved evidence remains intact.
2. Check another participant’s deletion does not remove your own conversation. Everyone must have no delete action.
3. Use New chat to select a person or reopen a deleted group. The conversation and previous messages should be available again.

## Independent pane scrolling

1. Open a project with a long memo and long chat history. Only content below Memo editor / Evidence / Activity should scroll in the middle; the project header, issue summary and tabs stay in place.
2. Scroll message history. Conversations header, chat list, current-chat header and compose box stay stationary. Many people/groups may scroll within their bounded directory without moving the message composer.
3. Switch Evidence/Activity and verify the same independent scroll region. Receive an incoming chat update while reading halfway down a memo; its scroll position must be preserved.
4. Check desktop, collapsed sidebar, mobile chat overlay and a short viewport. Ensure the compose box and tab content remain reachable without outer-page scrolling.

Memo toolbar: scroll a long memo and confirm its title, version/author/date information, and History/Compare/Edit/Export controls stay fixed directly below the project tabs. Only the memo body and comparison content should move. Check narrow screens for wrapped controls.

Conversation toggle: on desktop, hide/show the right pane with the top-bar Conversations button or its header close control. The middle column must expand when hidden. Unsent chat text, focus behavior and memo scroll position must survive toggling. Check mobile overlay behavior, hidden keyboard focus, and persistence of the chosen visibility while changing projects or receiving background updates.

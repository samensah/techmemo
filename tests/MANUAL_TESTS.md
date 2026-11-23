# UI acceptance checklist

1. Open `index.html` directly. The interface must work in **Offline template mode** without model dependencies.
2. Open the **Legal Counsel** private chat, send a message, and choose **Propose as evidence**. Confirm that it is **pending**, not used automatically.
3. As Ava (workspace owner), approve the exact excerpt in **Evidence**. Regenerate the memo. The new version should include the approved fact and retain the previous version.
4. Open **Compare** and confirm changed memo sections are identified. Use **History** to inspect the older version.
5. Switch persona to Priya. Confirm the Legal Counsel conversation is invisible, and unapproved legal evidence is absent. Priya should not have an **Approve** button.
6. Switch to Olivia (another organization). Confirm that Northstar's workspace is hidden.
7. Create an issue, invite an employee from the same organization, start a private group and upload a text attachment.
8. Run the optional model server. The UI should show **Hugging Face backend**, and generated versions should include a separate, clearly labeled **GPT-2 experimental continuation** section.
9. Confirm that all model requests send **only** evidence whose status is `approved` in the demo state (inspect the browser network request). This is client-side only; a production server must enforce the rule independently.

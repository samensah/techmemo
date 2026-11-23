# TechMemo — collaborative accounting memo prototype

A responsive, interactive **index.html-first** proof of concept for an Overleaf-style technical accounting SaaS. The app has organization-scoped accounting issues, invitation-only workspaces, public/private conversations, an explicit **private evidence approval** process, memo drafting and Git-like version comparison.

> **Prototype warning:** This is not production software. The app uses demo identities and browser `localStorage`, not real SSO, database isolation or secure authorization. Do not upload confidential or live enterprise data. All example organizations, employees and facts are fictional. GPT-2 is an experimental general-purpose language model and is **not** a reliable accounting expert.

## Quickest way to preview

1. Open `index.html` directly in a browser (double-click it). No build or installation required.
2. Choose a demo identity via the lower-left profile menu; the sidebar displays only the selected employee's invited workspaces.
3. In the first workspace, review **General discussion**, **Legal Counsel** (private) and **Finance review** (private group).
4. Open **Evidence**, approve `EV-002` as the issue owner (Ava), then click **Generate draft**. The memo will use only the approved evidence.
5. Select **Compare** to see changed sections; use **History** to inspect earlier revisions.

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
├── index.html                # Browser entry point
├── assets/
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

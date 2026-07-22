# OpenAI Build Week 2026 — ready-to-paste submission copy

> Historical English copy for the submitted Devpost entry. The July 21, 2026 5:00 PM PT deadline has passed. The links below describe the locked submission; the post-deadline `/demo` route and 154-second walkthrough may replace them only with organizer approval. The new walkthrough explains the GPT-5.6 architecture but does not misrepresent its fictional fixture as a real model run.

## Project title

**Preuvance — Instant AI Assurance, Evidence by Evidence**

## Tagline

**From a prompt and bounded project signals to a living, reviewable AI dossier.**

## Track

**Work & Productivity**

## One-line pitch

Preuvance turns a system description, dependency manifests, and a privacy-safe local scan digest into a source-linked AI assurance dossier that clearly distinguishes what is declared, detected, missing, and human-reviewed.

## Short description

AI governance often starts with spreadsheets and self-declarations that quickly become stale. Preuvance creates an instant, living dossier from a prompt and bounded project signals. GPT-5.6 structures the context and analyzes gaps, while deterministic controls preserve evidence semantics: a declaration is never silently promoted to proof, and “Proven” always requires a named human reviewer and a review date.

## Inspiration

Teams adopting AI are asked to answer difficult questions: Which providers and models are involved? Which controls exist? What evidence supports each claim? Which gaps still need an owner?

The information is usually scattered across conversations, manifests, policies, scans, and reports. We built Preuvance to turn that fragmented material into one reviewable dossier without pretending that an AI-generated conclusion is a legal certification.

## What it does

Preuvance supports a three-step workflow: **Prompt. Scan. Prove.**

1. **Prompt:** a user describes an AI system and its context.
2. **Scan:** supported dependency manifests are parsed in the browser, and an optional local system scan can provide an explicitly consented, redacted digest.
3. **Prove:** Preuvance assembles a living evidence register that separates **Declared**, **Detected**, **Missing**, and **Proven** items.

For each evidence item, the user can record its source, owner, validity date, review metadata, and integrity hash. A SHA-256 hash demonstrates file integrity, not truth. Only a human-reviewed item with both reviewer identity and review date can reach the Proven state.

The resulting dossier can be revisited and exported for a review workflow. The methodology records the actual model returned during the assessment so the interface does not merely repeat a configured model name.

## How we built it

The application combines generative analysis with deterministic safeguards:

- **GPT-5.6** structures submitted facts, assists with control/risk classification, and identifies evidence gaps from the bounded context supplied to it.
- **Deterministic TypeScript rules** normalize evidence, enforce allowed states, require reviewer metadata for Proven items, calculate documentary coverage separately from regulatory readiness, and build the report payload.
- **Browser-side scanners** recognize bounded dependency formats such as `package.json`, `package-lock.json`, and `requirements*.txt`. They send an explicit digest rather than raw manifest content through this workflow.
- **Privacy-aware scan handoff** reduces a local scan to aggregate counts, provider signals, and host-profile information only after explicit consent.
- **The included Supabase migration and API** are designed to store evidence metadata behind tenant-aware row-level access controls, with an event history, optimistic revisions, and a synchronized assessment payload. No evidence file content is stored by the evidence workbench. The migration must be applied and exercised in the submitted environment before this is presented as a deployed capability.
- **Codex** was used throughout the Build Week implementation to inspect the existing codebase, design and implement the dossier workflow, add tests and documentation, review visual assets, and prepare the submission package.

## How we used GPT-5.6

GPT-5.6 is not used as a compliance oracle. It performs bounded reasoning tasks inside the assessment pipeline: extracting structured facts, classifying the supplied context, and identifying gaps that need evidence. The final dossier then passes through deterministic schemas and evidence-state invariants.

Preuvance records the model actually returned for each model stage in the report methodology. This makes the model claim inspectable in the demo instead of relying on a static marketing label.

> Submission gate: keep the model name above only after the submitted demo run visibly records GPT-5.6. If it does not, fix the environment and rerun; do not alter the evidence manually.

## How we used Codex

Codex served as the hands-on engineering environment for the Build Week work. It helped us:

- audit the pre-existing architecture and identify where evidence state was being lost;
- implement the living evidence register and its validation rules;
- add a bounded dependency scanner and a privacy-safe scan handoff;
- design metadata-only persistence, event history, and access controls;
- add focused tests and prepare end-to-end verification;
- inspect animation candidates and choose a watermark-free procedural direction;
- document the architecture, demo, limitations, and submission process.

**Codex Session ID:** `019f7c5f-4963-7413-8675-dd19e35c25fd`

## What we built during Build Week

Preuvance existed before the event. The Build Week version focuses on a new “instant dossier” workflow. Additions made in the working tree include:

- an evidence-by-evidence ledger with explicit Declared, Detected, Missing, and Proven semantics;
- human-review invariants for Proven evidence;
- browser-side integrity hashing and metadata-only evidence handling;
- supported manifest scanning with a bounded, redacted digest;
- explicit-consent handoff from local scan results to the assessment;
- persisted evidence metadata, event history, tenant-aware access, and dossier resumption;
- recording of the models actually returned by the assessment stages;
- focused tests, Build Week documentation, and a purpose-built demo narrative.

Only work completed after July 13, 2026 at 9:00 AM PT should be considered by the judges. The repository change log (`docs/build-week-change-log.md`) records the eligible commit hashes with their timestamps; only the initial scaffold commit predates the cutoff.

## Challenges we ran into

The hardest product problem was preserving the meaning of evidence. A detected package, a user declaration, and a reviewed document are not equivalent. Treating them as one generic “evidence” field would make the UI look complete while weakening trust.

We addressed that by making state transitions explicit and by keeping documentary coverage separate from regulatory readiness. We also reduced local source material to bounded digests so the assessment can use useful technical signals without automatically uploading raw manifests, scan paths, process names, IP addresses, or evidence documents.

## Accomplishments we are proud of

- Every Proven item has an enforceable reviewer-and-date requirement.
- Missing and unverified items do not count as declared proof.
- The dependency and local-scan handoffs are bounded and explain what is and is not transmitted.
- The report discloses the actual model used and requires human review.
- The workflow remains useful for preparing a review without claiming automatic legal compliance.

These are product and engineering properties, not claims about adoption, accuracy, certification, or measured time savings.

## What we learned

AI governance becomes more credible when uncertainty is visible. The most useful model output is not a definitive badge; it is a structured, traceable set of claims and gaps that a human can challenge.

We also learned that provenance needs to be designed into the interaction. Consent, source labels, review metadata, integrity hashes, and immutable event records are not secondary audit features—they are part of the core user experience.

## What’s next

- add more manifest and infrastructure formats with explicit coverage reporting;
- connect evidence metadata to approved enterprise document systems without storing unnecessary file content;
- add configurable review workflows and expiration reminders;
- strengthen evaluation fixtures for extraction and gap-analysis quality;
- add organization-level controls, retention policies, and export formats after security review.

## Responsible use and limitations

Preuvance is an assistance and documentation product. It does not provide legal advice, certify compliance, verify the truth of a document, or replace a qualified human reviewer. Dependency detection is bounded to documented formats and known package signatures. A cryptographic hash protects integrity but does not prove authenticity or adequacy. Model outputs can be incomplete or incorrect and must be reviewed.

## Testing instructions

1. No setup, in the browser: open `/demo` on the deployed application to explore the fictional Northstar dossier and download its sample broker PDF. This bounded fixture makes no model-provenance claim and triggers no API call.
2. To run the real assessment app locally (it requires your own OpenAI API key, by design — Preuvance never ships an anonymous OpenAI endpoint): clone the repository, then `npm install && npm run dev` and open http://localhost:3000 — or, on Windows, double-click `LANCER_PREUVANCE.cmd` (it prompts for the key without echoing it). No sign-in is required in the local non-persistent flow.
3. Start a new dossier with the fictional values and exact description in `demo/build-week/northstar-prompt.md`.
4. Attach `demo/build-week/package.json`.
5. Run the assessment and open the “Evidence by evidence” section.
6. Inspect a Detected item. If the presenter actually performs the demo review, add a reviewer label and date to the fictional review-procedure item; explain that this is an in-product attestation, not certification.
7. Export or reopen the dossier using the demonstrated flow.

Expected result: the dossier keeps Declared, Detected, Missing, and Proven states distinct; any Proven item displays its reviewer and review date; the methodology displays the actual GPT-5.6 model returned by the run.

## Submission links

- **Live landing (public):** https://milouuuuuuuu.github.io/Preuvance/ — the assessment app runs locally (see "Testing instructions").
- **Source repository:** `https://github.com/Milouuuuuuuu/Preuvance` — confirm public visibility or grant the two required private-repository accounts before submission.
- **YouTube demo (under 3 minutes, with audio):** https://youtu.be/T8e0u6iMdeA
- **Codex Session ID:** `019f7c5f-4963-7413-8675-dd19e35c25fd`

## 500-character fallback description

Preuvance turns a prompt, supported dependency manifests, and a consented local-scan digest into a living AI assurance dossier. GPT-5.6 structures context and identifies gaps; deterministic rules keep declarations, detections, missing evidence, and human-reviewed proof distinct. Each Proven item requires a reviewer and date. Raw manifests and evidence files are not uploaded by these workflows. Preuvance assists review—it does not certify compliance.

## Final pre-paste checklist

- [x] Every placeholder has been replaced (real links + Codex Session ID).
- [ ] A real configured run displays GPT-5.6 in the report methodology; the post-deadline walkthrough deliberately does not claim that its fixture is such a run.
- [x] Every feature described above is available in the submitted build (local run / repo).
- [x] Local tests and production build passed; CI is green on the submitted commit.
- [x] Commit hashes after the eligibility cutoff are recorded (`docs/build-week-change-log.md`).
- [x] No invented metric, customer, certification, benchmark, or award appears.
- [x] A replacement walkthrough is rendered locally under 3 minutes with audio (154.1 s); publication remains an external, post-deadline action requiring approval.
- [x] The repository access method satisfies the official requirements (public + MIT).

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.

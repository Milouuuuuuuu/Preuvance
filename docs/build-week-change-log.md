# Build Week change log — Preuvance

## Purpose and evidentiary status

This file separates the pre-existing Preuvance product from the work prepared for OpenAI Build Week 2026. It is a working inventory, not a substitute for Git history or the official eligibility review.

The event allows a pre-existing project, but only additions made after **July 13, 2026 at 9:00 AM PT** are judged. Before submission, every item claimed as Build Week work must be tied to a real commit whose timestamp and diff support the claim. No commit should be backdated.

## Post-deadline hardening — July 22, 2026

The submission deadline passed on July 21 at 5:00 PM PT. The following work is intentionally separated from the eligible submitted state and must not be presented as if it existed before the deadline:

- a public `/demo` route with a strict, frozen, fictional Northstar dossier and downloadable PDF;
- a scoped Node WASM loader that makes the Vinext production server start without changing the Cloudflare Worker artifact;
- production-start and public-demo regression tests;
- a 154.1-second 1080p narrated walkthrough with explicit fixture/model disclosures;
- a generated social-card visual with no score, model claim or certification language.

These changes live on `codex/post-build-week-demo`. They may be shared as post-deadline improvements only if the organizers allow updates; the submitted commit history below remains the source of truth for judging eligibility.

Post-deadline verification on July 22, 2026:

| Gate | Result |
|---|---|
| Complete repository gate | PASS — lint, typecheck, 89 unit tests, production build, 2 Node-start tests, 11 HTTP/Worker tests |
| Remotion typecheck | PASS |
| Replacement video | PASS — 154.1 s, 1920×1080, H.264 video, AAC stereo at 48 kHz |
| Public sample PDF | PASS — strict contract and material `%PDF-` artifact test |

## Pre-existing baseline — do not claim as new

The repository already contained the broader Preuvance concept and application before this Build Week workstream, including an AI assessment flow, control/gap analysis, report generation, a local scanner, authentication/persistence foundations, and Remotion-based pitch assets.

The exact baseline must be established from the last commit before the cutoff. The description above is intentionally broad and must not be used to claim a specific pre-cutoff feature date without checking Git.

## Build Week work observed on July 20, 2026

The following changes are present in the working tree or were reported as part of the active implementation. Their final status and eligible commit hashes must be verified before submission.

| Workstream | Concrete addition | Principal files | Current evidence status |
|---|---|---|---|
| Instant dossier | Reframed the primary workflow around a dossier assembled from a prompt and bounded technical signals | `app/page.tsx`, `app/components/AssessmentForm.tsx`, `app/components/AssessmentResults.tsx` | Browser-rendered locally; manifest handoff verified |
| Evidence ledger | Added strict evidence statuses, stable IDs, source metadata, reviewer invariants and a separate documentary-coverage score | `lib/evidence/evidence-ledger.ts`, `app/components/EvidenceWorkbench.tsx`, `lib/pdf/assessment-payload.ts`, `lib/pdf/preuvance-report.tsx` | Present; focused tests pass; cloud integration still requires staging |
| Gap-to-evidence preservation | Created one dossier entry for each needed proof instead of collapsing evidence requirements | `app/lib/assessment/synthesis.ts` and related assessment types | Focused deterministic tests pass |
| Dependency digest | Added bounded parsing for supported Node and Python manifests, known AI packages, direct/transitive lockfile signals and explicit coverage metadata | `lib/scan/dependency-contract.ts`, `lib/scan/dependency-scanner.ts`, `app/components/DependencyManifestLoader.tsx` | Unit tests pass; browser fixture finds 3 expected packages from 1 manifest |
| Local scan handoff | Added an aggregate, redacted scan digest with explicit consent and session handoff | `lib/scan/scan-handoff.ts`, `app/components/ScanReportLoader.tsx`, `app/components/AssessmentExperience.tsx` | Privacy and fixture tests pass |
| Living persistence | Added evidence metadata tables, events, tenant-aware RLS, synchronized report state, evidence API and dossier resumption route | `supabase/migrations/202607200001_evidence_dossier.sql`, `app/api/assessments/[assessmentId]/evidence/route.ts`, `app/dossiers/[assessmentId]/page.tsx`, `app/components/DossierViewer.tsx` | Present in working tree; migration must be applied and tested in the target Supabase project |
| Model provenance | Recorded models actually returned by assessment stages and exposed the methodology in the dossier/report | `app/lib/assessment/pipeline.ts`, `app/lib/assessment/synthesis.ts`, `app/components/AssessmentResults.tsx`, `lib/pdf/preuvance-report.tsx` | Present in working tree; real GPT-5.6 run required before claim is submitted |
| Test coverage | Added focused unit tests for evidence semantics, manifest scanning and scan-digest redaction | `tests/evidence-ledger.test.ts`, `tests/dependency-scanner.test.ts`, `tests/scan-handoff.test.ts`, `package.json` | 85 unit tests and 10 rendered-HTML/Worker tests pass locally |
| Build Week package | Added execution checklist, Devpost copy, timed demo script, change log, animation decision record, local deck and PowerPoint | `docs/`, `app/build-week/`, `app/components/BuildWeekDeck.tsx`, `outputs/preuvance-openai-build-week.pptx` | Local deck browser-QA complete; PPTX 8/8 slides inspected and overflow test passes; final URLs remain owner input |

## Claims that are not supported and must not be added

Unless separate, verifiable evidence is supplied, the submission must not claim:

- a number of customers, users, dossiers or assessments;
- a measured percentage of time saved;
- a model accuracy, recall, benchmark or error rate;
- legal approval, certification or guaranteed regulatory compliance;
- production deployment or successful external security audit;
- a partnership, endorsement, prize or prior acceptance into Build Week;
- that every repository, language or AI dependency can be scanned;
- that a SHA-256 hash proves authenticity, truth or adequacy of a document.

## Commit evidence to complete

Populate this table only from the actual Git history after the work is intentionally committed.

**Pre-cutoff baseline:** `47874da` — 2026-07-13 16:40:41 +0200 (07:40 AM PT, *before* the 9:00 AM PT cutoff) — "Build Preuvance EU AI Act readiness MVP". Every later commit in this repository is post-cutoff.

| Commit hash | Authored/committed time with timezone | Eligible after cutoff? | Files/workstream | Verification command or artifact |
|---|---|---|---|---|
| `fd61d05` | 2026-07-20 11:53:39 +0200 | Yes | Instant dossier, evidence semantics, dependency/scan digests, persistence + RLS migration, model provenance, 4 test suites | `git show --stat fd61d05` |
| `2d95a3a` | 2026-07-20 11:53:41 +0200 | Yes | Build Week package: /build-week deck, demo fixture, submission docs, deck/QA scripts | `git show --stat 2d95a3a` |
| `5c4c1af` | 2026-07-20 11:53:41 +0200 | Yes | Remotion film refinements; Higgsfield render outputs untracked | `git show --stat 5c4c1af` |
| `5d9307d` | 2026-07-20 11:54:50 +0200 | Yes | /scan and /en-clair pages, product docs and local launcher aligned with the instant dossier | `git show --stat 5d9307d` |
| `efa319b` | 2026-07-20 11:55:23 +0200 | Yes | BEHAVIOR.md D-071..D-082, README Build Week section, baseline and this change log | `git show --stat efa319b` |
| `becf9ed` | 2026-07-20 11:57:09 +0200 | Yes | Final 8-slide PowerPoint tracked in the repository | `git show --stat becf9ed` |

Earlier post-cutoff commits (2026-07-13 20:24 +0200 through 2026-07-18 20:18 +0200, `d0c6abd`..`9c429dc`) hold the hardening, local scanner, declared/observed concordance, portability and film groundwork; they are also eligible but predate this Build Week sprint's dossier workstream.

Recommended read-only checks:

```powershell
git log --since="2026-07-13T09:00:00-07:00" --date=iso-strict --name-status
git show --stat --oneline <commit-hash>
git diff <pre-cutoff-baseline>...<submitted-tag> --
```

The cutoff uses Pacific Time. Preserve timezone information in the output or export it alongside the submission record.

## Verification record to complete

| Gate | Command or action | Result | Evidence |
|---|---|---|---|
| Complete repository gate | `npm.cmd test` | **PASS — exit 0** | Run on committed HEAD `becf9ed`, 20 July 2026: lint, typecheck, 85 unit tests, production build and 10 HTTP/Worker tests |
| Unit tests | `npm.cmd run test:unit` | **PASS — 85/85** | Reconfirmed inside the complete repository gate |
| Rendered HTML and Worker PDF | `node --test tests/rendered-html.test.mjs` | **PASS — 10/10** | Covers homepage, scan, Build Week deck, auth failures and PDF routes |
| Lint | `npm.cmd run lint` | **PASS** | ESLint exit 0, 20 July 2026 |
| TypeScript | `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` exit 0, 20 July 2026 |
| Production build | `npm.cmd run build` | **PASS** | Vinext production build exit 0; dossier/evidence routes included |
| PowerPoint layout | bundled `slides_test.py` | **PASS — 8 slides** | Final PPTX reimported, all slides visually inspected, no overflow detected |
| Supabase migration | Apply on demo project and exercise RLS | **OWNER ACTION — not executed** | Apply all 3 migrations; test two tenants and a revision conflict |
| Real model provenance | Complete run shows GPT-5.6 returned in methodology | **OWNER ACTION** | Record one real assessment showing `gpt-5.6-*` in the report methodology; capture it in the demo video and/or commit a redacted report JSON. |
| Browser flow | Prompt → manifest → dossier → review → save/reopen/export | **PARTIAL** | Manifest fixture and deck verified; real model + cloud save/reopen need configured services |
| Video | YouTube, audio present, duration under 3 minutes | **PARTIAL — replace teaser with 2:45 walkthrough** | https://youtu.be/T8e0u6iMdeA |
| Repository access | Public + licence, or both official test accounts granted | **DONE** | Public + MIT — github.com/Milouuuuuuuu/Preuvance |
| Codex evidence | `/feedback` from the main task | **DONE** | Session ID `019f7c5f-4963-7413-8675-dd19e35c25fd` |

## Final eligible-diff statement template

Use only after filling the commit evidence above:

> Preuvance predates OpenAI Build Week 2026. For judging, we are submitting only the additions made after July 13, 2026 at 9:00 AM PT — every commit after the pre-cutoff baseline `47874da` (see the table above; principal Build Week commits `fd61d05`, `2d95a3a`, `5c4c1af`, `5d9307d`, `efa319b` and `becf9ed`). These additions implement the instant dossier, evidence-state invariants, bounded dependency and scan digests, living evidence persistence, model provenance, focused tests, and the Build Week demo package. The pre-existing assessment and reporting foundation is disclosed as prior work.

## Owner TODO

- [x] Identify and record the last pre-cutoff baseline commit (`47874da`, 07:40 AM PT).
- [x] Commit the new work without rewriting or falsifying timestamps (July 20, 2026, real clock).
- [x] Insert all eligible commit hashes in this file; copy them into Devpost.
- [x] Record local test/build results; rerun and attach CI evidence on the submitted commit.
- [ ] Confirm that the deployed app corresponds exactly to the submitted commit or tag.
- [x] Decide repository visibility and licensing (public + MIT).
- [x] Supply the real `/feedback` Session ID (`019f7c5f-4963-7413-8675-dd19e35c25fd`) and final URLs (YouTube, landing).
- [ ] **Owner, before the deadline:** publish the 2:45 narrated walkthrough (script: `docs/DEMO_SCRIPT_BUILD_WEEK.md`) recording a real GPT-5.6 run, and paste its URL into Devpost in place of the teaser.

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.

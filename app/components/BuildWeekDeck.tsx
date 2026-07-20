"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Brand } from "./Brand";

const TOTAL_SLIDES = 8;

type SlideProps = {
  active: boolean;
};

export function BuildWeekDeck() {
  const [index, setIndex] = useState(0);
  const slides = useMemo(
    () => [
      <OpeningSlide key="opening" active={index === 0} />,
      <ProblemSlide key="problem" active={index === 1} />,
      <LoopSlide key="loop" active={index === 2} />,
      <DossierSlide key="dossier" active={index === 3} />,
      <EvidenceSlide key="evidence" active={index === 4} />,
      <ArchitectureSlide key="architecture" active={index === 5} />,
      <TrustSlide key="trust" active={index === 6} />,
      <ClosingSlide key="closing" active={index === 7} />,
    ],
    [index],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, TOTAL_SLIDES - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(TOTAL_SLIDES - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const goTo = (nextIndex: number) => {
    setIndex(nextIndex);
  };

  return (
    <main className="pv-bw-shell">
      <header className="pv-bw-topbar">
        <Link href="/" aria-label="Back to Preuvance">
          <Brand compact />
        </Link>
        <div className="pv-bw-topbar-meta">
          <span>OpenAI Build Week 2026</span>
          <span aria-hidden="true">·</span>
          <span>Work &amp; Productivity</span>
        </div>
        <Link className="pv-bw-live-link" href="/#evaluation">
          Open live product
        </Link>
      </header>

      <section
        className="pv-bw-stage"
        aria-label={`Slide ${index + 1} of ${TOTAL_SLIDES}`}
        aria-live="polite"
      >
        {slides[index]}
      </section>

      <footer className="pv-bw-controls">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          ← Previous
        </button>
        <div className="pv-bw-dots" aria-label="Choose a slide">
          {Array.from({ length: TOTAL_SLIDES }, (_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              className={dotIndex === index ? "is-active" : ""}
              onClick={() => goTo(dotIndex)}
              aria-label={`Go to slide ${dotIndex + 1}`}
              aria-current={dotIndex === index ? "step" : undefined}
            />
          ))}
        </div>
        <span className="pv-bw-counter">
          {String(index + 1).padStart(2, "0")} / {TOTAL_SLIDES}
        </span>
        <button
          type="button"
          onClick={() => goTo(Math.min(TOTAL_SLIDES - 1, index + 1))}
          disabled={index === TOTAL_SLIDES - 1}
          aria-label="Next slide"
        >
          Next →
        </button>
      </footer>
    </main>
  );
}

function SlideFrame({
  active,
  eyebrow,
  number,
  children,
  className = "",
}: SlideProps & {
  eyebrow: string;
  number: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`pv-bw-slide ${active ? "is-active" : ""} ${className}`}
      role="group"
      aria-roledescription="slide"
      aria-label={`${number}. ${eyebrow}`}
    >
      <div className="pv-bw-slide-head">
        <span>{eyebrow}</span>
        <span>{number}</span>
      </div>
      {children}
      <div className="pv-bw-grid" aria-hidden="true" />
    </article>
  );
}

function OpeningSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="THE PRODUCT" number="01" className="pv-bw-opening">
      <div className="pv-bw-opening-copy">
        <p className="pv-bw-kicker">PROMPT · SCAN · PROVE</p>
        <h1>From a prompt to a living AI assurance dossier.</h1>
        <p className="pv-bw-lead">
          Preuvance turns what a company says, what its stack reveals, and what a
          human verifies into one inspectable evidence trail.
        </p>
        <div className="pv-bw-chip-row">
          <span>GPT-5.6</span>
          <span>Codex</span>
          <span>Evidence by evidence</span>
        </div>
      </div>
      <div className="pv-bw-orbit" aria-label="Declared, detected and proven evidence converge into one dossier">
        <div className="pv-bw-orbit-ring is-outer" />
        <div className="pv-bw-orbit-ring is-inner" />
        <span className="pv-bw-orbit-node is-declared">Declared</span>
        <span className="pv-bw-orbit-node is-detected">Detected</span>
        <span className="pv-bw-orbit-node is-proven">Proven</span>
        <strong>DOSSIER</strong>
      </div>
    </SlideFrame>
  );
}

function ProblemSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="THE GAP" number="02">
      <div className="pv-bw-title-block">
        <p className="pv-bw-kicker">THE ASSURANCE PROBLEM</p>
        <h2>AI governance still stops at self-declaration.</h2>
        <p>A polished score is not assurance if nobody can inspect the underlying proof.</p>
      </div>
      <div className="pv-bw-gap-layout">
        <div className="pv-bw-gap-card is-muted">
          <span className="pv-bw-gap-index">01</span>
          <strong>Questionnaire</strong>
          <p>What the organisation says.</p>
          <small>Useful context — not proof.</small>
        </div>
        <div className="pv-bw-gap-arrow" aria-hidden="true">→</div>
        <div className="pv-bw-gap-card is-signal">
          <span className="pv-bw-gap-index">02</span>
          <strong>Technical signal</strong>
          <p>What manifests and local observations reveal.</p>
          <small>Detected — still needs interpretation.</small>
        </div>
        <div className="pv-bw-gap-arrow" aria-hidden="true">→</div>
        <div className="pv-bw-gap-card is-proof">
          <span className="pv-bw-gap-index">03</span>
          <strong>Reviewed evidence</strong>
          <p>What a named human has checked and dated.</p>
          <small>Only then: proven.</small>
        </div>
      </div>
      <blockquote>“Declared” must never silently become “proven”.</blockquote>
    </SlideFrame>
  );
}

function LoopSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="HOW IT WORKS" number="03">
      <div className="pv-bw-title-block is-compact">
        <p className="pv-bw-kicker">ONE LOOP · THREE INPUT LAYERS</p>
        <h2>Prompt. Scan. Prove.</h2>
      </div>
      <div className="pv-bw-loop">
        <div className="pv-bw-loop-step">
          <span>01</span>
          <strong>Prompt</strong>
          <p>Describe the system, purpose, people and safeguards.</p>
          <code>“Our support copilot…”</code>
        </div>
        <div className="pv-bw-loop-line" aria-hidden="true" />
        <div className="pv-bw-loop-step">
          <span>02</span>
          <strong>Scan</strong>
          <p>Add bounded dependency and local observation digests.</p>
          <code>package.json · aggregate scan</code>
        </div>
        <div className="pv-bw-loop-line" aria-hidden="true" />
        <div className="pv-bw-loop-step">
          <span>03</span>
          <strong>Prove</strong>
          <p>Review every expected artefact, owner and validity date.</p>
          <code>reviewer · timestamp · SHA-256</code>
        </div>
      </div>
      <div className="pv-bw-output-band">
        <span>OUTPUT</span>
        <strong>A living dossier that can be resumed, exported and audited.</strong>
      </div>
    </SlideFrame>
  );
}

function DossierSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="INSTANT DOSSIER" number="04">
      <div className="pv-bw-title-block is-compact">
        <p className="pv-bw-kicker">REAL PRODUCT FLOW · DEMO DATA</p>
        <h2>One input becomes a structured working file.</h2>
      </div>
      <div className="pv-bw-demo-grid">
        <div className="pv-bw-demo-input">
          <span className="pv-bw-terminal-dot-row" aria-hidden="true"><i /><i /><i /></span>
          <p className="pv-bw-mono-label">SYSTEM DESCRIPTION</p>
          <blockquote>
            “A customer-support copilot drafts answers from approved knowledge.
            An agent validates every response before it is sent.”
          </blockquote>
          <p className="pv-bw-mono-label">LOCAL MANIFEST DIGEST</p>
          <code>openai · langchain · SHA-256 linked</code>
        </div>
        <div className="pv-bw-demo-report">
          <div className="pv-bw-report-topline">
            <strong>ASSURANCE DOSSIER</strong>
            <span>Classification to confirm</span>
          </div>
          <div className="pv-bw-report-section">
            <small>SYSTEM</small>
            <strong>Customer-support copilot</strong>
            <p>Human-reviewed text generation · deployer role</p>
          </div>
          <div className="pv-bw-report-section">
            <small>EVIDENCE REGISTER</small>
            <EvidenceMiniRow label="Human validation" status="DECLARED" tone="declared" />
            <EvidenceMiniRow label="AI SDK dependency" status="DETECTED" tone="detected" />
            <EvidenceMiniRow label="Review procedure" status="MISSING" tone="missing" />
          </div>
          <div className="pv-bw-report-footer">Analysed with GPT-5.6 · Human review required</div>
        </div>
      </div>
    </SlideFrame>
  );
}

function EvidenceMiniRow({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: string;
}) {
  return (
    <div className="pv-bw-mini-row">
      <span>{label}</span>
      <b className={`is-${tone}`}>{status}</b>
    </div>
  );
}

function EvidenceSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="EVIDENCE MODEL" number="05">
      <div className="pv-bw-title-block is-compact">
        <p className="pv-bw-kicker">A SEMANTIC SAFETY RAIL</p>
        <h2>Proof is a state transition, not a label.</h2>
      </div>
      <div className="pv-bw-ladder">
        <div className="pv-bw-ladder-card is-declared">
          <span>01</span><strong>Declared</strong><p>Stated by the user.</p><small>0 reviewers</small>
        </div>
        <div className="pv-bw-ladder-card is-detected">
          <span>02</span><strong>Detected</strong><p>Observed in a bounded scan.</p><small>Technical signal</small>
        </div>
        <div className="pv-bw-ladder-card is-documented">
          <span>03</span><strong>Documented</strong><p>File metadata and integrity hash.</p><small>Truth not yet reviewed</small>
        </div>
        <div className="pv-bw-ladder-card is-proven">
          <span>04</span><strong>Proven</strong><p>Named reviewer + review date.</p><small>Auditable transition</small>
        </div>
      </div>
      <div className="pv-bw-rule-strip">
        <strong>Invariant</strong>
        <span>SHA-256 proves file integrity, not factual truth.</span>
        <span>Evidence coverage stays separate from regulatory readiness.</span>
      </div>
    </SlideFrame>
  );
}

function ArchitectureSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="AI + ENGINEERING" number="06">
      <div className="pv-bw-title-block is-compact">
        <p className="pv-bw-kicker">MEANINGFUL GPT-5.6 AND CODEX USE</p>
        <h2>Reasoning where judgement helps. Code where invariants matter.</h2>
      </div>
      <div className="pv-bw-architecture">
        <div className="pv-bw-arch-column">
          <small>INPUT</small>
          <strong>Prompt + digests</strong>
          <p>Business context, manifests and expurgated local observations.</p>
        </div>
        <div className="pv-bw-arch-column is-ai">
          <small>GPT-5.6</small>
          <strong>Structured reasoning</strong>
          <ul><li>Fact extraction</li><li>Risk classification</li><li>Gap analysis</li></ul>
          <em>Actual returned model IDs recorded</em>
        </div>
        <div className="pv-bw-arch-column is-code">
          <small>DETERMINISTIC CORE</small>
          <strong>Rules + contracts</strong>
          <ul><li>Schema validation</li><li>Regulatory cross-check</li><li>Hard score caps</li></ul>
          <em>No model can mark proof as verified</em>
        </div>
        <div className="pv-bw-arch-column is-output">
          <small>OUTPUT</small>
          <strong>Living dossier</strong>
          <p>Evidence ledger, events, PDF and resumable workspace.</p>
        </div>
      </div>
      <p className="pv-bw-codex-note"><b>Codex</b> implemented, tested, audited and documented the Build Week product layer.</p>
    </SlideFrame>
  );
}

function TrustSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="TRUST BOUNDARY" number="07">
      <div className="pv-bw-title-block is-compact">
        <p className="pv-bw-kicker">PRIVACY BY DATA MINIMISATION</p>
        <h2>Inspect the stack without exporting the stack.</h2>
      </div>
      <div className="pv-bw-boundary">
        <div className="pv-bw-boundary-local">
          <span>STAYS IN THE BROWSER</span>
          <strong>Raw manifest content</strong>
          <strong>Local file bytes</strong>
          <strong>Paths, IPs and process names</strong>
        </div>
        <div className="pv-bw-boundary-gate">
          <span>EXPLICIT CONSENT</span>
          <div>→</div>
          <small>bounded · hashed · expurgated</small>
        </div>
        <div className="pv-bw-boundary-cloud">
          <span>ENTERS THE DOSSIER</span>
          <strong>Recognised package names</strong>
          <strong>Aggregate observations</strong>
          <strong>Evidence metadata + SHA-256</strong>
        </div>
      </div>
      <div className="pv-bw-trust-cards">
        <div><strong>Tenant isolation</strong><span>RLS-bound organisation access</span></div>
        <div><strong>Traceability</strong><span>Evidence transition event log</span></div>
        <div><strong>Human authority</strong><span>Reviewer and timestamp required</span></div>
      </div>
      <p className="pv-bw-footnote">Cloud history requires the included Supabase migration to be applied.</p>
    </SlideFrame>
  );
}

function ClosingSlide({ active }: SlideProps) {
  return (
    <SlideFrame active={active} eyebrow="THE ASK" number="08" className="pv-bw-closing">
      <div className="pv-bw-closing-copy">
        <p className="pv-bw-kicker">AI ASSURANCE, MADE INSPECTABLE</p>
        <h2>Move from “trust us” to “show me”.</h2>
        <p>
          Preuvance makes every claim traceable to a source, every missing proof visible,
          and every verification attributable to a human.
        </p>
        <div className="pv-bw-closing-actions">
          <Link href="/#evaluation">Build an instant dossier</Link>
          <span>Preuvance · OpenAI Build Week 2026</span>
        </div>
      </div>
      <div className="pv-bw-reel">
        <video controls preload="metadata" playsInline>
          <source src="/media/preuvance-proof-film.mp4" type="video/mp4" />
          Your browser does not support the Preuvance demo reel.
        </video>
        <p>48-second procedural product reel · no generated watermark</p>
      </div>
    </SlideFrame>
  );
}

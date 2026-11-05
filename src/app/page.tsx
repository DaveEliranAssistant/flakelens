import { Waitlist } from "@/components/waitlist";
import { Workspace } from "@/components/workspace";

export default function HomePage() {
  return (
    <>
      <a className="skip" href="#triage">
        Skip to triage
      </a>
      <div className="shell">
        <header className="site-header">
          <a className="brand" href="#top">
            <svg className="mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
              <path d="M16 2.5v4.2M16 25.3v4.2M2.5 16h4.2M25.3 16h4.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <strong>FlakeLens</strong>
          </a>
          <nav className="header-links" aria-label="Page">
            <a href="#triage">Triage</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#limitations">Limitations</a>
          </nav>
        </header>

        <main id="top">
          <section className="hero">
            <div>
              <p className="eyebrow">Privacy-first flaky-test triage</p>
              <h1>Separate the flakes from the breaks.</h1>
              <p className="lede">
                Drop in JUnit from Playwright, Jest, or pytest. FlakeLens builds a per-test history, scores pass/fail
                flips and explicit retry recoveries, and groups similar failure messages into heuristic clusters. Parsing and scoring run in your
                browser.
              </p>
              <p className="pledge">Your files never leave your browser.</p>
              <p className="pledge-sub">Demo data is synthetic.</p>
            </div>
            <aside className="fact-card">
              <p className="kicker">What you get</p>
              <ol>
                <li>
                  A verdict for every test
                  <span>Insufficient evidence, flaky, regression pattern, or no failures observed — with reasons.</span>
                </li>
                <li>
                  Heuristic failure clusters
                  <span>Line numbers, paths, durations, hex ids, and timestamps are stripped before grouping.</span>
                </li>
                <li>
                  Actionable review candidates
                  <span>Review evidence and download JSON/Markdown. No automatic quarantine, account, or payment.</span>
                </li>
              </ol>
            </aside>
          </section>

          <Workspace />

          <section className="limitations" id="roadmap">
            <h2>Roadmap</h2>
            <p>
              The repository CLI uses this same parser and scorer locally on a CI runner; see the pinned CI quickstart in the repository. This increment remains in review, not a package release. Future work: explicit owner/expiry quarantine policy and customer-controlled history comparisons. Neither is implemented; no hosted history or payment is required.
            </p>
          </section>

          <Waitlist />

          <section className="limitations" id="limitations">
            <h2>Limitations</h2>
            <ul>
              <li>The labels are a heuristic. A flake can still be a real bug, and a clean break can still be environmental.</li>
              <li>Each file must represent one CI run. Explicit numeric retry metadata is distinguished from repeated names; names alone do not prove a retry.</li>
              <li>A regression pattern needs a passing observation, then two independent timestamp-ordered all-failing runs, provided commit/run metadata and a changed commit. It does not prove causality.</li>
              <li>Single failures, all-failing histories without a passing baseline, cross-commit oscillations alone, and skipped-only tests yield insufficient evidence. Missing metadata is visible; a retry recovery can still be informative without a commit.</li>
              <li>Heuristic clustering merges only matching normalized text. Similar text need not share a root cause; different wording can split one cause.</li>
              <li>No test is automatically quarantined. Neither flakes nor insufficient evidence make a failing CI run safe to ignore. Cost numbers are editable scenarios, not measured savings.</li>
              <li>Refresh clears the analysis. Nothing is stored except a waitlist address you choose to keep in local storage.</li>
            </ul>
          </section>
        </main>

        <footer className="site-footer">
          <p>FlakeLens POC. All rights reserved.</p>
          <nav aria-label="Footer">
            <a href="#triage">Triage</a>
            <a href="#limitations">Limitations</a>
          </nav>
          <p className="privacy-note">
            This site uses Vercel Web Analytics (cookieless, aggregated page views, no personal profiles). Privacy
            questions:{" "}
            <a href="mailto:dave.eliran.assistant@gmail.com">dave.eliran.assistant@gmail.com</a>
          </p>
        </footer>
      </div>
    </>
  );
}

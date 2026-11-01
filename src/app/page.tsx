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
                flips and retry recoveries, and clusters stack traces into root causes. Parsing and scoring run in your
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
                  <span>Flaky, regression since a commit, or stable.</span>
                </li>
                <li>
                  Root-cause clusters
                  <span>Line numbers, paths, durations, hex ids, and timestamps are stripped before grouping.</span>
                </li>
                <li>
                  A quarantine list
                  <span>Copy the flaky ids, or download JSON and Markdown. No account and no payment.</span>
                </li>
              </ol>
            </aside>
          </section>

          <Workspace />

          <section className="limitations" id="roadmap">
            <h2>Roadmap</h2>
            <p>
              Next is a GitHub Action and a CLI that print this same report on the runner, still without uploading JUnit
              to a service. A later paid tier would add saved history across branches and a shared quarantine list.
              This POC does not include either, and it does not take payment.
            </p>
          </section>

          <Waitlist />

          <section className="limitations" id="limitations">
            <h2>Limitations</h2>
            <ul>
              <li>The labels are a heuristic. A flake can still be a real bug, and a clean break can still be environmental.</li>
              <li>Each file is one CI run. Retries are repeated testcase names, or a numeric retry property.</li>
              <li>A regression needs a pass-to-fail boundary, then at least two failing runs, with no later pass and no retry recovery.</li>
              <li>One trailing failure is called flaky. A test that fails in every uploaded run is a regression since the first commit you included.</li>
              <li>Clustering merges failures only when the text still matches after normalization. Different wording stays split.</li>
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

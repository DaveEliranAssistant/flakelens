"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PRIVACY_CONTACT,
  WAITLIST_INVALID,
  WAITLIST_SUCCESS,
  WAITLIST_UNAVAILABLE,
} from "@/lib/waitlist/messages";
import { validateWaitlistInput, type WaitlistFields } from "@/lib/waitlist/validate";

// The earlier version of this form kept addresses here. Nothing reads them now.
const LEGACY_STORAGE_KEY = "flakelens.waitlist.v1";

type Phase = "loading" | "unavailable" | "ready" | "done";

type ApiError = {
  message?: string;
  fields?: WaitlistFields;
};

export function Waitlist() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<WaitlistFields>({});
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage can be blocked. There is then nothing to clean up.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/waitlist", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { available?: boolean };
        setPhase(response.ok && body.available === true ? "ready" : "unavailable");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPhase("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (message && phase === "ready") errorRef.current?.focus();
  }, [message, fields, phase]);

  useEffect(() => {
    if (phase === "done") successRef.current?.focus();
  }, [phase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { email, consent, company_website: honeypot };
    const validated = validateWaitlistInput(payload);
    if (!validated.ok) {
      setFields(validated.fields);
      setMessage(WAITLIST_INVALID);
      return;
    }

    setPending(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as ApiError;
      if (response.ok) {
        setPhase("done");
      } else if (response.status === 503) {
        setPhase("unavailable");
      } else {
        setFields(body.fields ?? {});
        setMessage(body.message || WAITLIST_INVALID);
      }
    } catch {
      setPhase("unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="waitlist" id="waitlist" aria-labelledby="waitlist-heading">
      <h2 id="waitlist-heading">Hear about the Action</h2>
      <p>
        Leave an email if you want a note when the GitHub Action exists. Updates about the Action only. There is no
        payment, and your JUnit files stay in this browser.
      </p>
      {phase === "done" ? null : (
        <p>
          You do not need to wait or sign up. The <a href="#triage">browser triage</a> and the{" "}
          <a href="#cli">npm CLI</a> are open now.
        </p>
      )}
      {phase === "loading" ? <p role="status">Checking whether the waitlist is open.</p> : null}
      {phase === "unavailable" ? <p role="status">{WAITLIST_UNAVAILABLE}</p> : null}
      {phase === "done" ? (
        <p ref={successRef} id="waitlist-success" role="status" tabIndex={-1}>
          {WAITLIST_SUCCESS}
        </p>
      ) : null}
      <noscript>
        <p>The waitlist needs JavaScript. Nothing is collected without it.</p>
      </noscript>
      {phase === "ready" ? (
        <form onSubmit={onSubmit} data-testid="waitlist-form" noValidate aria-busy={pending}>
          {message ? (
            <p ref={errorRef} id="waitlist-error" className="waitlist-full waitlist-error" role="alert" tabIndex={-1}>
              {message}
            </p>
          ) : null}
          <label htmlFor="waitlist-email">Email</label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            aria-invalid={Boolean(fields.email)}
            aria-describedby={fields.email ? "waitlist-email-error" : undefined}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          {fields.email ? (
            <p id="waitlist-email-error" className="waitlist-full waitlist-error">
              {fields.email}
            </p>
          ) : null}
          <div className="waitlist-trap" inert>
            <label htmlFor="waitlist-website">Company website</label>
            <input
              id="waitlist-website"
              name="company_website"
              type="text"
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>
          <label className="waitlist-consent waitlist-full" htmlFor="waitlist-consent">
            <input
              id="waitlist-consent"
              name="consent"
              type="checkbox"
              checked={consent}
              aria-invalid={Boolean(fields.consent)}
              aria-describedby={fields.consent ? "waitlist-consent-error" : undefined}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>I agree to receive updates about the FlakeLens GitHub Action. I can withdraw consent.</span>
          </label>
          {fields.consent ? (
            <p id="waitlist-consent-error" className="waitlist-full waitlist-error">
              {fields.consent}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Joining…" : "Join the waitlist"}
          </button>
        </form>
      ) : null}
      <details>
        <summary>What the waitlist stores</summary>
        <p>
          If you join and consent, the server stores your normalized email address, that you consented, the time you
          joined, the source (this landing page) and a SHA-256 hash of your browser user agent. Your IP address is not
          stored; it is used only for a short in-memory rate limit. Signups are kept until you ask for deletion. To
          withdraw or delete, email{" "}
          <a href={`mailto:${PRIVACY_CONTACT}?subject=FlakeLens%20waitlist%20deletion`}>{PRIVACY_CONTACT}</a> from the
          address you used.
        </p>
      </details>
    </section>
  );
}

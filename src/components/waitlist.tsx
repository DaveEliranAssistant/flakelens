"use client";

import { useState, type FormEvent } from "react";

const STORAGE_KEY = "flakelens.waitlist.v1";

type Entry = { email: string; savedAt: string };

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNote("Enter an email address.");
      return;
    }

    const previous = readEntries();
    previous.push({ email: trimmed, savedAt: new Date().toISOString() });
    const capped = previous.slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));

    const body = `Please add ${trimmed} to the FlakeLens waitlist.\n\nThis draft was created in the browser. FlakeLens has no account server.`;
    const href = `mailto:hello@flakelens.local?subject=${encodeURIComponent("FlakeLens waitlist")}&body=${encodeURIComponent(body)}`;
    setNote("Saved on this device. Your email app should open. Nothing was sent to a server.");
    window.location.href = href;
  }

  return (
    <section className="waitlist" id="waitlist">
      <h2>Hear about the Action</h2>
      <p>
        Leave an email if you want a note when the GitHub Action exists. This stores the address in local storage and
        opens a draft email. Nothing is sent to a server. There is no payment.
      </p>
      <form onSubmit={onSubmit} data-testid="waitlist-form" noValidate>
        <label htmlFor="waitlist-email">Email</label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit" className="primary">
          Open a draft email
        </button>
      </form>
      {note ? <p role="status">{note}</p> : null}
    </section>
  );
}

function readEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      if (typeof record.email !== "string" || typeof record.savedAt !== "string") return [];
      return [{ email: record.email, savedAt: record.savedAt }];
    });
  } catch {
    return [];
  }
}

"use client";

import { useState, type DragEvent } from "react";
import { Results } from "@/components/results";
import { analyzeRuns } from "@/lib/analyze";
import { JUnitParseError, parseJUnit } from "@/lib/parse-junit";
import type { Analysis } from "@/lib/types";

type LoadedFile = { name: string; text: string };

export function Workspace() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("");

  function ingest(files: LoadedFile[]) {
    const nextErrors: string[] = [];
    const parsed = files.flatMap((file, index) => {
      try {
        return [parseJUnit(file.text, file.name, index)];
      } catch (error) {
        const message = error instanceof JUnitParseError || error instanceof Error ? error.message : "Could not parse file.";
        nextErrors.push(message);
        return [];
      }
    });
    setErrors(nextErrors);
    setAnalysis(parsed.length > 0 ? analyzeRuns(parsed) : null);
  }

  async function onFiles(list: FileList | File[]) {
    const files = await Promise.all([...list].map(async (file) => ({ name: file.name, text: await file.text() })));
    if (files.length === 0) return;
    setSourceLabel(`${files.length} file${files.length === 1 ? "" : "s"} from this device`);
    ingest(files);
  }

  async function loadDemo() {
    setLoading(true);
    setErrors([]);
    try {
      const indexResponse = await fetch("/demo/index.json");
      if (!indexResponse.ok) throw new Error("The demo index did not load.");
      const index = (await indexResponse.json()) as { files?: string[] };
      const names = index.files ?? [];
      const files = await Promise.all(
        names.map(async (name) => {
          const response = await fetch(`/demo/${encodeURIComponent(name)}`);
          if (!response.ok) throw new Error(`Missing demo file ${name}.`);
          return { name, text: await response.text() };
        }),
      );
      setSourceLabel("Synthetic Marigold Shop demo");
      ingest(files);
    } catch (error) {
      setAnalysis(null);
      setErrors([error instanceof Error ? error.message : "Could not load the demo."]);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void onFiles(event.dataTransfer.files);
  }

  return (
    <section id="triage" aria-busy={loading}>
      <div
        className={dragging ? "dropzone dragging" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="kicker">Input</p>
        <h2>One file, one CI run.</h2>
        <p>
          Drag in several JUnit XML files, or browse for them. Commit, run id, and time are read from properties, then
          from the filename, then from file order.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => void loadDemo()} disabled={loading}>
            {loading ? "Loading demo data" : "Load demo data"}
          </button>
          <label className="file-button">
            Browse XML files
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              multiple
              onChange={(event) => {
                const list = event.target.files;
                if (list) void onFiles(list);
                event.target.value = "";
              }}
            />
          </label>
          {analysis ? (
            <button
              type="button"
              onClick={() => {
                setAnalysis(null);
                setErrors([]);
                setSourceLabel("");
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <p className="hint">The demo is a fictional shop called Marigold, generated from a fixed seed.</p>
      </div>

      {errors.length > 0 ? (
        <ul className="errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {analysis ? <Results analysis={analysis} sourceLabel={sourceLabel} /> : null}
    </section>
  );
}

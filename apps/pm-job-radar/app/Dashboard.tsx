"use client";
import { useState } from "react";
import type { Day, Item } from "@/lib/pipeline";

function copyText(t: string) { navigator.clipboard.writeText(t); }

function copyEmailHtml(body: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;color:#000000;font-family:Arial,sans-serif;font-size:14px">${
    esc(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1155cc">$1</a>').replace(/(\+91 ?\d{10}|\+91 \d{5} ?\d{5})/g, '<a href="tel:+918949473105" style="color:#1155cc">$1</a>').replace(/\n/g, "<br>")}</p>`).join("");
  const item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([body], { type: "text/plain" }) });
  navigator.clipboard.write([item]);
}

function Card({ it, date }: { it: Item; date: string }) {
  const [done, setDone] = useState(!!it.done);
  const { job, contacts, draft } = it;
  const toggle = async () => {
    const n = !done; setDone(n);
    await fetch("/api/done", { method: "POST", body: JSON.stringify({ date, id: job.id, done: n }) });
  };
  return (
    <div className={`card ${done ? "done" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><strong>{job.title}</strong> <span className="mut">at {job.company}</span></div>
        <label className="row"><input type="checkbox" checked={done} onChange={toggle} /> Done</label>
      </div>
      <div className="row" style={{ margin: "6px 0" }}>
        <span className="tag">{job.location}</span><span className="tag">{job.reason}</span><span className="tag">score {job.score}</span>
        {job.source && <span className="tag">via {job.source}</span>}
      </div>
      <div className="row">
        <a className="btn pri" href={job.applyLink} target="_blank" rel="noreferrer">Apply</a>
        <a className="btn" href={contacts.productSearch} target="_blank" rel="noreferrer">Find product people</a>
        <a className="btn" href={contacts.recruiterSearch} target="_blank" rel="noreferrer">Find recruiters</a>
      </div>
      {contacts.found.length > 0 && (
        <div style={{ marginTop: 8 }} className="mut">
          Emails found: {contacts.found.map((c) => `${c.name}${c.position ? ` (${c.position})` : ""} ${c.email}`).join("; ")}
        </div>
      )}
      {draft ? (
        <>
          <details><summary>Email draft</summary>
            <div className="mut">Subject: {draft.subject}</div><pre>{draft.email}</pre>
            <div className="row"><button onClick={() => copyEmailHtml(draft.email)}>Copy email (Gmail-ready)</button><button onClick={() => copyText(draft.subject)}>Copy subject</button></div>
          </details>
          <details><summary>LinkedIn DM</summary><pre>{draft.dm}</pre><button onClick={() => copyText(draft.dm)}>Copy DM</button></details>
        </>
      ) : <div className="mut" style={{ marginTop: 8 }}>Draft failed: {it.draftError}</div>}
    </div>
  );
}

export default function Dashboard({ date, days, day }: { date: string; days: string[]; day: Day | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/run", { method: "POST" }); const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) location.reload(); else setMsg(j.error || "Run failed");
  };
  return (
    <>
      <div className="top">
        <div className="row">
          <strong>{date}</strong>
          {days.filter((x) => x !== date).slice(0, 6).map((x) => <a key={x} href={`/?d=${x}`}>{x}</a>)}
        </div>
        <button className="pri" disabled={busy} onClick={run}>{busy ? "Finding jobs..." : "Run now"}</button>
      </div>
      {msg && <div className="card">{msg}</div>}
      {day?.items.length ? day.items.map((it) => <Card key={it.job.id} it={it} date={date} />)
        : <div className="card">No jobs for this day yet. Press "Run now", or wait for the daily run.</div>}
    </>
  );
}

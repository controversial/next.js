"use client";
import { useState } from "react";

// An input that writes ?q= on every keystroke, and a button that writes once.
// Both use the native History API, which Next documents as supported.
export default function UrlWriter({ value }) {
  const [q, setQ] = useState("");
  return (
    <main id="content">
      <p>value={String(value)}</p>
      <input
        id="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          history.replaceState(null, "", `?q=${encodeURIComponent(e.target.value)}`);
        }}
      />
      <button id="btn" onClick={() => history.replaceState(null, "", `?b=${Date.now()}`)}>
        write
      </button>
    </main>
  );
}

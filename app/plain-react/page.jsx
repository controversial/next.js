"use client";
import { Suspense, startTransition, use, useState } from "react";

// No Next API here. A fresh, already resolved promise on every render:
// harmless when the update is a transition, a 300 ms fallback when it is not.
function Child({ promise }) {
  const value = use(promise);
  return <main id="content">value={value}</main>;
}

export default function Page() {
  const [n, setN] = useState(0);
  return (
    <div>
      <button id="transition" onClick={() => startTransition(() => setN((x) => x + 1))}>
        update in a transition
      </button>
      <button id="ordinary" onClick={() => setN((x) => x + 1)}>
        ordinary update
      </button>
      <Suspense fallback={<p id="fallback">FALLBACK</p>}>
        <Child promise={Promise.resolve(n)} />
      </Suspense>
    </div>
  );
}

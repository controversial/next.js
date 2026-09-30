import { Suspense } from "react";

export default function Layout({ children }) {
  return (
    <div>
      <h1>layout</h1>
      <Suspense fallback={<p id="fallback">FALLBACK</p>}>{children}</Suspense>
    </div>
  );
}

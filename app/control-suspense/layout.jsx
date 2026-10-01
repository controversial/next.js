import { Suspense } from "react";

export default function Layout({ children }) {
  return <Suspense fallback={<p>loading</p>}>{children}</Suspense>;
}

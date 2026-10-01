import { cookies } from "next/headers";

// Reads request-time data with no <Suspense> above it, so the layout itself is the hole in the shell.
export default async function Layout({ children }) {
  await cookies();
  return <section>{children}</section>;
}

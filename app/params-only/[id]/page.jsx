import Link from "next/link";
import { notFound } from "next/navigation";

// `params` is the only thing awaited: no cookies(), headers() or connection(). Builds as ◐ (Partial Prerender).
export default async function Page({ params }) {
  const { id } = await params;
  if (id === "missing") notFound();
  return (
    <main>
      <h1>params {id}</h1>
      <Link href="/params-only/missing">/params-only/missing</Link>
    </main>
  );
}

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// The page you start on and the URL that redirects are the same dynamic route, and prefetch is off.
export default async function Page({ params }) {
  const { id } = await params;
  await cookies();
  if (id === "moved") redirect("/target");
  return (
    <main>
      <h1>item {id}</h1>
      <Link href="/same-route/moved" prefetch={false}>
        /same-route/moved
      </Link>
    </main>
  );
}

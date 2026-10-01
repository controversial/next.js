import Link from "next/link";

const links = [
  "/throws-redirect",
  "/throws-not-found",
  "/throws-error",
  "/blocking-layout/redirect-in-suspense",
  "/control-no-throw",
  "/control-suspense/redirect",
  "/control-loading/redirect",
];

export default function Home() {
  return (
    <main>
      <h1>home</h1>
      {links.map((href) => (
        <p key={href}>
          <Link href={href}>{href}</Link>
        </p>
      ))}
      <p>
        <Link href="/control-no-prefetch" prefetch={false}>
          /control-no-prefetch
        </Link>
      </p>
      <p>
        <a href="/same-route/1">/same-route/1 (full page load)</a>
      </p>
      <p>
        <a href="/params-only/1">/params-only/1 (full page load)</a>
      </p>
    </main>
  );
}

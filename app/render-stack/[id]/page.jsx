"use client";
import { use } from "react";

// For `next dev` only: records which React work loop each render runs under.
export default function Page({ params }) {
  if (typeof window !== "undefined") {
    const frames = new Error().stack
      .split("\n")
      .map((line) => line.trim().split(" ")[1])
      .filter((name) => /renderRoot|performWork|performSync|flushSync|workLoop/.test(name || ""));
    (window.__renders ||= []).push(
      `${Math.round(performance.now())} render, params.status=${params.status}, stack: ${frames.join(" < ")}`,
    );
  }
  const { id } = use(params);
  return <main id="content">id={id}</main>;
}

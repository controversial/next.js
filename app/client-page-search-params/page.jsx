"use client";
import { use } from "react";
import UrlWriter from "../_components/url-writer";

export default function Page({ searchParams }) {
  const { q } = use(searchParams);
  return <UrlWriter value={q} />;
}

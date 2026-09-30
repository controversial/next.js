"use client";
import { use } from "react";
import UrlWriter from "../../_components/url-writer";

export default function Client({ params }) {
  const { id } = use(params);
  return <UrlWriter value={id} />;
}

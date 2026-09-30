"use client";
import { useParams } from "next/navigation";
import UrlWriter from "../../_components/url-writer";

export default function Page() {
  const { id } = useParams();
  return <UrlWriter value={id} />;
}

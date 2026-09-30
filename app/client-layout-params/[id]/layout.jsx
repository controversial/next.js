"use client";
import { use } from "react";

export default function Layout({ children, params }) {
  const { id } = use(params);
  return <div data-id={id}>{children}</div>;
}

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function Page() {
  await cookies();
  notFound();
}

import { cookies } from "next/headers";

export default async function Page() {
  await cookies();
  throw new Error("boom");
}

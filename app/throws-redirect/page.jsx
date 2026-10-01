import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  await cookies();
  redirect("/target");
}

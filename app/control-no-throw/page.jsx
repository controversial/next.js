import { cookies } from "next/headers";

export default async function Page() {
  await cookies();
  return <h1>no throw</h1>;
}

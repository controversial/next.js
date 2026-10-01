import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function Gate() {
  await cookies();
  redirect("/target");
}

// The component that throws has a <Suspense> above it. The layout above the page does not.
export default function Page() {
  return (
    <Suspense fallback={<p>loading</p>}>
      <Gate />
    </Suspense>
  );
}

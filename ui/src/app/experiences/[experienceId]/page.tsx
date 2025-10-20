import { whopSdk } from "@/lib/whop-sdk";
import { headers } from "next/headers";
import ExperienceClient from "@/app/experiences/[experienceId]/ExperienceClient";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  // WHOP PART - Server-side data fetching
  const headersList = await headers();
  const { experienceId } = await params;
  const { userId } = await whopSdk.verifyUserToken(headersList);
  const result = await whopSdk.access.checkIfUserHasAccessToExperience({
    userId,
    experienceId,
  });
  const user = await whopSdk.users.getUser({ userId });
  const { accessLevel } = result;

  return (
    <div>
        <ExperienceClient
          user={user}
          accessLevel={accessLevel}
          experienceId={experienceId}
        />
    </div>
  );
}
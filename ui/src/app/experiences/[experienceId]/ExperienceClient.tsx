"use client";

import { useRouter } from "next/navigation";
import { useSetWhopUser } from "@/hooks/whop/useWhopUser";
import { useEffect } from "react";

interface ExperienceClientProps {
  user: unknown;
  accessLevel: "admin" | "customer" | "no_access";
  experienceId: string;
}

export default function ExperienceClient({
  user,
  accessLevel,
  experienceId,
}: ExperienceClientProps) {
  const router = useRouter();

  const isWhopUserSet = useSetWhopUser({
    user,
    accessLevel,
    experienceId,
  });

  useEffect(() => {
    if (isWhopUserSet && accessLevel === "admin") {
      router.replace("/perps");
    }
  }, [accessLevel, isWhopUserSet, router]);

  return <div>Callback Screen</div>;
}

"use client";

import { useUserStore } from "@/stores/UserStore";
import { useEffect } from "react";

interface WhopUserInitializerProps {
  user: unknown; // The user object from the server
  accessLevel: "admin" | "customer" | "no_access";
  experienceId: string;
}

export function useSetWhopUser({
  user,
  accessLevel,
  experienceId,
}: WhopUserInitializerProps) {
  const { setWhopUser, setAccessLevel, whopUser, setExperienceId } =
    useUserStore();

  useEffect(() => {
    // Set the access level
    setAccessLevel(accessLevel);
    setExperienceId(experienceId);

    // Type guard to check if user is valid and has required properties
    if (
      user &&
      typeof user === "object" &&
      user !== null &&
      "id" in user &&
      (!whopUser || whopUser.id !== (user as { id: unknown }).id)
    ) {
      setWhopUser(user as { [key: string]: unknown });
    }
  }, [
    user,
    accessLevel,
    experienceId,
    whopUser,
    setWhopUser,
    setAccessLevel,
    setExperienceId,
  ]);

  return true;
}
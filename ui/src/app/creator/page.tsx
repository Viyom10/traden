"use client";

import { PageLayout } from "@/components/layout/PageLayout";
import { CreatorDashboard } from "./components/CreatorDashboard";
import { useUserStore } from "@/stores/UserStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CreatorPage() {
  const accessLevel = useUserStore((s) => s.accessLevel);
  const router = useRouter();

  // Redirect non-admin users
  useEffect(() => {
    if (accessLevel !== null && accessLevel !== "admin") {
      router.push("/perps");
    }
  }, [accessLevel, router]);

  if (accessLevel !== "admin") {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400">
              You need admin access to view this page.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Creator Dashboard
          </h1>
          <p className="text-gray-400">
            Track your revenue and fee earnings from your experience.
          </p>
        </div>
        <CreatorDashboard />
      </div>
    </PageLayout>
  );
}

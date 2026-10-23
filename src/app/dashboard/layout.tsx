"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardLayout";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!workspace) {
        router.push("/onboarding");
      }
    }
  }, [user, workspace, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-600">
            Loading your business workspace...
          </span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null; // Will redirect to onboarding
  }

  return <DashboardShell>{children}</DashboardShell>;
}

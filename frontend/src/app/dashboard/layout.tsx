"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { usersApi, type UserProfile } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    } else if (user) {
      loadProfile();
    }
  }, [user, authLoading, router]);

  async function loadProfile() {
    try {
      const data = await usersApi.getMe();
      setProfile(data);
    } catch (err) {
      console.error("Dashboard layout load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-sf-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sf-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-sf-bg">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        {/* Trial Banner */}
        {profile?.plan === "trial" && (
          <div className="bg-sf-primary/10 border-b border-sf-primary/20 px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <p className="text-xs font-semibold text-sf-primary">
                Free Trial Active: {profile.trialDaysRemaining} days remaining. Upgrade to unlock all features!
              </p>
            </div>
            <button 
              onClick={() => router.push("/dashboard/billing")}
              className="px-3 py-1 bg-sf-primary text-white text-[10px] font-bold rounded hover:opacity-90 transition-opacity"
            >
              UPGRADE NOW
            </button>
          </div>
        )}

        {/* Global Nav / Header */}
        <header className="h-16 border-b border-sf-border flex items-center justify-between px-8 bg-sf-surface/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-sf-text-muted">Workspace</h2>
            <span className="text-sf-border">/</span>
             <span className="text-sm font-bold">Main Console</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 p-1.5 bg-sf-bg rounded-lg border border-sf-border px-3">
               <div className="w-2 h-2 rounded-full bg-sf-success" />
               <span className="text-[10px] font-bold uppercase tracking-wider text-sf-text-muted">System Live</span>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}

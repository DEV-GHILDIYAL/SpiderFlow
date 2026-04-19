"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dashboardApi, usersApi, type DashboardMetrics, type UserProfile } from "@/lib/api";
import TrialBanner from "@/components/TrialBanner";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      const [metricsData, profileData] = await Promise.all([
        dashboardApi.getMetrics(),
        usersApi.getMe()
      ]);
      setMetrics(metricsData);
      setProfile(profileData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setMetrics({
        totalSessions: 0,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        queuedJobs: 0,
        runningJobs: 0,
        totalPagesScraped: 0,
        totalItemsExtracted: 0,
        storageUsedMB: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const stats = [
    { label: "Total Sessions", value: metrics?.totalSessions ?? 0, icon: "🕷️", color: "#6366f1" },
    { label: "Running Jobs", value: metrics?.runningJobs ?? 0, icon: "🔄", color: "#60a5fa" },
    { label: "Completed Jobs", value: metrics?.completedJobs ?? 0, icon: "✅", color: "#34d399" },
    { label: "Failed Jobs", value: metrics?.failedJobs ?? 0, icon: "❌", color: "#f87171" },
    { label: "Pages Scraped", value: metrics?.totalPagesScraped ?? 0, icon: "📄", color: "#a78bfa" },
    { label: "Items Extracted", value: metrics?.totalItemsExtracted ?? 0, icon: "📦", color: "#fbbf24" },
    { label: "Queued Jobs", value: metrics?.queuedJobs ?? 0, icon: "⏳", color: "#fb923c" },
    { label: "Storage Used", value: `${metrics?.storageUsedMB ?? 0} MB`, icon: "💾", color: "#2dd4bf" },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem" }}>
          Overview of your scraping activity and resource usage.
        </p>
      </div>

      <TrialBanner />

      {/* Usage Overview */}
      {profile && (
        <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem", background: "var(--sf-surface-elevated)" }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
             <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Monthly Usage</h2>
             <span className="badge badge-primary">{profile.planName}</span>
           </div>
           
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  <span style={{ color: "var(--sf-text-muted)" }}>Jobs Used</span>
                  <span style={{ fontWeight: 600 }}>{profile.jobsUsedThisMonth} / {profile.jobLimit === 1000000 ? "∞" : profile.jobLimit}</span>
                </div>
                <div style={{ height: "8px", background: "var(--sf-border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ 
                    width: `${Math.min(100, (profile.jobsUsedThisMonth / (profile.jobLimit || 1)) * 100)}%`, 
                    height: "100%", 
                    backgroundColor: "var(--sf-primary)" 
                  }} />
                </div>
              </div>
              
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  <span style={{ color: "var(--sf-text-muted)" }}>Pages Scraped</span>
                  <span style={{ fontWeight: 600 }}>{profile.pagesScrapedThisMonth.toLocaleString()} / {profile.pageLimit === 1000000 ? "∞" : profile.pageLimit.toLocaleString()}</span>
                </div>
                <div style={{ height: "8px", background: "var(--sf-border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ 
                    width: `${Math.min(100, (profile.pagesScrapedThisMonth / (profile.pageLimit || 1)) * 100)}%`, 
                    height: "100%", 
                    backgroundColor: "#a78bfa" 
                  }} />
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.2rem" }}>{stat.icon}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--sf-text-muted)", fontWeight: 500 }}>
                {stat.label}
              </span>
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: stat.color }}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Quick Actions
        </h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href="/dashboard/sessions/new" className="btn-primary" style={{ textDecoration: "none" }}>
            + New Session
          </Link>
          <Link href="/dashboard/jobs" className="btn-secondary" style={{ textDecoration: "none" }}>
            View All Jobs
          </Link>
        </div>
      </div>
    </div>
  );
}

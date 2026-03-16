"use client";

import { useEffect, useState } from "react";
import { dashboardApi, type DashboardMetrics } from "@/lib/api";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics:", err);
      // Use placeholder data for demo
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
          <a href="/dashboard/sessions" className="btn-primary" style={{ textDecoration: "none" }}>
            + New Session
          </a>
          <a href="/dashboard/jobs" className="btn-secondary" style={{ textDecoration: "none" }}>
            View All Jobs
          </a>
        </div>
      </div>
    </div>
  );
}

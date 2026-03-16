"use client";

import { useEffect, useState } from "react";
import { sessionsApi, exportApi, type Session, type ExportFile } from "@/lib/api";

interface JobWithSession {
  sessionId: string;
  jobId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pagesScraped: number;
  itemsExtracted: number;
  errors: string[];
  sessionName?: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingJob, setDownloadingJob] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      // Load all sessions then aggregate their jobs
      const sessions = await sessionsApi.list();
      // For demo purposes, show a placeholder  
      // In production, you'd have a dedicated /jobs endpoint or paginated listing
      setJobs([]);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(sessionId: string, jobId: string) {
    setDownloadingJob(jobId);
    try {
      const result = await exportApi.getDownloadLinks(sessionId, jobId);
      // Open download links in new tabs
      result.files.forEach((file: ExportFile) => {
        window.open(file.url, "_blank");
      });
    } catch (err) {
      console.error("Failed to get download links:", err);
      alert("Failed to generate download links.");
    } finally {
      setDownloadingJob(null);
    }
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      queued: "badge-warning",
      running: "badge-info",
      completed: "badge-success",
      failed: "badge-danger",
    };
    return `badge ${map[status] || "badge-neutral"}`;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>Jobs</h1>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem" }}>
          Monitor running and completed scraping jobs.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: "3rem", textAlign: "center" }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚡</div>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>No jobs yet</h3>
          <p style={{ color: "var(--sf-text-muted)", marginBottom: "1.5rem" }}>
            Trigger a job from the Sessions page to start scraping.
          </p>
          <a href="/dashboard/sessions" className="btn-primary" style={{ textDecoration: "none" }}>
            Go to Sessions
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr",
              gap: "1rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--sf-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <span>Job ID</span>
            <span>Status</span>
            <span>Pages</span>
            <span>Items</span>
            <span>Created</span>
            <span>Actions</span>
          </div>

          {jobs.map((job) => (
            <div
              key={job.jobId}
              className="glass-card"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr",
                gap: "1rem",
                padding: "1rem 1.25rem",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.85rem" }}>
                  {job.jobId.slice(0, 8)}...
                </span>
                {job.sessionName && (
                  <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: "0.2rem" }}>
                    {job.sessionName}
                  </div>
                )}
              </div>
              <span className={getStatusBadge(job.status)}>{job.status}</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {job.pagesScraped.toLocaleString()}
              </span>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {job.itemsExtracted.toLocaleString()}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--sf-text-muted)" }}>
                {new Date(job.createdAt).toLocaleDateString()}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {job.status === "completed" && (
                  <button
                    className="btn-primary"
                    style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}
                    onClick={() => handleDownload(job.sessionId, job.jobId)}
                    disabled={downloadingJob === job.jobId}
                  >
                    {downloadingJob === job.jobId ? "..." : "⬇ Download"}
                  </button>
                )}
                {job.status === "running" && (
                  <span className="pulse-glow badge badge-info">Live</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

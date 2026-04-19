"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionsApi, jobsApi, type Session } from "@/lib/api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await sessionsApi.list();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(sessionId: string) {
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await sessionsApi.delete(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  async function handleTriggerJob(sessionId: string) {
    try {
      await jobsApi.trigger(sessionId);
      alert("Job triggered successfully! Check the Jobs page for status.");
    } catch (err) {
      console.error("Failed to trigger job:", err);
      alert("Failed to trigger job.");
    }
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      created: "badge-neutral",
      active: "badge-success",
      paused: "badge-warning",
      failed: "badge-danger",
      running: "badge-info",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>Sessions</h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem" }}>
            Configure and manage your scraping sessions.
          </p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/dashboard/sessions/new")}>
          + New Session
        </button>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3.5rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "1.5rem", opacity: 0.8 }}>🕷️</div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>No sessions yet</h3>
          <p style={{ color: "var(--sf-text-muted)", marginBottom: "2rem", maxWidth: "400px" }}>
            Create your first scraping session to configure target websites and data extraction rules.
          </p>
          <button className="btn-primary" onClick={() => router.push("/dashboard/sessions/new")}>
            + Create Session
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="glass-card"
              style={{ padding: "1.25rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{session.name}</h3>
                    <span className={getStatusBadge(session.status)}>{session.status}</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--sf-text-muted)", marginBottom: "0.5rem" }}>
                    {session.targetUrl || "No target URL configured"}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>
                    Created: {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn-primary"
                    style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}
                    onClick={() => handleTriggerJob(session.sessionId)}
                  >
                    ▶ Run
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", opacity: 0.6, cursor: "not-allowed" }}
                    onClick={() => alert("Edit session feature is coming soon!")}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger"
                    style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}
                    onClick={() => handleDelete(session.sessionId)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



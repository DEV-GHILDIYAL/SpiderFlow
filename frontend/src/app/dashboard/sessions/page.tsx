"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionsApi, jobsApi, type Session } from "@/lib/api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
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
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Session
        </button>
      </div>

      {/* Create Session Modal */}
      {showCreate && (
        <CreateSessionForm
          onClose={() => setShowCreate(false)}
          onCreated={(session) => {
            setSessions((prev) => [session, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

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
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
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
                    style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}
                    onClick={() => router.push(`/dashboard/sessions/${session.sessionId}`)}
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

// ── Create Session Form ──

function CreateSessionForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (session: Session) => void;
}) {
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectors, setSelectors] = useState("");
  const [paginationSelector, setPaginationSelector] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const selectorMap: Record<string, string> = {};
      if (selectors.trim()) {
        selectors.split("\n").forEach((line) => {
          const [key, ...rest] = line.split("=");
          if (key && rest.length) {
            selectorMap[key.trim()] = rest.join("=").trim();
          }
        });
      }

      const session = await sessionsApi.create({
        name,
        targetUrl,
        selectors: selectorMap,
        pagination: paginationSelector
          ? { selector: paginationSelector, max_pages: parseInt(maxPages) || 50 }
          : {},
      });
      onCreated(session);
    } catch (err) {
      console.error("Failed to create session:", err);
      alert("Failed to create session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-header">
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--sf-text)" }}>
              New Scraping Session
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--sf-text-muted)", marginTop: "0.2rem" }}>Configure your spider's target and rules.</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--sf-text-muted)", cursor: "pointer", fontSize: "1.5rem", padding: "0.2rem" }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Section: Basic Info */}
          <div className="form-section">
            <h3 className="form-section-title">Identify</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Session Name
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. E-commerce Product Scraper"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Target URL
                </label>
                <input
                  className="input-field"
                  type="url"
                  placeholder="https://example.com/shop"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section: Extraction Rules */}
          <div className="form-section">
            <h3 className="form-section-title">Extraction Rules</h3>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                CSS Selectors <span style={{ fontWeight: 400, color: "var(--sf-text-muted)" }}>(field=selector)</span>
              </label>
              <textarea
                className="input-field"
                placeholder={"title=h1.product-title\nprice=.current-price\nimage=img.main-image::attr(src)"}
                value={selectors}
                onChange={(e) => setSelectors(e.target.value)}
                rows={5}
                style={{ resize: "vertical", fontFamily: "var(--font-geist-mono)", fontSize: "0.85rem" }}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: "0.5rem" }}>
                Add one rule per line. Use `::text` for content or `::attr(name)` for attributes.
              </p>
            </div>
          </div>

          {/* Section: Navigation */}
          <div className="form-section">
            <h3 className="form-section-title">Navigation</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Next Page Selector (optional)
                </label>
                <input
                  className="input-field"
                  placeholder="li.next > a"
                  value={paginationSelector}
                  onChange={(e) => setPaginationSelector(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Max Pages
                </label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  max={1000}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="form-footer">
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: "0.6rem 1.25rem" }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: "0.6rem 2rem" }}>
              {submitting ? "Deploying Spider..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

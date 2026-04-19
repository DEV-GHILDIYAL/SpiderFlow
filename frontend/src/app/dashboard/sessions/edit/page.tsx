"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sessionsApi } from "@/lib/api";

function EditSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectors, setSelectors] = useState("");
  const [paginationSelector, setPaginationSelector] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      router.push("/dashboard/sessions");
      return;
    }

    async function loadSession() {
      try {
        const session = await sessionsApi.get(id as string);
        setName(session.name);
        setTargetUrl(session.targetUrl);
        
        // Convert selector map back to string
        const selectorStr = Object.entries(session.selectors)
          .map(([key, val]) => `${key}=${val}`)
          .join("\n");
        setSelectors(selectorStr);
        
        if (session.pagination) {
          setPaginationSelector((session.pagination.selector as string) || "");
          setMaxPages(String(session.pagination.max_pages || "50"));
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        alert("Failed to load session data.");
        router.push("/dashboard/sessions");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
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

      await sessionsApi.update(id, {
        name,
        targetUrl,
        selectors: selectorMap,
        pagination: paginationSelector
          ? { selector: paginationSelector, max_pages: parseInt(maxPages) || 50 }
          : {},
      });
      router.push("/dashboard/sessions");
    } catch (err) {
      console.error("Failed to update session:", err);
      alert("Failed to update session.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={() => router.push("/dashboard/sessions")}
          className="btn-secondary"
          style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
        >
          &larr; Back
        </button>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--sf-text)" }}>
            Edit Scraping Session
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem", marginTop: "0.2rem" }}>
            Update your spider's configuration.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "0", overflow: "hidden", background: "var(--sf-surface)" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
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
          <div className="form-footer" style={{ borderTop: "none", padding: "1.5rem", background: "var(--sf-surface-elevated)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" className="btn-secondary" onClick={() => router.push("/dashboard/sessions")} style={{ padding: "0.6rem 1.25rem" }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: "0.6rem 2rem" }}>
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditSessionPage() {
  return (
    <Suspense fallback={
       <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    }>
      <EditSessionForm />
    </Suspense>
  );
}

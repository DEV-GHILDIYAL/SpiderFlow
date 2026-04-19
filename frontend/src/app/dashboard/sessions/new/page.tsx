"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sessionsApi } from "@/lib/api";

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectors, setSelectors] = useState("");
  const [paginationSelector, setPaginationSelector] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [scrapingProvider, setScrapingProvider] = useState("internal");
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

      await sessionsApi.create({
        name,
        targetUrl,
        selectors: selectorMap,
        pagination: paginationSelector
          ? { selector: paginationSelector, max_pages: parseInt(maxPages) || 50 }
          : {},
        scraping_provider: scrapingProvider,
      });
      router.push("/dashboard/sessions");
    } catch (err) {
      console.error("Failed to create session:", err);
      alert("Failed to create session.");
      setSubmitting(false);
    }
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
            New Scraping Session
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem", marginTop: "0.2rem" }}>
            Configure your spider's target and extraction rules.
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
              <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: "0.5rem" }}>
                Add one rule per line. Use `::text` for content or `::attr(name)` for attributes.
              </p>
            </div>
          </div>

          {/* Section: Advanced Configuration */}
          <div className="form-section">
            <h3 className="form-section-title">Advanced Configuration</h3>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Scraping Provider
              </label>
              <select
                className="input-field"
                value={scrapingProvider}
                onChange={(e) => setScrapingProvider(e.target.value)}
                style={{ appearance: "auto", paddingRight: "2rem" }}
              >
                <option value="internal">Internal (Free, best for simple sites)</option>
                <option value="scrapingbee">ScrapingBee (Best for JavaScript / Premium Proxies)</option>
                <option value="scraperapi">ScraperAPI (High speed / Reliability)</option>
                <option value="brightdata">BrightData (Residential Proxies)</option>
              </select>
              <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: "0.5rem" }}>
                External providers handle bot-protected and highly dynamic websites better.
              </p>
            </div>
          </div>
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
              {submitting ? "Deploying Spider..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

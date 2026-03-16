"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)",
      }}
    >
      {/* Hero */}
      <div className="animate-fadeIn" style={{ maxWidth: 680 }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--sf-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "1rem",
          }}
        >
          Cloud Web Scraping Platform
        </div>
        <h1
          className="gradient-text"
          style={{
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "1.2rem",
          }}
        >
          Extract data at scale with SpiderFlow
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--sf-text-muted)",
            lineHeight: 1.6,
            marginBottom: "2.5rem",
          }}
        >
          Configure powerful scrapers, schedule jobs, and export structured data
          — all from a beautiful dashboard. Powered by Scrapy, Playwright, and
          AWS serverless infrastructure.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          {user ? (
            <button
              className="btn-primary"
              onClick={() => router.push("/dashboard")}
              style={{ fontSize: "1rem", padding: "0.85rem 2.2rem" }}
            >
              Go to Dashboard →
            </button>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={() => router.push("/auth")}
                style={{ fontSize: "1rem", padding: "0.85rem 2.2rem" }}
              >
                Get Started
              </button>
              <button
                className="btn-secondary"
                onClick={() => router.push("/auth")}
                style={{ fontSize: "1rem", padding: "0.85rem 2.2rem" }}
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div
        className="animate-fadeIn"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          maxWidth: 780,
          width: "100%",
          marginTop: "4rem",
        }}
      >
        {[
          {
            icon: "🕷️",
            title: "Dynamic Scraping",
            desc: "Playwright renders JavaScript-heavy sites. Extract data from any page.",
          },
          {
            icon: "⚡",
            title: "Serverless Scale",
            desc: "ECS Fargate workers auto-scale to handle thousands of pages in parallel.",
          },
          {
            icon: "📊",
            title: "Real-time Metrics",
            desc: "Monitor jobs, track pages scraped, and get instant failure alerts.",
          },
        ].map((f) => (
          <div key={f.title} className="glass-card" style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>
              {f.icon}
            </div>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--sf-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

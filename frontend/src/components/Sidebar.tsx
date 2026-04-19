"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/sessions", label: "Sessions", icon: "🕷️" },
  { href: "/dashboard/jobs", label: "Jobs", icon: "⚡" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div
        style={{
          padding: "0 1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          className="gradient-text"
          style={{ fontSize: "1.4rem", fontWeight: 800 }}
        >
          SpiderFlow
        </h2>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--sf-text-muted)",
            marginTop: "0.25rem",
          }}
        >
          Cloud Scraping Platform
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${
              pathname === item.href ? "active" : ""
            }`}
          >
            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div
        style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid var(--sf-border-subtle)",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--sf-text-muted)",
            marginBottom: "0.75rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.username || user?.email || "User"}
        </div>
        <button
          className="btn-secondary"
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            try {
              await logout();
              // No need to push, layout's useEffect will catch the null user and redirect
            } catch (err) {
              console.error("Sign out failed:", err);
              router.push("/"); // Force redirect as fallback
            } finally {
              setLoggingOut(false);
            }
          }}
          style={{ width: "100%", padding: "0.5rem", fontSize: "0.8rem", opacity: loggingOut ? 0.6 : 1 }}
        >
          {loggingOut ? "Signing Out..." : "Sign Out"}
        </button>
      </div>
    </aside>
  );
}

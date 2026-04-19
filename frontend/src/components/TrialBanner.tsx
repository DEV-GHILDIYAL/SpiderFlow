"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usersApi, type UserProfile } from "@/lib/api";

export default function TrialBanner() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await usersApi.getMe();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load trial profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading || !profile) return null;

  // Only show for trial plan
  if (profile.plan !== "trial") return null;

  const isExpired = profile.isTrialExpired;

  return (
    <div
      style={{
        width: "100%",
        padding: "0.75rem 1.5rem",
        backgroundColor: isExpired ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
        border: `1px solid ${isExpired ? "#ef4444" : "#3b82f6"}`,
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1.5rem",
        animation: "slideDown 0.4s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1.2rem" }}>
          {isExpired ? "🚫" : "⏳"}
        </span>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: isExpired ? "#ef4444" : "#3b82f6" }}>
          {isExpired 
            ? "Your free trial has expired. Access to scraping jobs is limited." 
            : `${profile.trialDaysRemaining} days left in your free trial. Upgrade to keep full access.`}
        </span>
      </div>
      <Link 
        href="/dashboard/billing" 
        style={{
          backgroundColor: isExpired ? "#ef4444" : "#3b82f6",
          color: "white",
          padding: "0.4rem 1rem",
          borderRadius: "8px",
          fontSize: "0.85rem",
          fontWeight: 700,
          textDecoration: "none",
          transition: "transform 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        Upgrade Now
      </Link>
    </div>
  );
}

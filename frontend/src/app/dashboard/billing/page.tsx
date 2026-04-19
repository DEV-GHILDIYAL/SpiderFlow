"use client";

import { useEffect, useState } from "react";
import { usersApi, type UserProfile } from "@/lib/api";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    features: [
      "100 jobs / month",
      "5,000 pages / month",
      "Scheduled scraping",
      "Email support"
    ],
    accent: "#6366f1"
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    features: [
      "1,000 jobs / month",
      "50,000 pages / month",
      "Scheduled scraping",
      "Priority support",
      "External Scraping APIs"
    ],
    accent: "#a78bfa",
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$299",
    features: [
      "Unlimited jobs & pages",
      "Custom scraping providers",
      "Dedicated support",
      "SLA guarantee"
    ],
    accent: "#f43f5e"
  }
];

export default function BillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await usersApi.getMe();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load billing profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Plans & Billing
        </h1>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.95rem" }}>
          Choose the right plan for your scraping needs. No hidden fees.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
        {PLANS.map((plan) => {
          const isCurrent = profile?.plan === plan.id;
          const isTrial = profile?.plan === "trial" && plan.id === "starter"; // Suggest upgrade from trial to starter

          return (
            <div
              key={plan.id}
              className="glass-card"
              style={{
                padding: "2rem",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                border: isCurrent ? `2px solid ${plan.accent}` : "1px solid var(--sf-border-subtle)",
                boxShadow: isCurrent ? `0 10px 30px -10px ${plan.accent}44` : "none",
              }}
            >
              {plan.popular && (
                <div style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: plan.accent,
                  color: "white",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase"
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: plan.accent, marginBottom: "0.25rem" }}>
                  {plan.name}
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900 }}>{plan.price}</span>
                  <span style={{ color: "var(--sf-text-muted)", fontSize: "0.9rem" }}>/month</span>
                </div>
              </div>

              {isCurrent && (
                <div style={{ 
                  backgroundColor: "rgba(52, 211, 153, 0.1)", 
                  color: "#10b981", 
                  padding: "1rem", 
                  borderRadius: "10px", 
                  marginBottom: "1.5rem",
                  fontSize: "0.85rem",
                  border: "1px solid rgba(52, 211, 153, 0.2)"
                }}>
                  <div style={{ fontWeight: 800, marginBottom: "0.5rem" }}>Your Current Plan</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span>Jobs Used</span>
                    <span>{profile.jobsUsedThisMonth} / {profile.jobLimit === 1000000 ? "∞" : profile.jobLimit}</span>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "rgba(52, 211, 153, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${Math.min(100, (profile.jobsUsedThisMonth / (profile.jobLimit || 1)) * 100)}%`, 
                      height: "100%", 
                      backgroundColor: "#10b981" 
                    }} />
                  </div>
                </div>
              )}

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem 0", flex: 1 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                    <span style={{ color: "#10b981" }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.id === "enterprise" ? (
                <a
                  href="mailto:sales@spiderflow.com?subject=Enterprise Plan Inquiry"
                  className="btn-secondary"
                  style={{ textAlign: "center", textDecoration: "none", padding: "0.8rem" }}
                >
                  Contact Sales
                </a>
              ) : (
                <button
                  className={isCurrent ? "btn-secondary" : "btn-primary"}
                  disabled={isCurrent}
                  style={{ padding: "0.8rem", cursor: isCurrent ? "default" : "pointer" }}
                >
                  {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-card" style={{ marginTop: "3rem", padding: "2rem", textAlign: "center" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Need a custom solution?
        </h3>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem", maxWidth: "600px", margin: "0 auto 1.5rem" }}>
          If none of our standard plans fit your specific scraping volume or architecture requirements, 
          our team can build a custom integration for you.
        </p>
        <a href="mailto:support@spiderflow.com" style={{ color: "var(--sf-primary)", fontWeight: 700, textDecoration: "none" }}>
          Talk to an Expert →
        </a>
      </div>
    </div>
  );
}

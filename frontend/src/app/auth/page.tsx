"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register" | "confirm";

export default function AuthPage() {
  const { login, register, confirmRegistration, error, clearError } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
        router.push("/dashboard");
      } else if (mode === "register") {
        await register(email, password, name);
        setMode("confirm");
      } else if (mode === "confirm") {
        await confirmRegistration(email, confirmCode);
        await login(email, password);
        router.push("/dashboard");
      }
    } catch {
      // Error is handled by the context
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.1) 0%, transparent 60%)",
      }}
    >
      <div
        className="glass-card animate-fadeIn"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2.5rem",
        }}
      >
        <h1
          className="gradient-text"
          style={{
            fontSize: "1.8rem",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "0.5rem",
          }}
        >
          SpiderFlow
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "var(--sf-text-muted)",
            fontSize: "0.9rem",
            marginBottom: "2rem",
          }}
        >
          {mode === "login"
            ? "Sign in to your account"
            : mode === "register"
            ? "Create a new account"
            : "Verify your email"}
        </p>

        {error && (
          <div
            style={{
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: 10,
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              color: "var(--sf-danger)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {mode === "register" && (
            <input
              className="input-field"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          {mode !== "confirm" && (
            <>
              <input
                className="input-field"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="input-field"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </>
          )}

          {mode === "confirm" && (
            <input
              className="input-field"
              type="text"
              placeholder="Verification code"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              required
            />
          )}

          <button className="btn-primary" disabled={loading} type="submit" style={{ width: "100%" }}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Processing...
              </span>
            ) : mode === "login" ? (
              "Sign In"
            ) : mode === "register" ? (
              "Create Account"
            ) : (
              "Verify & Sign In"
            )}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.85rem",
            color: "var(--sf-text-muted)",
          }}
        >
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("register");
                  clearError();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sf-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Sign Up
              </button>
            </>
          ) : mode === "register" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  clearError();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sf-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Sign In
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

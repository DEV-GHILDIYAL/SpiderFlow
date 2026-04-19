"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register" | "confirm" | "forgot-password" | "reset-password";

export default function AuthPage() {
  const { login, register, confirmRegistration, forgotPassword, submitForgotPassword, error, clearError } = useAuth();
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
      } else if (mode === "forgot-password") {
        await forgotPassword(email);
        setMode("reset-password");
      } else if (mode === "reset-password") {
        await submitForgotPassword(email, confirmCode, password);
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
        background: "var(--sf-bg)",
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
          style={{
            fontSize: "1.8rem",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "0.5rem",
            color: "var(--sf-accent)"
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
            : mode === "forgot-password"
            ? "Reset your password"
            : mode === "reset-password"
            ? "Create new password"
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

          {(mode === "login" || mode === "register" || mode === "forgot-password") && (
            <input
              className="input-field"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}

          {(mode === "login" || mode === "register" || mode === "reset-password") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <input
                className="input-field"
                type="password"
                placeholder={mode === "reset-password" ? "New Password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot-password");
                    clearError();
                  }}
                  style={{
                    alignSelf: "flex-end",
                    background: "none",
                    border: "none",
                    color: "var(--sf-accent)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {(mode === "confirm" || mode === "reset-password") && (
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
            ) : mode === "forgot-password" ? (
              "Send Reset Code"
            ) : mode === "reset-password" ? (
              "Reset Password & Sign In"
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
              <span
                onClick={() => {
                  setMode("register");
                  clearError();
                }}
                style={{
                  color: "var(--sf-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginLeft: "0.25rem"
                }}
              >
                Sign Up
              </span>
            </>
          ) : mode === "register" ? (
            <>
              Already have an account?{" "}
              <span
                onClick={() => {
                  setMode("login");
                  clearError();
                }}
                style={{
                  color: "var(--sf-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginLeft: "0.25rem"
                }}
              >
                Sign In
              </span>
            </>
          ) : (mode === "forgot-password" || mode === "reset-password") ? (
            <>
              Remember your password?{" "}
              <span
                onClick={() => {
                  setMode("login");
                  clearError();
                }}
                style={{
                  color: "var(--sf-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginLeft: "0.25rem"
                }}
              >
                Back to Sign In
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

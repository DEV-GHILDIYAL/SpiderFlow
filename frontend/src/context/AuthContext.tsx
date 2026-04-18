"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  type SignInInput,
  type SignUpInput,
} from "aws-amplify/auth";

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  submitForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const cognitoUser = await getCurrentUser();
      setUser({
        userId: cognitoUser.userId,
        username: cognitoUser.username,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    setError(null);
    try {
      await signIn({ username: email, password } as SignInInput);
      await checkAuth();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    }
  }

  async function register(email: string, password: string, name: string) {
    setError(null);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email, name } },
      } as SignUpInput);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
      throw err;
    }
  }

  async function confirmRegistration(email: string, code: string) {
    setError(null);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Confirmation failed";
      setError(message);
      throw err;
    }
  }

  async function forgotPassword(email: string) {
    setError(null);
    try {
      await resetPassword({ username: email });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Password reset request failed";
      setError(message);
      throw err;
    }
  }

  async function submitForgotPassword(email: string, code: string, newPassword: string) {
    setError(null);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Password reset confirmation failed";
      setError(message);
      throw err;
    }
  }

  async function logout() {
    await signOut();
    setUser(null);
  }

  function clearError() {
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        confirmRegistration,
        forgotPassword,
        submitForgotPassword,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

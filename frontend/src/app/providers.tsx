"use client";

import { AuthProvider } from "@/context/AuthContext";
import "@/lib/amplify-config";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

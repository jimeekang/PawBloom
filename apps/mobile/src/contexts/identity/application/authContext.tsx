import { createContext, useContext, type ReactNode } from "react";
import type { AppAuthState } from "./authContextTypes";
import { useAuthState } from "./authContextState";

const AuthContext = createContext<AppAuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

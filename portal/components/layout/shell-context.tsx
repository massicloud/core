"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ShellContextValue {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ShellContext.Provider value={{ mobileNavOpen, setMobileNavOpen }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) {
    throw new Error("useShell must be used within a ShellProvider");
  }

  return value;
}


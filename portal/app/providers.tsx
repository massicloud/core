"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "sonner";
import { getQueryClient } from "@/lib/query-client";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors closeButton theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}


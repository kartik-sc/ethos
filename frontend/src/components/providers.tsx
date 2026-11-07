"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferences } from "@/stores/preferences";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } }),
  );
  const syncFromDocument = usePreferences((state) => state.syncFromDocument);

  useEffect(() => syncFromDocument(), [syncFromDocument]);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

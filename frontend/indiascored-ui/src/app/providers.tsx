import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/shared/ui/toaster";
import { Toaster as SonnerToaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Credit data changes on human timescales, so refetching on every
      // window focus is noise. One minute of staleness is fine.
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Everything the whole app sits inside: data fetching, tooltips, toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
        <SonnerToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

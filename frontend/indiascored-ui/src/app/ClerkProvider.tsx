import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

import { CLERK_PUBLISHABLE_KEY, DemoAuthProvider, IS_DEMO_AUTH } from "@/lib/auth";

/**
 * Clerk, wired to the router so its redirects go through react-router
 * rather than a full page load. Falls back to a local demo auth provider
 * when no publishable key is configured, so the app runs without Clerk.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  if (IS_DEMO_AUTH) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY!}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

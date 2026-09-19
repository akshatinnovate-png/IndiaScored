import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/**
 * Clerk, wired to the router so its redirects go through react-router
 * rather than a full page load.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  if (!PUBLISHABLE_KEY) {
    // Failing loudly here beats a blank screen and an opaque Clerk error.
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">Configuration missing</h1>
          <p className="mt-2 text-sm text-slate-600">
            <code className="rounded bg-slate-100 px-1">VITE_CLERK_PUBLISHABLE_KEY</code> is not
            set. Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{" "}
            <code className="rounded bg-slate-100 px-1">.env</code>, add your Clerk key and restart
            the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

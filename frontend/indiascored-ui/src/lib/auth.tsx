/* eslint-disable react-refresh/only-export-components -- an auth facade: hooks and components together by design */
/**
 * Auth shim: re-exports the real Clerk primitives when a publishable key is
 * configured, or a minimal mock auth (one fixed local "demo user", no
 * server, no sign-up flow) when it isn't. Every feature imports auth from
 * here instead of "@clerk/clerk-react" directly, so the app runs end to end
 * with zero third-party auth setup.
 *
 * The mode is fixed at build time, so each export is bound once, at module
 * load, to one implementation — no hook is ever called conditionally.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/clerk-react";

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export const IS_DEMO_AUTH = !CLERK_PUBLISHABLE_KEY;

const DEMO_STORAGE_KEY = "indiascored_demo_user_id";
const DEMO_SESSION_KEY = "indiascored_demo_signed_in";

function storedDemoId(): string | null {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The demo id, if a session is open. Signing out keeps the id, so the same
 * browser gets its own applications back on the next sign-in. */
function signedInDemoId(): string | null {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY) ? storedDemoId() : null;
  } catch {
    return null;
  }
}

function ensureDemoId(): string {
  let id = storedDemoId();
  if (!id) {
    id = `demo-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, id);
    } catch {
      // Blocked storage: the id lives for this page load only.
    }
  }
  try {
    localStorage.setItem(DEMO_SESSION_KEY, "1");
  } catch {
    // As above.
  }
  return id;
}

interface DemoUser {
  id: string;
  fullName: string;
  primaryEmailAddress: { emailAddress: string };
}

interface DemoAuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: DemoUser | null;
  signIn: () => void;
  signOut: () => void;
}

const DemoAuthContext = createContext<DemoAuthState | null>(null);

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(signedInDemoId);

  const signIn = useCallback(() => setUserId(ensureDemoId()), []);
  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // Nothing stored to remove.
    }
    setUserId(null);
  }, []);

  const value = useMemo<DemoAuthState>(
    () => ({
      isLoaded: true,
      isSignedIn: userId !== null,
      user: userId
        ? { id: userId, fullName: "Demo User", primaryEmailAddress: { emailAddress: "demo@indiascored.local" } }
        : null,
      signIn,
      signOut,
    }),
    [userId, signIn, signOut],
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

function useDemoAuthState(): DemoAuthState {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) throw new Error("Demo auth used outside DemoAuthProvider — check AuthProvider wiring.");
  return ctx;
}

// --- Demo implementations ------------------------------------------------

function useDemoUser() {
  const { isLoaded, user } = useDemoAuthState();
  return { isLoaded, isSignedIn: !!user, user };
}

function useDemoAuth() {
  const { isLoaded, isSignedIn, user, signOut } = useDemoAuthState();
  return { isLoaded, isSignedIn, userId: user?.id ?? null, signOut };
}

function DemoSignedIn({ children }: { children: ReactNode }) {
  return useDemoAuthState().isSignedIn ? <>{children}</> : null;
}

function DemoSignedOut({ children }: { children: ReactNode }) {
  return useDemoAuthState().isSignedIn ? null : <>{children}</>;
}

function DemoUserButton({ afterSignOutUrl = "/" }: { afterSignOutUrl?: string }) {
  const { signOut } = useDemoAuthState();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        signOut();
        navigate(afterSignOutUrl);
      }}
      className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
      title="Demo mode — click to sign out"
    >
      Demo User ⏻
    </button>
  );
}

function useDemoSignInAction(): () => void {
  return useDemoAuthState().signIn;
}

const noop = () => {};
function useNoDemoSignIn(): () => void {
  return noop;
}

// --- Public API, bound once to the active mode ----------------------------

export const useUser = (IS_DEMO_AUTH ? useDemoUser : useClerkUser) as typeof useDemoUser;
export const useAuth = (IS_DEMO_AUTH ? useDemoAuth : useClerkAuth) as typeof useDemoAuth;
export const SignedIn = IS_DEMO_AUTH ? DemoSignedIn : ClerkSignedIn;
export const SignedOut = IS_DEMO_AUTH ? DemoSignedOut : ClerkSignedOut;
export const UserButton = (IS_DEMO_AUTH ? DemoUserButton : ClerkUserButton) as typeof DemoUserButton;
/** Demo mode only: sign the local demo session in. A no-op with real Clerk. */
export const useDemoSignIn = IS_DEMO_AUTH ? useDemoSignInAction : useNoDemoSignIn;

/** Demo-mode stand-in for Clerk's <SignIn>/<SignUp>: one button, no form. */
export function DemoSignInCard({ title, afterAuthUrl }: { title: string; afterAuthUrl: string }) {
  const { signIn } = useDemoAuthState();
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">
        This build runs in demo mode: one local account, no real authentication. Click below to
        continue as a demo applicant.
      </p>
      <button
        type="button"
        onClick={() => {
          signIn();
          navigate(afterAuthUrl);
        }}
        className="mt-6 w-full rounded-lg bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600"
      >
        Continue as Demo User
      </button>
    </div>
  );
}

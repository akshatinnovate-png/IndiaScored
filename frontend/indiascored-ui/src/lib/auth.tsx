/**
 * Auth shim: re-exports the real Clerk primitives when a publishable key is
 * configured, or a minimal mock auth (one fixed local "demo user", no
 * server, no sign-up flow) when it isn't. Every feature imports auth from
 * here instead of "@clerk/clerk-react" directly, so the app runs end to end
 * with zero third-party auth setup.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

export const IS_DEMO_AUTH = !CLERK_PUBLISHABLE_KEY;

const DEMO_STORAGE_KEY = "indiascored_demo_user_id";

function demoUserId(): string {
  let id = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!id) {
    id = `demo-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEMO_STORAGE_KEY, id);
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
  const [isSignedIn, setIsSignedIn] = useState(() => localStorage.getItem(DEMO_STORAGE_KEY) !== null);

  const signIn = useCallback(() => {
    demoUserId();
    setIsSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setIsSignedIn(false);
  }, []);

  const user = useMemo<DemoUser | null>(() => {
    if (!isSignedIn) return null;
    const id = demoUserId();
    return { id, fullName: "Demo User", primaryEmailAddress: { emailAddress: "demo@indiascored.local" } };
  }, [isSignedIn]);

  const value = useMemo<DemoAuthState>(
    () => ({ isLoaded: true, isSignedIn, user, signIn, signOut }),
    [isSignedIn, user, signIn, signOut],
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

function useDemoAuthState(): DemoAuthState {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) {
    throw new Error("Demo auth used outside DemoAuthProvider — check AuthProvider wiring.");
  }
  return ctx;
}

// --- Public hooks/components, switching on IS_DEMO_AUTH ------------------

export function useUser() {
  if (IS_DEMO_AUTH) {
    const { isLoaded, user } = useDemoAuthState();
    return { isLoaded, isSignedIn: !!user, user };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkUser();
}

export function useAuth() {
  if (IS_DEMO_AUTH) {
    const { isLoaded, isSignedIn, user, signOut } = useDemoAuthState();
    return { isLoaded, isSignedIn, userId: user?.id ?? null, signOut };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkAuth();
}

export function SignedIn({ children }: { children: ReactNode }) {
  if (IS_DEMO_AUTH) {
    const { isSignedIn } = useDemoAuthState();
    return isSignedIn ? <>{children}</> : null;
  }
  const Clerk = clerkComponents();
  return <Clerk.SignedIn>{children}</Clerk.SignedIn>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  if (IS_DEMO_AUTH) {
    const { isSignedIn } = useDemoAuthState();
    return !isSignedIn ? <>{children}</> : null;
  }
  const Clerk = clerkComponents();
  return <Clerk.SignedOut>{children}</Clerk.SignedOut>;
}

export function UserButton({ afterSignOutUrl = "/" }: { afterSignOutUrl?: string }) {
  if (IS_DEMO_AUTH) {
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
  const Clerk = clerkComponents();
  return <Clerk.UserButton afterSignOutUrl={afterSignOutUrl} />;
}

/** Demo-mode stand-in for Clerk's <SignIn>/<SignUp>: one button, no form. */
export function DemoSignInCard({
  title,
  afterAuthUrl,
}: {
  title: string;
  afterAuthUrl: string;
}) {
  const { signIn } = useDemoAuthState();
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">
        No Clerk key is configured, so this build runs in demo mode: one local account, no
        real authentication. Click below to continue as a demo applicant.
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

// --- Lazy indirection to the real Clerk SDK, only touched when a key exists ---

// Statically imported: the dependency ships with the app regardless, and a
// top-level import keeps the hook rules simple (no dynamic import inside a hook).
import {
  useUser as useClerkUser,
  useAuth as useClerkAuth,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
} from "@clerk/clerk-react";

function clerkComponents() {
  return { SignedIn: ClerkSignedIn, SignedOut: ClerkSignedOut, UserButton: ClerkUserButton };
}

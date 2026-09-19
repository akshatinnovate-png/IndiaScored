import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";

/**
 * The fork straight after sign-in: an applicant with a profile goes to their
 * dashboard, one without goes to fill it in.
 */
export default function OnboardingRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      navigate("/sign-in", { replace: true });
      return;
    }

    let cancelled = false;

    api.profile
      .get(user.id)
      .then(({ has_profile }) => {
        if (cancelled) return;
        navigate(has_profile ? "/dashboard" : "/profile", { replace: true });
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        // Onboarding is the safe landing: it works whether or not a profile
        // already exists, so a backend hiccup does not strand the applicant.
        setError(cause.message);
        window.setTimeout(() => navigate("/profile", { replace: true }), 2500);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100">
      <div className="text-center">
        {error ? (
          <>
            <p className="mb-2 text-lg text-red-600">{error}</p>
            <p className="text-sm text-gray-600">Taking you to your profile…</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-24 w-24 animate-spin rounded-full border-b-2 border-orange-500" />
            <p className="text-xl text-gray-600">Setting up your account…</p>
          </>
        )}
      </div>
    </div>
  );
}

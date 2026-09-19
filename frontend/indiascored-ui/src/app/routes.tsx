import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import type { ReactNode } from "react";

import LandingPage from "@/features/landing/LandingPage";
import SignInPage from "@/features/auth/SignInPage";
import SignUpPage from "@/features/auth/SignUpPage";
import OnboardingRedirect from "@/features/auth/OnboardingRedirect";
import UnderwriterLogin from "@/features/auth/UnderwriterLogin";
import ProfileForm from "@/features/onboarding/ProfileForm";
import AadhaarVerification from "@/features/onboarding/AadhaarVerification";
import PsychometricTest from "@/features/psychometric/PsychometricTest";
import ApplyForm from "@/features/applications/ApplyForm";
import ApplicationsPage from "@/features/applications/ApplicationsPage";
import ApplicantDashboard from "@/features/dashboard/ApplicantDashboard";
import UnderwritingDashboard from "@/features/underwriting/UnderwritingDashboard";
import CreditRiskReport from "@/features/underwriting/CreditRiskReport";
import SupportPage from "@/features/support/SupportPage";
import NotFound from "@/features/errors/NotFound";

/** A route only a signed-in applicant may open. */
function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
}

function CreditRiskReportRoute() {
  const { clerkUserId } = useParams<{ clerkUserId: string }>();
  return <CreditRiskReport clerkUserId={clerkUserId!} />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/underwriter-login" element={<UnderwriterLogin />} />

      {/* Post-sign-in fork: profile first, dashboard once onboarded */}
      <Route path="/continue" element={<Protected><OnboardingRedirect /></Protected>} />

      {/* Applicant journey */}
      <Route path="/profile" element={<Protected><ProfileForm /></Protected>} />
      <Route path="/verify-identity" element={<Protected><AadhaarVerification /></Protected>} />
      <Route path="/assessment" element={<Protected><PsychometricTest /></Protected>} />
      <Route path="/apply" element={<Protected><ApplyForm /></Protected>} />
      <Route path="/applications" element={<Protected><ApplicationsPage /></Protected>} />
      <Route path="/dashboard" element={<Protected><ApplicantDashboard /></Protected>} />
      <Route path="/support" element={<Protected><SupportPage /></Protected>} />

      {/* Underwriting */}
      <Route path="/underwriting" element={<Protected><UnderwritingDashboard /></Protected>} />
      <Route
        path="/underwriting/applicants/:clerkUserId"
        element={<Protected><CreditRiskReportRoute /></Protected>}
      />

      {/* Legacy paths from the previous build, kept so old links resolve */}
      <Route path="/redirector" element={<Navigate to="/continue" replace />} />
      <Route path="/psychometric-test" element={<Navigate to="/assessment" replace />} />
      <Route path="/adhar" element={<Navigate to="/verify-identity" replace />} />
      <Route path="/admin" element={<Navigate to="/underwriting" replace />} />
      <Route path="/admin-login" element={<Navigate to="/underwriter-login" replace />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
